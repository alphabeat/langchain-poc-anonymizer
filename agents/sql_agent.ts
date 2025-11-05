// Sql agent
import "dotenv/config";
import process from 'node:process';

import { ChatAnthropic } from "@langchain/anthropic";
import { MemorySaver } from "@langchain/langgraph";
import { createAgent } from "langchain";

import { executeSQL } from "../tools/index.ts";

const key = process.env.ANTHROPIC_API_KEY;
if (key === undefined) {
  console.error("ANTHROPIC_API_KEY is not set");
  process.exit(1);
}

/**
 * Model
 * - Uses your Anthropic key from .env if needed
 */
const model = new ChatAnthropic({ model: "claude-sonnet-4-5-20250929" });

/**
 * Tools
 * - Imported from the /tools folder
 */
const tools = [executeSQL];

/**
 * System prompt (includes schema + rules)
 */
const SYSTEM_PROMPT = `
You are a careful SQLite analyst.

Rules:
- Think step-by-step.
- When you need data, call the tool \`execute_sql\` with ONE SELECT query.
- Read-only only; no INSERT/UPDATE/DELETE/ALTER/DROP/CREATE/REPLACE/TRUNCATE.
- Limit to 5 rows unless user explicitly asks otherwise.
- If the tool returns 'Error:', revise the SQL and try again.
- Limit the number of attempts to 5.
- Prefer explicit column lists; avoid SELECT *.
`;

/**
 * Checkpointer (enables Studio thread history)
 * - Studio supplies thread_id automatically
 */
const checkpointer = new MemorySaver();

/**
 * Agent (default export for langgraph.json "<file>:default")
 */
const agent = createAgent({
  model,
  tools,
  systemPrompt: SYSTEM_PROMPT,
  checkpointer,
});

export default agent;

