import { DPOAgentState } from "../state.ts";

const removePII = (state: DPOAgentState) => {
  const { redactionMap, messages } = state;

  const lastMessage = messages[messages.length - 1];
  let content = typeof lastMessage.content === 'string'
    ? lastMessage.content
    : lastMessage.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join("\n\n");

  if (!redactionMap.piiFound) {
    return {
      redactedText: content,
    };
  }

  const { items } = redactionMap;

  items.forEach((item) => {
    const regExp = new RegExp(RegExp.escape(item.value), 'ig');

    content = content.replaceAll(regExp, item.replacement);
  });

  return {
    redactedText: content,
  };
}

export default removePII;
