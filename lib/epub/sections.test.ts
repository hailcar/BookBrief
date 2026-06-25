import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ePub from "epubjs";
import {
  loadSectionContent,
  parseEpubSections,
  visitSectionTexts,
} from "@/lib/epub/sections";
import type { EpubSection } from "@/lib/types";

const mockState = vi.hoisted(() => ({
  books: [] as unknown[],
}));

vi.mock("epubjs", () => ({
  default: vi.fn(() => {
    const book = mockState.books.shift();
    if (!book) throw new Error("No fake EPUB book queued");
    return book;
  }),
}));

type FakeBook = {
  opened: Promise<unknown>;
  loaded: {
    metadata?: unknown;
    navigation?: unknown;
    spine?: unknown;
  };
  spine: {
    length: number;
    get: ReturnType<typeof vi.fn>;
  };
  load: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
};

const section = (index: number): EpubSection => ({
  id: `spine-${index}`,
  index,
  title: `Section ${index + 1}`,
  href: `section-${index}.xhtml`,
});

function queueBook(book: FakeBook): FakeBook {
  mockState.books.push(book);
  return book;
}

function createBook(overrides: Partial<FakeBook> = {}): FakeBook {
  return {
    opened: Promise.resolve(),
    loaded: {
      metadata: { title: "Mock book" },
      navigation: { toc: [] },
      spine: {},
    },
    spine: {
      length: 1,
      get: vi.fn((target: number | string) =>
        typeof target === "number"
          ? {
              href: `section-${target}.xhtml`,
              render: vi.fn(async () => "<p>Rendered text</p>"),
            }
          : null,
      ),
    },
    load: vi.fn(async (href: string) => `<p>${href}</p>`),
    destroy: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mockState.books = [];
  vi.mocked(ePub).mockClear();
  vi.stubGlobal(
    "DOMParser",
    class {
      parseFromString(html: string) {
        return {
          querySelectorAll: () => [],
          body: { textContent: html.replace(/<[^>]+>/g, " ") },
          documentElement: { outerHTML: html },
        };
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("EPUB section loading", () => {
  it("destroys the book when parsing sections fails", async () => {
    const book = queueBook(
      createBook({
        loaded: {
          metadata: { title: "Broken book" },
          navigation: { toc: [] },
          get spine() {
            return Promise.reject(new Error("spine failed"));
          },
        },
      }),
    );

    await expect(parseEpubSections(new ArrayBuffer(0))).rejects.toThrow(
      "spine failed",
    );
    expect(book.destroy).toHaveBeenCalledTimes(1);
  });

  it("destroys the book when rendering a section fails", async () => {
    const render = vi.fn(async () => {
      throw new Error("render failed");
    });
    const book = queueBook(
      createBook({
        spine: {
          length: 1,
          get: vi.fn(() => ({ href: "section-0.xhtml", render })),
        },
      }),
    );

    await expect(
      loadSectionContent(new ArrayBuffer(0), section(0)),
    ).rejects.toThrow("render failed");
    expect(render).toHaveBeenCalledTimes(1);
    expect(book.destroy).toHaveBeenCalledTimes(1);
  });

  it("visits section text with one opened book and stops when requested", async () => {
    const book = queueBook(
      createBook({
        load: vi.fn(async (href: string) => `<p>${href}</p>`),
      }),
    );
    const visitor = vi.fn((visitedSection: EpubSection) =>
      visitedSection.id !== "spine-1",
    );

    await visitSectionTexts(
      new ArrayBuffer(0),
      [section(0), section(1), section(2)],
      visitor,
    );

    expect(ePub).toHaveBeenCalledTimes(1);
    expect(book.load).toHaveBeenCalledTimes(2);
    expect(book.load).toHaveBeenNthCalledWith(1, "section-0.xhtml");
    expect(book.load).toHaveBeenNthCalledWith(2, "section-1.xhtml");
    expect(visitor).toHaveBeenCalledTimes(2);
    expect(book.destroy).toHaveBeenCalledTimes(1);
  });
});
