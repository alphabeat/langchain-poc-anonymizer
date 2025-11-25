import { HumanMessage, SystemMessage } from "langchain";

import { slmModel } from "../models.ts";
import { DETECT_PII_SYSTEM_PROMPT } from "../prompts.ts";
import { DPOAgentState, RedactionMapType } from "../state.ts";

const detectPII = async (state: DPOAgentState) => {
  const { document, messages, redactionMap } = state;

  const lastMessage = messages[messages.length - 1];

  const lastMessageContent = typeof lastMessage.content === 'string'
    ? lastMessage.content
    : lastMessage.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

  const documentMessage = document ? `\n<document>\n${document}\n</document>` : '';

  const userRequestContent = `<user>\n${lastMessageContent}\n</user>${documentMessage}`;

  const slmMessages = [
    new SystemMessage(DETECT_PII_SYSTEM_PROMPT),
    new HumanMessage({ content: userRequestContent }),
  ];

  if (redactionMap) {
    return {
      userRequestContent,
    };
  }

  try {
    const result = await slmModel
    .withStructuredOutput(RedactionMapType)
    .invoke(slmMessages);

  return {
    redactionMap: result,
    userRequestContent,
  };
  } catch {
    console.error('Failed to detect PII');

    return {
      redactionMap: {
        piiFound: false,
        items: [],
      },
      userRequestContent,
    }
  }
}

export default detectPII;
