import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

import { DPOAgentState } from "../state.ts";
import { b64ToBlob } from "../utils/index.ts";

const extractFile = async (state: DPOAgentState) => {
  const { messages } = state;

  const lastMessage = messages[messages.length - 1];

  if (typeof lastMessage.content === 'string') {
    return {};
  }

  const fileMessage = lastMessage.content.find((block) => block.type === 'file');

  if (!fileMessage) {
    return {};
  }

  let content = '';

  if (fileMessage.mimeType === 'application/pdf') {
    const blob = b64ToBlob(fileMessage.data as string, 'application/pdf');
    const loader = new PDFLoader(blob);
    const doc = await loader.load();

    content = doc[0].pageContent;
  }

  return {
    messages: messages.map((msg) => {
      if (msg.id !== lastMessage.id) return msg;

      return {
        ...msg,
        content: [
          ...msg.content,
          {
            type: 'text',
            text: content,
          },
        ],
      }
    })
  }
}

export default extractFile;
