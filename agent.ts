import "./setup.ts";
import { createAgent } from "langchain";
import getWeather from "./tools/get-weather.ts";

const model = "anthropic:claude-sonnet-4-5-20250929";

const tools = [getWeather];

const agent = createAgent({
  model,
  tools,
});

const response = await agent.invoke({
  messages: [{ role: "user", content: "What's the weather in San Francisco?" }],
});

displayMessage(response.messages[response.messages.length - 1]);
