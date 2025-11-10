import { z } from "zod";

import { AIMessage, BaseMessage, createMiddleware, HumanMessage, SystemMessage, ToolMessage } from "langchain";
import { InferInteropZodInput } from "@langchain/core/utils/types";
import { RemoveMessage } from "@langchain/core/messages";

type Rules = Record<string, RegExp>;

type RedactionMap = Record<string, string>;

const contextSchema = z.object({
  rules: z.record(
      z.string(),
      z.instanceof(RegExp).describe("Regular expression pattern to match PII")
    )
    .optional(),
});

type PIIRedactionMiddlewareConfig = InferInteropZodInput<
  typeof contextSchema
>;

const generateRedactionId = () => {
  return Math.random().toString(36).substring(2, 11);
}

const applyPIIRules = (text: string, rules: Rules, redactionMap: RedactionMap) => {
  console.log('applyPIIRules, text=', text);

  let processedText = text;

  for (const [name, pattern] of Object.entries(rules)) {
    console.log('rule name=', name);
    console.log('pattern=', pattern)

    const replacement = name.toUpperCase().replace(/[^a-zA-Z0-9_-]/g, '');

    processedText = processedText.replace(pattern, (match) => {
      const id = generateRedactionId();

      redactionMap[id] = match;

      return `[REDACTED_${replacement}_${id}]`;
    })
  }

  return processedText;
}

interface ProcessHumanMessageConfig {
  rules: Rules;
  redactionMap: RedactionMap;
}

const processMessage = (message: BaseMessage, config: ProcessHumanMessageConfig) => {
  if (HumanMessage.isInstance(message) || ToolMessage.isInstance(message) || SystemMessage.isInstance(message)) {
    const content = typeof message.content === 'string'
      ? message.content
      : JSON.stringify(message.content);

    const processedContent = applyPIIRules(content, config.rules, config.redactionMap);

    if (processedContent !== content) {
      const MessageConstructor = Object.getPrototypeOf(message).constructor;

      return new MessageConstructor({
        ...message,
        content: processedContent,
      });
    }

    return message;
  }

  if (AIMessage.isInstance(message)) {
    const content = typeof message.content === 'string'
      ? message.content
      : JSON.stringify(message.content);
    const toolCalls = JSON.stringify(message.tool_calls);

    const processedContent = applyPIIRules(content, config.rules, config.redactionMap);

    const processedToolCalls = applyPIIRules(toolCalls, config.rules, config.redactionMap);

    if (processedContent !== content || processedToolCalls !== toolCalls) {
      return new AIMessage({
        ...message,
        content: typeof message.content === 'string' ? processedContent : JSON.parse(processedContent),
        tool_calls: JSON.parse(processedToolCalls),
      });
    }

    return message;
  }

  throw new Error(`Unsupported message type: ${message.type}`);
}

const restoreRedactedValues = (text: string, redactionMap: RedactionMap) => {
  let restoredText = text;

  const redactionPattern = /\[REDACTED_[A-Z]+_(\w+)\]/g;

  restoredText = restoredText.replace(redactionPattern, (match, id) => {
    if (redactionMap[id]) {
      return redactionMap[id];
    }

    return match;
  });

  return restoredText;
}

const restoreMessage = (message: BaseMessage, redactionMap: RedactionMap): { message: BaseMessage; changed: boolean } => {
  if (HumanMessage.isInstance(message) || ToolMessage.isInstance(message) || SystemMessage.isInstance(message)) {
    const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);

    const restoredContent = restoreRedactedValues(content, redactionMap);

    if (restoredContent !== content) {
      const MessageConstructor = Object.getPrototypeOf(message).constructor;

      const newMessage = new MessageConstructor({
        ...message,
        content: restoredContent,
      });

      return {
        message: newMessage,
        changed: true,
      };
    }

    return { message, changed: false };
  }

  if (AIMessage.isInstance(message)) {
    const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
    const toolCalls = JSON.stringify(message.content);

    const restoredContent = restoreRedactedValues(content, redactionMap);
    const restoredToolCalls = restoreRedactedValues(toolCalls, redactionMap);

    if (restoredContent !== content || restoredToolCalls !== toolCalls) {
      return {
        message: new AIMessage({
          ...message,
          content: typeof message.content === 'string' ? restoredContent : JSON.parse(restoredContent),
          tool_calls: JSON.parse(restoredToolCalls),
        }),
        changed: true,
      };
    }

    return { message, changed: false };
  }

  throw new Error(`Unsupported message type: ${message.type}`);
}

const piiRedactionMiddleware = (options: PIIRedactionMiddlewareConfig = {}) => {
  const redactionMap: RedactionMap = {};

  return createMiddleware({
    name: 'PIIRedactionMiddleware',
    contextSchema,
    wrapModelCall: async (request, handler) => {
      const rules = request.runtime.context.rules ?? options.rules ?? {
        email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
      };

      if (Object.keys(rules).length === 0) {
        return handler(request);
      }

      const processedMessages = await Promise.all(
        request.state.messages.map((message: BaseMessage) => processMessage(message, { rules, redactionMap }))
      )

      return handler({
        ...request,
        messages: processedMessages,
      });
    },
    afterModel: (state) => {
      if (Object.keys(redactionMap).length === 0) {
        return;
      }

      const lastMessage = state.messages.at(-1);

      if (!AIMessage.isInstance(lastMessage)) {
        return;
      }

      const secondLastMessage = state.messages.at(-2);

      const { message: restoredLastMessage, changed } = restoreMessage(lastMessage, redactionMap);

      if (!changed) return;

      let structuredResponse: Record<string, unknown> | undefined;

      if (
        AIMessage.isInstance(lastMessage) &&
        lastMessage.tool_calls?.length === 0 &&
        typeof lastMessage.content === 'string' &&
        lastMessage.content.startsWith('{') &&
        lastMessage.content.endsWith('}')
      ) {
        try {
          structuredResponse = JSON.parse(
            restoreRedactedValues(lastMessage.content, redactionMap)
          );
        } catch {
          // ignore
        }
      }

      if (
        AIMessage.isInstance(secondLastMessage) &&
        secondLastMessage.tool_calls?.length !== 0 &&
        secondLastMessage.tool_calls?.some((call) => call.name.startsWith('extract-'))
      ) {
        const {
          message: restoredSecondLastMessage,
          changed: changedSecondLastMessage,
        } = restoreMessage(secondLastMessage, redactionMap);

        const structuredResponseRedacted = secondLastMessage.tool_calls?.find(
          (call) => call.name.startsWith('extract-')
        )?.args;

        const structuredResponse = structuredResponseRedacted
          ? JSON.parse(
              restoreRedactedValues(
                JSON.stringify(structuredResponseRedacted),
                redactionMap
              )
            )
          : undefined;

        if (changed || changedSecondLastMessage) {
          return {
            ...state,
            ...(structuredResponse ? { structuredResponse } : {}),
            messages: [
              new RemoveMessage({ id: secondLastMessage.id as string }),
              new RemoveMessage({ id: lastMessage.id as string }),
              restoredSecondLastMessage,
              restoredLastMessage,
            ],
          };
        }
      }

      return {
        ...state,
        ...(structuredResponse ? { structuredResponse } : {}),
        messages: [
          new RemoveMessage({ id: lastMessage.id as string }),
          restoredLastMessage,
        ],
      };
    }
  });
}

export default piiRedactionMiddleware;
