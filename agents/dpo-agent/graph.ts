import { ChatAnthropic } from "@langchain/anthropic";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { StateGraph, START, END } from "@langchain/langgraph";
import { AIMessage, HumanMessage, SystemMessage } from "langchain";

import { DETECT_PII_SYSTEM_PROMPT, SUMMARIZE_SYSTEM_PROMPT } from "./prompts.ts";
import { DPOAgentState, DPOAgentStateDefinition, RedactionMapType } from "./state.ts";
import { b64ToBlob } from "./utils/b64ToBlob.ts";

const llmModel = new ChatAnthropic({
  model: 'claude-sonnet-4-5',
  temperature: 0,
});

const slmModel = new ChatAnthropic({
  model: 'claude-3-5-haiku-latest',
  temperature: 0,
});

const extractFile = async (state: DPOAgentState) => {
  const { messages } = state;

  const lastMessage = messages[messages.length - 1];

  if (typeof lastMessage.content === 'string') {
    return {};
  }

  const fileMessage = lastMessage.content.find((block) => block.type === 'file');

  if (!fileMessage) {
    return {};
  }

  let content = '';

  if (fileMessage.mimeType === 'application/pdf') {
    const blob = b64ToBlob(fileMessage.data as string, 'application/pdf');
    const loader = new PDFLoader(blob);
    const doc = await loader.load();

    content = doc[0].pageContent;
  }

  return {
    messages: messages.map((msg) => {
      if (msg.id !== lastMessage.id) return msg;

      return {
        ...msg,
        content: [
          ...msg.content,
          {
            type: 'text',
            text: content,
          },
        ],
      }
    })
  }
}

const detectPII = async (state: DPOAgentState) => {
  const { messages } = state;

  const lastMessage = messages[messages.length - 1];

  const redactionMap = await slmModel
    .withStructuredOutput(RedactionMapType)
    .invoke([
      new SystemMessage(DETECT_PII_SYSTEM_PROMPT),
      {
        ...lastMessage,
        content: typeof lastMessage.content === 'string'
          ? lastMessage.content
          : lastMessage.content.filter((block) => block.type === 'text'),
      },
    ]);

  return {
    redactionMap,
  };
}

const removePII = (state: DPOAgentState) => {
  const { redactionMap, messages } = state;

  const lastMessage = messages[messages.length - 1];
  let content = typeof lastMessage.content === 'string'
    ? lastMessage.content
    : lastMessage.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join("\n\n");

  if (!redactionMap.piiFound) {
    return {
      redactedText: content,
    };
  }

  const { items } = redactionMap;

  items.forEach((item) => {
    const regExp = new RegExp(RegExp.escape(item.value), 'ig');

    content = content.replaceAll(regExp, item.replacement);
  });

  return {
    redactedText: content,
  };
}

const summarize = async (state: DPOAgentState) => {
  const { redactedText } = state;

  const summary = await llmModel
    .invoke([
      new SystemMessage(SUMMARIZE_SYSTEM_PROMPT),
      new HumanMessage(redactedText),
    ]);

  return {
    ...state,
    documentSummary: summary.text,
  };
}

const restorePII = (state: DPOAgentState) => {
  const { redactionMap, documentSummary, messages } = state;

  if (!redactionMap.piiFound) {
    return state;
  }

  const { items } = redactionMap;

  let restoredText = documentSummary;

  items.forEach((item) => {
    const regExp = new RegExp(RegExp.escape(item.replacement), 'ig');

    restoredText = restoredText.replaceAll(regExp, item.value);
  });

  const newMessage = new AIMessage(restoredText);

  return {
    ...state,
    messages: [...messages, newMessage],
  };
}

export const builder = new StateGraph(DPOAgentStateDefinition)
  .addNode("extractFile", extractFile)
  .addNode("detectPII", detectPII)
  .addNode("removePII", removePII)
  .addNode("summarize", summarize)
  .addNode("restorePII", restorePII)
  .addEdge(START, "extractFile")
  .addEdge("extractFile", "detectPII")
  .addEdge("detectPII", "removePII")
  .addEdge("removePII", "summarize")
  .addEdge("summarize", "restorePII")
  .addEdge("restorePII", END);

export const graph = builder.compile();
graph.name = "DPOAgent";