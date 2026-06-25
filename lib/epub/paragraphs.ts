import {
  extractBlocksFromHtml,
  splitTextForChunks,
} from "@/lib/epub/blocks";

const MAX_PARAGRAPH_CHARS = 6000;

export function extractParagraphsFromHtml(
  html: string,
  chapterId = "section",
): string[] {
  const { blocks } = extractBlocksFromHtml(html, chapterId);
  const texts = blocks
    .filter((b) => b.type !== "heading")
    .map((b) => b.text)
    .filter((t) => t.length >= 2);

  const out: string[] = [];
  for (const p of texts) {
    out.push(...splitTextForChunks(p, MAX_PARAGRAPH_CHARS));
  }
  return out;
}