import { StateGraph, START, END } from "@langchain/langgraph";

import {
  detectPII,
  extractFile,
  removePII,
  restorePII,
  summarize,
} from "./nodes/index.ts";
import { DPOAgentStateDefinition } from "./state.ts";

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
