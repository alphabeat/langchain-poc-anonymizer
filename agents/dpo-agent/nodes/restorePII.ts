import { AIMessage } from "langchain";

import { DPOAgentState } from "../state.ts";

const restorePII = (state: DPOAgentState) => {
  const { redactionMap, documentSummary, messages } = state;

  if (!redactionMap.piiFound) {
    return {
      messages: [...messages, new AIMessage(documentSummary)],
    };
  }

  const { items } = redactionMap;

  let restoredText = documentSummary;

  items.forEach((item) => {
    const regExp = new RegExp(RegExp.escape(item.replacement), 'ig');

    restoredText = restoredText.replaceAll(regExp, item.value);
  });

  return {
    messages: [...messages, new AIMessage(restoredText)],
  };
}

export default restorePII;
