import { DPOAgentState } from "../state.ts";

const removePII = (state: DPOAgentState) => {
  const { redactionMap, userRequestContent } = state;

  let content = userRequestContent;

  if (!redactionMap.piiFound) {
    return {
      redactedUserRequest: content,
    };
  }

  const { items } = redactionMap;

  items.forEach((item) => {
    const regExp = new RegExp(RegExp.escape(item.value), 'ig');

    content = content.replaceAll(regExp, item.replacement);
  });

  return {
    redactedUserRequest: content,
  };
}

export default removePII;
