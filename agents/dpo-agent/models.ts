import { ChatAnthropic } from "@langchain/anthropic";

export const llmModel = new ChatAnthropic({
  model: 'claude-sonnet-4-5',
  temperature: 0,
});

export const slmModel = new ChatAnthropic({
  model: 'claude-3-5-haiku-latest',
  temperature: 0,
});
