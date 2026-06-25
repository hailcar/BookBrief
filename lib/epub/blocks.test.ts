import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { EpubBlock } from "@/lib/types";
import { collectContentUnderHeading } from "@/lib/epub/blocks";

function block(
  partial: Omit<EpubBlock, "chapterId" | "index"> & { index: number },
): EpubBlock {
  return { chapterId: "ch1", ...partial };
}

describe("collectContentUnderHeading", () => {
  const blocks: EpubBlock[] = [
    block({ id: "h1a", type: "heading", level: 1, text: "Part A", index: 0 }),
    block({ id: "p1", type: "paragraph", text: "Intro A", index: 1 }),
    block({ id: "h2a", type: "heading", level: 2, text: "Sec 1", index: 2 }),
    block({ id: "p2", type: "paragraph", text: "Body 1", index: 3 }),
    block({ id: "h2b", type: "heading", level: 2, text: "Sec 2", index: 4 }),
    block({ id: "p3", type: "paragraph", text: "Body 2", index: 5 }),
    block({ id: "h1b", type: "heading", level: 1, text: "Part B", index: 6 }),
    block({ id: "p4", type: "paragraph", text: "Intro B", index: 7 }),
  ];

  it("h1 collects until next h1", () => {
    const r = collectContentUnderHeading({ blocks, headingBlockId: "h1a" });
    expect(r.contentBlocks.map((b) => b.id)).toEqual([
      "p1",
      "h2a",
      "p2",
      "h2b",
      "p3",
    ]);
    expect(r.plainText).toContain("Intro A");
    expect(r.plainText).toContain("Body 2");
    expect(r.plainText).not.toContain("Intro B");
    expect(r.startIndex).toBe(1);
    expect(r.endIndex).toBe(5);
  });

  it("h2 collects until next h2 or h1", () => {
    const r = collectContentUnderHeading({ blocks, headingBlockId: "h2a" });
    expect(r.contentBlocks.map((b) => b.id)).toEqual(["p2"]);
    expect(r.heading.text).toBe("Sec 1");
  });

  it("h2 second section stops at next h2", () => {
    const r = collectContentUnderHeading({ blocks, headingBlockId: "h2b" });
    expect(r.contentBlocks.map((b) => b.id)).toEqual(["p3"]);
  });

  it("throws when heading has no body", () => {
    const only: EpubBlock[] = [
      block({ id: "hx", type: "heading", level: 2, text: "Empty", index: 0 }),
    ];
    const r = collectContentUnderHeading({ blocks: only, headingBlockId: "hx" });
    expect(r.contentBlocks).toEqual([]);
    expect(r.plainText).toBe("");
    expect(r.endIndex).toBe(0);
  });

  it("throws for non-heading block", () => {
    expect(() =>
      collectContentUnderHeading({ blocks, headingBlockId: "p1" }),
    ).toThrow("不是标题");
  });

  it("annotates rendered blocks with stable block and heading data attributes", () => {
    const source = readFileSync(
      join(process.cwd(), "lib/epub/blocks.ts"),
      "utf8",
    );

    expect(source).toContain('el.setAttribute("data-se-block-id", id)');
    expect(source).toContain('el.setAttribute("data-block-id", id)');
    expect(source).toContain('el.setAttribute("data-chapter-id", chapterId)');
    expect(source).toContain('el.setAttribute("data-heading-id", id)');
    expect(source).toContain('el.setAttribute("data-heading-level"');
  });
});
