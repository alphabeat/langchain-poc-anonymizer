import { HumanMessage, SystemMessage } from "langchain";

import { llmModel } from "../models.ts";
import { SUMMARIZE_SYSTEM_PROMPT } from "../prompts.ts";
import { DPOAgentState } from "../state.ts";

const summarize = async (state: DPOAgentState) => {
  const { redactedUserRequest } = state;

  const summary = await llmModel
    .invoke([
      new SystemMessage(SUMMARIZE_SYSTEM_PROMPT),
      new HumanMessage(redactedUserRequest),
    ]);

  return {
    documentSummary: summary.text,
  };
}

export default summarize;
