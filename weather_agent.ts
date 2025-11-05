import "./setup.ts";
import { createAgent } from "langchain";
import getWeather from "./tools/get-weather.ts";

const model = "anthropic:claude-sonnet-4-5-20250929";

const tools = [getWeather];

const SYSTEM_PROMPT = `
You are a weather assitant.

Rules:
- Kindly provide the weather to users
- Call the tool \`getWeather\` when the user asks for the weather of a specific city.
`;

const agent = createAgent({
  model,
  tools,
  systemPrompt: SYSTEM_PROMPT,
});

export default agent;
