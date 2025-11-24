import { ChatAnthropic } from "@langchain/anthropic";
import { StateGraph, START, END } from "@langchain/langgraph";
import { AIMessage, HumanMessage, SystemMessage } from "langchain";

import { DETECT_PII_SYSTEM_PROMPT, SUMMARIZE_SYSTEM_PROMPT } from "./prompts.ts";
import { DPOAgentState, DPOAgentStateDefinition, RedactionMapType } from "./state.ts";

const llmModel = new ChatAnthropic({
  model: 'claude-sonnet-4-5',
  temperature: 0,
});

const slmModel = new ChatAnthropic({
  model: 'claude-3-5-haiku-latest',
  temperature: 0,
});

const detectPII = async (state: DPOAgentState) => {
  const { messages } = state;

  const lastMessage = messages[messages.length - 1];

  const redactionMap = await slmModel
    .withStructuredOutput(RedactionMapType)
    .invoke([
      new SystemMessage(DETECT_PII_SYSTEM_PROMPT),
      lastMessage,
    ]);

  return {
    redactionMap,
  };
}

const removePII = (state: DPOAgentState) => {
  const { redactionMap, messages } = state;

  if (!redactionMap.piiFound) {
    return state;
  }

  const lastMessage = messages[messages.length - 1];
  let content = typeof lastMessage.content === 'string'
    ? lastMessage.content
    : lastMessage.content.join(' ');

  const { items } = redactionMap;

  items.forEach((item) => {
    const regExp = new RegExp(item.value, 'ig');

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
    const regExp = new RegExp(item.replacement, 'ig');

    restoredText = restoredText.replaceAll(regExp, item.value);
  });

  const newMessage = new AIMessage(restoredText);

  return {
    ...state,
    messages: [...messages, newMessage],
  };
}

export const builder = new StateGraph(DPOAgentStateDefinition)
  .addNode("detectPII", detectPII)
  .addNode("removePII", removePII)
  .addNode("summarize", summarize)
  .addNode("restorePII", restorePII)
  .addEdge(START, "detectPII")
  .addEdge("detectPII", "removePII")
  .addEdge("removePII", "summarize")
  .addEdge("summarize", "restorePII")
  .addEdge("restorePII", END);

export const graph = builder.compile();
graph.name = "DPOAgent";