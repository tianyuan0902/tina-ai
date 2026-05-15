import type { RenderedTinaResponseBlock, TinaResponseBlock } from "@/lib/tina/types";
import { applyTinaResponseStyle } from "@/lib/tina/response-style";

export function renderTinaResponseBlocks(blocks: TinaResponseBlock[]): RenderedTinaResponseBlock[] {
  return blocks.map((block) => ({
    ...block,
    rawContent: block.content,
    styledContent: applyTinaResponseStyle(block.content),
    content: applyTinaResponseStyle(block.content)
  }));
}

export function renderConversationalTinaAnswer(blocks: TinaResponseBlock[]) {
  const recommendation = blocks.find((block) => block.id === "recommendation-summary");
  const roleRead = blocks.find((block) => block.id === "role-direction");
  const fallback = recommendation ?? roleRead ?? blocks[0];

  if (!fallback) return "";

  return applyTinaResponseStyle(fallback.content, { maxSentences: 2 });
}
