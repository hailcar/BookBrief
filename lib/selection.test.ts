import { describe, expect, it } from "vitest";
import {
  computeReaderBlockSelection,
  expandSelectedBoundaryRange,
  isSummarizableBlock,
  selectionAnchorLabel,
} from "@/lib/selection";
import type { EpubBlock } from "@/lib/types";

function block(
  id: string,
  index: number,
  type: EpubBlock["type"] = "paragraph",
  text = id,
): EpubBlock {
  return {
    id,
    chapterId: "s1",
    index,
    type,
    text,
  };
}

describe("reader block selection", () => {
  const blocks = [
    block("h1", 0, "heading"),
    block("p1", 1),
    block("p2", 2),
    block("q1", 3, "quote"),
    block("h2", 4, "heading"),
    block("p3", 5),
  ];

  it("treats text blocks as summarizable and headings as anchors to the next text block", () => {
    expect(isSummarizableBlock(blocks[0])).toBe(false);
    expect(isSummarizableBlock(blocks[1])).toBe(true);

    const result = computeReaderBlockSelection({
      blocks,
      clickedBlockId: "h2",
      currentSelectedBlockIds: [],
      anchorBlockId: null,
    });

    expect(result.selectedBlockIds).toEqual(["p3"]);
    expect(result.anchorBlockId).toBe("p3");
  });

  it("single-click replaces the selection and sets the anchor", () => {
    const result = computeReaderBlockSelection({
      blocks,
      clickedBlockId: "p2",
      currentSelectedBlockIds: ["p1", "q1"],
      anchorBlockId: "p1",
    });

    expect(result.selectedBlockIds).toEqual(["p2"]);
    expect(result.anchorBlockId).toBe("p2");
    expect(result.activeBlockId).toBe("p2");
  });

  it("ctrl/cmd toggles individual blocks while preserving reading order", () => {
    const added = computeReaderBlockSelection({
      blocks,
      clickedBlockId: "p1",
      currentSelectedBlockIds: ["q1"],
      anchorBlockId: "q1",
      modifiers: { metaKey: true },
    });
    expect(added.selectedBlockIds).toEqual(["p1", "q1"]);

    const removed = computeReaderBlockSelection({
      blocks,
      clickedBlockId: "q1",
      currentSelectedBlockIds: ["p1", "q1"],
      anchorBlockId: "p1",
      modifiers: { ctrlKey: true },
    });
    expect(removed.selectedBlockIds).toEqual(["p1"]);
  });

  it("ignores shift for range selection so browser-native text selection remains available", () => {
    const result = computeReaderBlockSelection({
      blocks,
      clickedBlockId: "p3",
      currentSelectedBlockIds: ["p1"],
      anchorBlockId: "p1",
    });

    expect(result.selectedBlockIds).toEqual(["p3"]);
    expect(result.anchorBlockId).toBe("p3");
  });

  it("expands exactly two selected boundary blocks into an inclusive reading-order range", () => {
    expect(expandSelectedBoundaryRange(blocks, ["p1", "p3"])).toEqual({
      ok: true,
      selectedBlockIds: ["p1", "p2", "q1", "p3"],
      activeBlockId: "p3",
    });
    expect(expandSelectedBoundaryRange(blocks, ["p3", "p1"])).toEqual({
      ok: true,
      selectedBlockIds: ["p1", "p2", "q1", "p3"],
      activeBlockId: "p1",
    });
  });

  it("does not expand unless exactly two summarizable boundaries are selected", () => {
    expect(expandSelectedBoundaryRange(blocks, [])).toEqual({
      ok: false,
      selectedBlockIds: [],
      activeBlockId: null,
    });
    expect(expandSelectedBoundaryRange(blocks, ["p1"])).toEqual({
      ok: false,
      selectedBlockIds: ["p1"],
      activeBlockId: null,
    });
    expect(expandSelectedBoundaryRange(blocks, ["p1", "p2", "p3"])).toEqual({
      ok: false,
      selectedBlockIds: ["p1", "p2", "p3"],
      activeBlockId: null,
    });
    expect(expandSelectedBoundaryRange(blocks, ["h1", "p3"])).toEqual({
      ok: false,
      selectedBlockIds: ["h1", "p3"],
      activeBlockId: null,
    });
  });

  it("formats a compact anchor label for UI hints", () => {
    expect(
      selectionAnchorLabel(
        [block("p1", 0, "paragraph", "A long paragraph with extra words here")],
        "p1",
      ),
    ).toBe("A long paragraph with extra ...");
  });
});
