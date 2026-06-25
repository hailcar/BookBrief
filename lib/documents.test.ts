import { describe, expect, it } from "vitest";
import {
  pdfPageAnchorIdForSection,
  sectionForPdfPageAnchor,
} from "@/lib/documents";
import type { EpubSection } from "@/lib/types";

const outlineSections: EpubSection[] = [
  {
    id: "outline-1-page-1",
    index: 0,
    title: "Chapter 1",
    href: "page:1",
    format: "pdf",
    pageNumber: 1,
    endPageNumber: 4,
    navLevel: 0,
  },
  {
    id: "outline-2-page-2",
    index: 1,
    title: "Section 1.1",
    href: "page:2",
    format: "pdf",
    pageNumber: 2,
    endPageNumber: 3,
    navLevel: 1,
  },
  {
    id: "outline-3-page-5",
    index: 2,
    title: "Chapter 2",
    href: "page:5",
    format: "pdf",
    pageNumber: 5,
    endPageNumber: 8,
    navLevel: 0,
  },
];

describe("PDF document navigation", () => {
  it("maps outline sections to physical PDF page anchors", () => {
    expect(pdfPageAnchorIdForSection(outlineSections[1])).toBe("page-2");
  });

  it("maps physical PDF page anchors back to the best catalog section", () => {
    expect(sectionForPdfPageAnchor(outlineSections, "page-3")?.id).toBe(
      "outline-2-page-2",
    );
    expect(sectionForPdfPageAnchor(outlineSections, "page-4")?.id).toBe(
      "outline-1-page-1",
    );
    expect(sectionForPdfPageAnchor(outlineSections, "page-6")?.id).toBe(
      "outline-3-page-5",
    );
  });
});
