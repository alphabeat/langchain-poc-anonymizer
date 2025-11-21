import { ChatAnthropic } from "@langchain/anthropic";
import { StateGraph, START, END } from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "langchain";
import { z } from "zod";

const RedactionMapType = z.object({
  piiFound: z.boolean(),
  items: z.array(z.object({
      category: z.string().describe("The category of the item (email, name, location, etc.)"),
      value: z.string().describe("The exact text value found in the original text"),
      replacement: z.string().describe("An equivalent replacement value for the text value found"),
      startChar: z.number().describe("The index of the first character for this item in the original text"),
      lastChar: z.number().describe("The index of the last character for this item in the original text"),
    }),
  ),
});

const DPOAgentStateDefinition = z.object({
  userPrompt: z.string(),
  documentSummary: z.string(),
  redactionMap: RedactionMapType,
  redactedText: z.string(),
  restoredText: z.string(),
});

export type DPOAgentState = z.infer<typeof DPOAgentStateDefinition>;

const llmModel = new ChatAnthropic({
  model: 'claude-sonnet-4-5',
  temperature: 0,
});

const slmModel = new ChatAnthropic({
  model: 'claude-3-5-haiku-latest',
  temperature: 0,
});

const detectPII = async (state: DPOAgentState) => {
  const systemPrompt = `
## Role and Goal
You are an expert data-privacy analyzer specialized in detecting and classifying Personally Identifiable Information (PII).
Your task is to extract all PII from the provided text and return it only as a strict JSON object.
The JSON output must be clean, valid and fully parsable by downstream nodes in a LangGraph workflow.
## Instructions
1. Identify all PII categories, including but not limited to:
  * Full names
  * Email addresses
  * Phone numbers
  * Physical addresses
  * IP addresses
  * Usernames / account IDs
  * Government IDs (e.g., SSN, passport numbers)
  * Financial numbers (credit cards, bank accounts)
  * Dates of birth
  * Geolocation data
  * Any other data that can identify an individual
2. Do NOT transform or interpret the text.
  Simply detect and extract PII exactly as it appears.
3. If no PII exists, return:
  { "piiFound": false, "items": [] }
4. If PII exists, output ONLY this JSON structure (no comments, no explanation):
  {
    "piiFound": true,
    "items": [
      {
        "category": "<PII category>",
        "value": "<Exact text value>",
        "replacement": "<Random replacement value>",
        "startChar": <index>,
        "endChar": <index>
      }
    ]
  }

  * replacement refer to a randomly generated text, equivalent to the original text (same category)
  * startChar and endChar refer to character positions in the original text.
5. Never include the original text in the JSON.
6. Never output anything outside the JSON object.
  `;

  const redactionMap = await slmModel
    .withStructuredOutput(RedactionMapType)
    .invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(state.userPrompt)
    ]);

  return {
    ...state,
    redactionMap,
  };
}

const removePII = (state: DPOAgentState) => {
  const { redactionMap, userPrompt } = state;

  if (!redactionMap.piiFound) {
    return state;
  }

  const { items } = redactionMap;

  let redactedText = userPrompt;

  items.forEach((item) => {
    const regExp = new RegExp(item.value, 'ig');

    redactedText = redactedText.replaceAll(regExp, item.replacement);
  });

  return {
    ...state,
    redactedText,
  };
}

const summarize = async (state: DPOAgentState) => {
  const systemPrompt = `
You are a helpful assistant.
Provide a comprehensive summary of the given text.
The summary should cover all the key points and main ideas presented in the original text,
while also condensing the information into a concise and easy-to-understand format.
Please ensure that the summary includes relevant details and examples that support the main ideas,
while avoiding any unnecessary information or repetition. The length of the summary should be appropriate
for the length and complexity of the original text, providing a clear and accurate
overview without omitting any important information.
  `;

  const summary = await llmModel
    .invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(state.redactedText),
    ]);

  return {
    ...state,
    documentSummary: summary.text,
  };
}

const restorePII = (state: DPOAgentState) => {
  const { redactionMap, documentSummary } = state;

  if (!redactionMap.piiFound) {
    return state;
  }

  const { items } = redactionMap;

  let restoredText = documentSummary;

  items.forEach((item) => {
    const regExp = new RegExp(item.replacement, 'ig');

    restoredText = restoredText.replaceAll(regExp, item.value);
  });

  return {
    ...state,
    restoredText,
  };
}

const agent = new StateGraph(DPOAgentStateDefinition)
  .addNode("detectPII", detectPII)
  .addNode("removePII", removePII)
  .addNode("summarize", summarize)
  .addNode("restorePII", restorePII)
  .addEdge(START, "detectPII")
  .addEdge("detectPII", "removePII")
  .addEdge("removePII", "summarize")
  .addEdge("summarize", "restorePII")
  .addEdge("restorePII", END)
  .compile();

export default agent;