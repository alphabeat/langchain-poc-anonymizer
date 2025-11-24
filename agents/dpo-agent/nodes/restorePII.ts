import { AIMessage } from "langchain";

import { DPOAgentState } from "../state.ts";

const restorePII = (state: DPOAgentState) => {
  const { redactionMap, documentSummary, messages } = state;

  if (!redactionMap.piiFound) {
    return state;
  }

  const { items } = redactionMap;

  let restoredText = documentSummary;

  items.forEach((item) => {
    const regExp = new RegExp(RegExp.escape(item.replacement), 'ig');

    restoredText = restoredText.replaceAll(regExp, item.value);
  });

  const newMessage = new AIMessage(restoredText);

  return {
    ...state,
    messages: [...messages, newMessage],
  };
}

export default restorePII;
