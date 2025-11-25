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
    const pages = await loader.load();

    content = pages.map((page) => page.pageContent).join("\n\n");
  }

  return {
    document: content,
  }
}

export default extractFile;
