import "dotenv/config";
import process from "node:process";

import { ChatAnthropic } from "@langchain/anthropic";
import { createAgent } from "langchain";
import { MemorySaver } from "@langchain/langgraph";

import getWeather from "./tools/get-weather.ts";

const key = process.env.ANTHROPIC_API_KEY;
if (key === undefined) {
  console.error("ANTHROPIC_API_KEY is not set");
  process.exit(1);
}

const model = new ChatAnthropic({ model: 'claude-3-5-haiku-latest' });

const tools = [getWeather];

const SYSTEM_PROMPT = `
You are a weather assitant.

Rules:
- Kindly provide the weather to users
- Call the tool \`getWeather\` when the user asks for the weather of a specific city.
`;

/**
 * Checkpointer (enables Studio thread history)
 * - Studio supplies thread_id automatically
 */
const checkpointer = new MemorySaver();

const agent = createAgent({
  model,
  tools,
  systemPrompt: SYSTEM_PROMPT,
  checkpointer,
});

export default agent;
