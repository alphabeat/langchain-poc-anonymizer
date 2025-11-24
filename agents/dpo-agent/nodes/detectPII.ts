import { SystemMessage } from "langchain";

import { slmModel } from "../models.ts";
import { DETECT_PII_SYSTEM_PROMPT } from "../prompts.ts";
import { DPOAgentState, RedactionMapType } from "../state.ts";

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

export default detectPII;
