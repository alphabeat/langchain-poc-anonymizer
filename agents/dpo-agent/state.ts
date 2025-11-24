import { BaseMessage } from "langchain";
import z from "zod";

import { registry, schemaMetaRegistry } from "@langchain/langgraph/zod";


export const RedactionMapType = z.object({
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

export const DPOAgentStateDefinition = z.object({
  messages: z.array(z.custom<BaseMessage>()).register(registry, schemaMetaRegistry.getChannelsForSchema(
    z.object({ messages: z.array(z.custom<BaseMessage>())})
  )),
  documentSummary: z.string(),
  redactionMap: RedactionMapType,
  redactedText: z.string(),
});

export type DPOAgentState = z.infer<typeof DPOAgentStateDefinition>;
