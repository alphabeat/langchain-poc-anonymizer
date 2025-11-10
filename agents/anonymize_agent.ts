import "dotenv/config";
import process from 'node:process';

import { ChatAnthropic } from '@langchain/anthropic';
import { MemorySaver } from '@langchain/langgraph';
import { createAgent } from "langchain";

import { piiRedactionMiddleware } from "../middleware/index.ts";
import { piiRedactionPrompt } from "../prompts/index.ts";

const key = process.env.ANTHROPIC_API_KEY;

if (key === undefined) {
  console.error("ANTHROPIC_API_KEY is not set");
  process.exit(1);
}

const model = new ChatAnthropic({ model: 'claude-sonnet-4-5' });

// const tools = [];

const checkpointer = new MemorySaver();

const agent = createAgent({
  model,
  // tools,
  systemPrompt: piiRedactionPrompt,
  checkpointer,
  middleware: [piiRedactionMiddleware()],
});

export default agent;
