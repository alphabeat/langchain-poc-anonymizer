import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

import { DPOAgentState } from "../state.ts";
import { b64ToBlob } from "../utils/index.ts";

const extractFile = async (state: DPOAgentState) => {
  const { messages, document } = state;

  const lastMessage = messages[messages.length - 1];

  if (typeof lastMessage.content === 'string') {
    return {};
  }

  const fileMessage = lastMessage.content.find((block) => block.type === 'file');

  if (!fileMessage || document) {
    if (!fileMessage) { console.log('No file included.'); }
    if (document) { console.log('Document already parsed.'); }

    return {};
  }

  let content = '';

  if (fileMessage.mimeType === 'application/pdf') {
    try {
      const blob = b64ToBlob(fileMessage.data as string, 'application/pdf');
      const loader = new PDFLoader(blob, {
        splitPages: true,
      });
      const pages = await loader.load();

      content = pages.map((page) => page.pageContent).join("\n\n");
    } catch {
      console.error("Failed to parse PDF document");
    }
  }

  return {
    document: content,
  }
}

export default extractFile;
