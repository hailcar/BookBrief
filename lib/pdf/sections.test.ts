import { beforeEach, describe, expect, it, vi } from "vitest";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  extractPdfPageText,
  loadAllPdfPagesContent,
  loadPdfPageContent,
  parsePdfSections,
  visitPdfPageTexts,
} from "@/lib/pdf/sections";
import type { EpubSection } from "@/lib/types";

const mockState = vi.hoisted(() => ({
  tasks: [] as FakePdfLoadingTask[],
}));

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: vi.fn(() => {
    const task = mockState.tasks.shift();
    if (!task) throw new Error("No fake PDF document queued");
    return task;
  }),
}));

type FakePdfPage = {
  getTextContent: ReturnType<typeof vi.fn>;
};

type FakePdfDocument = {
  numPages: number;
  getPage: ReturnType<typeof vi.fn>;
  getMetadata: ReturnType<typeof vi.fn>;
  getOutline?: ReturnType<typeof vi.fn>;
  getDestination?: ReturnType<typeof vi.fn>;
  getPageIndex?: ReturnType<typeof vi.fn>;
};

type FakePdfLoadingTask = {
  promise: Promise<FakePdfDocument>;
  destroy: ReturnType<typeof vi.fn>;
};

function page(items: unknown[]): FakePdfPage {
  return {
    getTextContent: vi.fn(async () => ({ items })),
  };
}

function queueDoc(doc: FakePdfDocument): FakePdfDocument {
  mockState.tasks.push({
    promise: Promise.resolve(doc),
    destroy: vi.fn(async () => undefined),
  });
  return doc;
}

function createDoc(pages: FakePdfPage[], title = "PDF Title"): FakePdfDocument {
  return {
    numPages: pages.length,
    getPage: vi.fn(async (pageNumber: number) => pages[pageNumber - 1]),
    getMetadata: vi.fn(async () => ({ info: { Title: title } })),
  };
}

function pdfSection(pageNumber: number): EpubSection {
  return {
    id: `page-${pageNumber}`,
    index: pageNumber - 1,
    title: `第 ${pageNumber} 页`,
    href: `page:${pageNumber}`,
    format: "pdf",
    pageNumber,
  };
}

beforeEach(() => {
  mockState.tasks = [];
  vi.mocked(pdfjs.getDocument).mockClear();
});

describe("PDF page sections", () => {
  it("parses one section per PDF page", async () => {
    queueDoc(createDoc([page([]), page([])]));
    const task = mockState.tasks[0];

    await expect(parsePdfSections(new ArrayBuffer(0))).resolves.toEqual({
      metadataTitle: "PDF Title",
      sections: [
        {
          id: "page-1",
          index: 0,
          title: "第 1 页",
          href: "page:1",
          format: "pdf",
          pageNumber: 1,
          endPageNumber: 1,
        },
        {
          id: "page-2",
          index: 1,
          title: "第 2 页",
          href: "page:2",
          format: "pdf",
          pageNumber: 2,
          endPageNumber: 2,
        },
      ],
    });
    expect(pdfjs.getDocument).toHaveBeenCalledTimes(1);
    expect(task.destroy).toHaveBeenCalledTimes(1);
  });

  it("uses PDF outline entries as the catalog when available", async () => {
    const introRef = { num: 10, gen: 0 };
    const partRef = { num: 20, gen: 0 };
    const appendixRef = { num: 40, gen: 0 };
    const doc = createDoc([page([]), page([]), page([]), page([])]);
    doc.getOutline = vi.fn(async () => [
      {
        title: "  Introduction  ",
        dest: [introRef],
        items: [
          {
            title: "Part A",
            dest: "part-a",
            items: [],
          },
        ],
      },
      {
        title: "Appendix",
        dest: [appendixRef],
        items: [],
      },
    ]);
    doc.getDestination = vi.fn(async (id: string) =>
      id === "part-a" ? [partRef] : null,
    );
    doc.getPageIndex = vi.fn(async (ref: unknown) => {
      if (ref === introRef) return 0;
      if (ref === partRef) return 1;
      if (ref === appendixRef) return 3;
      throw new Error("Unknown ref");
    });
    queueDoc(doc);

    await expect(parsePdfSections(new ArrayBuffer(0))).resolves.toEqual({
      metadataTitle: "PDF Title",
      sections: [
        {
          id: "outline-1-page-1",
          index: 0,
          title: "Introduction",
          href: "page:1",
          format: "pdf",
          pageNumber: 1,
          navLevel: 0,
          endPageNumber: 1,
        },
        {
          id: "outline-2-page-2",
          index: 1,
          title: "Part A",
          href: "page:2",
          format: "pdf",
          pageNumber: 2,
          navLevel: 1,
          endPageNumber: 3,
        },
        {
          id: "outline-3-page-4",
          index: 2,
          title: "Appendix",
          href: "page:4",
          format: "pdf",
          pageNumber: 4,
          navLevel: 0,
          endPageNumber: 4,
        },
      ],
    });
    expect(doc.getOutline).toHaveBeenCalledTimes(1);
    expect(doc.getDestination).toHaveBeenCalledWith("part-a");
  });

  it("loads extractable page text as preview HTML", async () => {
    const doc = queueDoc(
      createDoc([
        page([]),
        page([
          { str: "Large Title", transform: [1, 0, 0, 18, 40, 700], hasEOL: true },
          { str: "First", transform: [1, 0, 0, 10, 40, 680] },
          { str: "line", transform: [1, 0, 0, 10, 85, 680], hasEOL: true },
          { str: "Second line", transform: [1, 0, 0, 10, 40, 664], hasEOL: true },
        ]),
      ]),
    );
    const task = mockState.tasks[0];

    const result = await loadPdfPageContent(new ArrayBuffer(0), pdfSection(2));

    expect(result.text).toBe("Large Title\nFirst line\nSecond line");
    expect(result.html).toContain("<h1>第 2 页</h1>");
    expect(result.html).toContain('data-block-id="page-2-blk-2"');
    expect(result.html).toContain(">First line Second line</p>");
    expect(result.blocks.map((block) => [block.id, block.type, block.text])).toEqual([
      ["page-2-blk-1", "heading", "Large Title"],
      ["page-2-blk-2", "paragraph", "First line Second line"],
    ]);
    expect(doc.getPage).toHaveBeenCalledWith(2);
    expect(task.destroy).toHaveBeenCalledTimes(1);
  });

  it("extracts stable PDF text blocks and viewport rectangles for the text layer", async () => {
    const fakePage = page([
      {
        str: "Chapter 1",
        transform: [1, 0, 0, 18, 40, 700],
        width: 90,
        hasEOL: true,
      },
      {
        str: "First",
        transform: [1, 0, 0, 10, 40, 670],
        width: 35,
      },
      {
        str: "paragraph",
        transform: [1, 0, 0, 10, 82, 670],
        width: 72,
        hasEOL: true,
      },
    ]) as FakePdfPage & {
      getViewport: ReturnType<typeof vi.fn>;
    };
    fakePage.getViewport = vi.fn(() => ({
      width: 600,
      height: 800,
      scale: 1,
      transform: [1, 0, 0, -1, 0, 800],
      convertToViewportRectangle: (rect: number[]) => [
        rect[0],
        800 - rect[1],
        rect[2],
        800 - rect[3],
      ],
    }));

    const result = await extractPdfPageText(fakePage, { pageNumber: 3 });

    expect(result.pageId).toBe("page-3");
    expect(result.width).toBe(600);
    expect(result.height).toBe(800);
    expect(result.blocks.map((block) => [block.id, block.type, block.text])).toEqual([
      ["page-3-blk-1", "heading", "Chapter 1"],
      ["page-3-blk-2", "paragraph", "First paragraph"],
    ]);
    expect(result.spans.map((span) => [span.text, span.blockId])).toEqual([
      ["Chapter 1", "page-3-blk-1"],
      ["First", "page-3-blk-2"],
      ["paragraph", "page-3-blk-2"],
    ]);
    expect(result.blocks[1].rects[0]).toMatchObject({
      x: 40,
      y: 130,
      height: 10,
    });
  });

  it("groups normal line spacing into paragraphs and splits only clear gaps", async () => {
    const fakePage = page([
      {
        str: "This is the first sentence.",
        transform: [1, 0, 0, 10, 40, 700],
        width: 130,
        hasEOL: true,
      },
      {
        str: "It continues on the next line.",
        transform: [1, 0, 0, 10, 40, 684],
        width: 150,
        hasEOL: true,
      },
      {
        str: "A new paragraph starts after a larger gap.",
        transform: [1, 0, 0, 10, 40, 650],
        width: 220,
        hasEOL: true,
      },
    ]);

    const result = await extractPdfPageText(fakePage, { pageNumber: 4 });

    expect(result.blocks.map((block) => [block.id, block.text])).toEqual([
      [
        "page-4-blk-1",
        "This is the first sentence. It continues on the next line.",
      ],
      ["page-4-blk-2", "A new paragraph starts after a larger gap."],
    ]);
  });

  it("renders pages without extractable text as blank content", async () => {
    queueDoc(createDoc([page([])]));

    const result = await loadPdfPageContent(new ArrayBuffer(0), pdfSection(1));

    expect(result.text).toBe("");
    expect(result.html).toContain('class="pdf-empty"');
    expect(result.html).not.toContain("OCR");
  });

  it("loads all pages with one opened document for continuous PDF preview", async () => {
    const doc = queueDoc(
      createDoc([
        page([{ str: "one", transform: [1, 0, 0, 10, 0, 0], hasEOL: true }]),
        page([{ str: "two", transform: [1, 0, 0, 10, 0, 0], hasEOL: true }]),
      ]),
    );
    const task = mockState.tasks[0];

    const result = await loadAllPdfPagesContent(new ArrayBuffer(0));

    expect(result.map((item) => item.section.id)).toEqual(["page-1", "page-2"]);
    expect(result.map((item) => item.text)).toEqual(["one", "two"]);
    expect(doc.getPage).toHaveBeenCalledTimes(2);
    expect(pdfjs.getDocument).toHaveBeenCalledTimes(1);
    expect(task.destroy).toHaveBeenCalledTimes(1);
  });

  it("loads outline sections across their page range", async () => {
    const doc = queueDoc(
      createDoc([
        page([{ str: "one", transform: [1, 0, 0, 10, 0, 0], hasEOL: true }]),
        page([{ str: "two", transform: [1, 0, 0, 10, 0, 0], hasEOL: true }]),
        page([{ str: "three", transform: [1, 0, 0, 10, 0, 0], hasEOL: true }]),
      ]),
    );

    const result = await loadPdfPageContent(new ArrayBuffer(0), {
      id: "outline-1-page-1",
      index: 0,
      title: "Chapter",
      href: "page:1",
      format: "pdf",
      pageNumber: 1,
      endPageNumber: 2,
    });

    expect(result.text).toBe("one\n\ntwo");
    expect(result.html).toContain("<h1>Chapter · 第 1 页</h1>");
    expect(result.html).toContain("<h1>Chapter · 第 2 页</h1>");
    expect(doc.getPage).toHaveBeenCalledTimes(2);
  });

  it("visits page text with one opened document and stops when requested", async () => {
    const doc = queueDoc(
      createDoc([
        page([{ str: "one", transform: [1, 0, 0, 10, 0, 0], hasEOL: true }]),
        page([{ str: "two", transform: [1, 0, 0, 10, 0, 0], hasEOL: true }]),
        page([{ str: "three", transform: [1, 0, 0, 10, 0, 0], hasEOL: true }]),
      ]),
    );
    const task = mockState.tasks[0];
    const visitor = vi.fn((section: EpubSection) => section.id !== "page-2");

    await visitPdfPageTexts(
      new ArrayBuffer(0),
      [pdfSection(1), pdfSection(2), pdfSection(3)],
      visitor,
    );

    expect(pdfjs.getDocument).toHaveBeenCalledTimes(1);
    expect(doc.getPage).toHaveBeenCalledTimes(2);
    expect(visitor).toHaveBeenCalledTimes(2);
    expect(visitor).toHaveBeenNthCalledWith(1, pdfSection(1), "one");
    expect(visitor).toHaveBeenNthCalledWith(2, pdfSection(2), "two");
    expect(task.destroy).toHaveBeenCalledTimes(1);
  });
});
