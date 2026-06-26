import vm from "node:vm";
import { describe, expect, it } from "vitest";
import {
  HEADING_INTERACTION_SCRIPT,
  HEADING_INTERACTION_STYLE,
} from "@/lib/epub/heading-interaction";

function extractFunctionSource(script: string, functionName: string): string {
  const start = script.indexOf(`function ${functionName}(`);

  expect(start).toBeGreaterThanOrEqual(0);

  let depth = 0;
  let seenOpen = false;

  for (let index = start; index < script.length; index += 1) {
    const char = script[index];
    if (char === "{") {
      depth += 1;
      seenOpen = true;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (seenOpen && depth === 0) {
        return script.slice(start, index + 1);
      }
    }
  }

  throw new Error(`Unable to extract function source for ${functionName}`);
}

function renderInjectedMarkdown(markdown: string): string {
  const start = HEADING_INTERACTION_SCRIPT.indexOf("  function escapeText");
  const end = HEADING_INTERACTION_SCRIPT.indexOf("  var collapsedSummaries");

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return vm.runInNewContext(
    `${HEADING_INTERACTION_SCRIPT.slice(start, end)}
renderMarkdown(__markdown);`,
    { __markdown: markdown },
  ) as string;
}

describe("heading summary floating rail", () => {
  it("renders heading summaries as fixed floating cards instead of text-flow inserts", () => {
    expect(HEADING_INTERACTION_STYLE).toContain(
      ".summary-epub-summary-rail",
    );
    expect(HEADING_INTERACTION_STYLE).toMatch(
      /\.summary-epub-summary-rail\s*{[\s\S]*position:\s*fixed/,
    );
    expect(HEADING_INTERACTION_STYLE).toContain(
      ".summary-epub-summary-toggle",
    );
    expect(HEADING_INTERACTION_STYLE).toContain("scrollbar-width: thin");
    expect(HEADING_INTERACTION_STYLE).toContain("scrollbar-gutter: stable");
    expect(HEADING_INTERACTION_STYLE).not.toContain(
      ".summary-epub-summary-body::-webkit-scrollbar",
    );
    expect(HEADING_INTERACTION_STYLE).not.toContain(
      ".summary-epub-summary-body {\n    max-height",
    );
    expect(HEADING_INTERACTION_SCRIPT).toContain("renderMarkdown");
    expect(HEADING_INTERACTION_SCRIPT).toContain("body.innerHTML");
    expect(HEADING_INTERACTION_SCRIPT).toContain(
      "summary-epub-reader-block-click",
    );
    expect(HEADING_INTERACTION_SCRIPT).toContain(
      "summary-epub-scroll-to-block",
    );
    expect(HEADING_INTERACTION_SCRIPT).toContain(
      "summary-epub-mark-summarized-blocks",
    );
    expect(HEADING_INTERACTION_SCRIPT).toContain(
      "target.closest('a, button, input, textarea, select')",
    );
    expect(HEADING_INTERACTION_SCRIPT).toContain(
      "var currentSelectedBlockIds = []",
    );
    expect(HEADING_INTERACTION_SCRIPT).toContain(
      "currentSelectedBlockIds = Array.isArray(blockIds) ? blockIds.slice() : []",
    );
    expect(HEADING_INTERACTION_SCRIPT).not.toContain(
      "currentSelectionAnchorBlockId",
    );
    expect(HEADING_INTERACTION_SCRIPT).not.toContain(
      "function isShiftRangeBlockOperation",
    );
    expect(HEADING_INTERACTION_SCRIPT).not.toContain("!!ev.shiftKey");
    expect(HEADING_INTERACTION_SCRIPT).not.toContain(
      "!!ev.shiftKey && currentSelectedBlockIds.length > 0",
    );
    expect(HEADING_INTERACTION_SCRIPT).not.toContain(
      "summary-epub-comment-selection",
    );
    expect(HEADING_INTERACTION_SCRIPT).toContain(
      "document.addEventListener('mousedown', onReaderMouseDown, true)",
    );
    expect(HEADING_INTERACTION_SCRIPT).toContain(
      "target.closest('[contenteditable=\"\"], [contenteditable=\"true\"]')",
    );
    expect(HEADING_INTERACTION_SCRIPT).toContain("getOrCreateSummaryRail");
    expect(HEADING_INTERACTION_SCRIPT).toContain("collapsedSummaries");
    expect(HEADING_INTERACTION_SCRIPT).toContain("renderSelectedInlineBubble");
    expect(HEADING_INTERACTION_SCRIPT).toContain("insertAdjacentElement('afterend', wrap)");
    expect(HEADING_INTERACTION_SCRIPT).toContain(
      "summary-epub-render-selection-action",
    );
    expect(HEADING_INTERACTION_SCRIPT).toContain(
      "summary-epub-summarize-selection",
    );
    expect(HEADING_INTERACTION_SCRIPT).toContain(
      "summary-epub-activate-summary",
    );
    expect(HEADING_INTERACTION_SCRIPT).toContain(
      "summary-epub-delete-active-summary",
    );
    expect(HEADING_INTERACTION_STYLE).toContain("[data-se-commented=\"1\"]");
    expect(HEADING_INTERACTION_STYLE).toContain("content: attr(data-se-comment)");
    expect(HEADING_INTERACTION_SCRIPT).toContain("function applyComments");
    expect(HEADING_INTERACTION_SCRIPT).toContain(
      "summary-epub-render-comments",
    );
    expect(HEADING_INTERACTION_SCRIPT).toContain(
      "summary-epub-comment-text-selection",
    );
    expect(HEADING_INTERACTION_SCRIPT).toContain(
      "summary-epub-translate-text-selection",
    );
    expect(HEADING_INTERACTION_SCRIPT).toContain(
      "summary-epub-text-selection-action",
    );
    expect(HEADING_INTERACTION_SCRIPT).toContain(
      "document.addEventListener('selectionchange', onReaderSelectionChange)",
    );
    expect(HEADING_INTERACTION_SCRIPT).toContain(
      "document.addEventListener('touchend', onReaderTouchEnd)",
    );
    expect(HEADING_INTERACTION_SCRIPT).toContain(
      "function scheduleTextSelectionAction",
    );
    expect(HEADING_INTERACTION_SCRIPT).toContain(
      "data-summary-epub-runtime",
    );
    expect(HEADING_INTERACTION_SCRIPT).toContain(
      "globalThis.setTimeout",
    );
    expect(HEADING_INTERACTION_SCRIPT).toContain(
      "globalThis.requestAnimationFrame",
    );
    expect(HEADING_INTERACTION_SCRIPT).toContain("function wrapQuoteInBlock");
    expect(HEADING_INTERACTION_SCRIPT).toContain("range.surroundContents(mark)");
    expect(HEADING_INTERACTION_SCRIPT).toContain(
      "summary-epub-annotation-popover",
    );
    expect(HEADING_INTERACTION_SCRIPT).toContain(
      "summary-epub-delete-annotation",
    );
    expect(HEADING_INTERACTION_SCRIPT).toContain("includeCommentMarks: true");
    expect(HEADING_INTERACTION_SCRIPT).toContain("添加评论");
    expect(HEADING_INTERACTION_SCRIPT).not.toContain(
      "body.textContent = escapeText(bubble.summary",
    );
  });

  it("escapes untrusted markdown rendered inside the iframe summary rail", () => {
    const html = renderInjectedMarkdown(`## <img src=x onerror=owned>

[unsafe](javascript:owned) [data](data:text/html,owned)
[<img src=x onerror=owned>](https://example.com/read?x=1&y=2)

\`\`\`
<script>owned</script>
\`\`\``);

    expect(html).toContain("&lt;img src=x onerror=owned&gt;");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
    expect(html).toMatch(/href="#"/);
    expect(html).not.toMatch(/href="javascript:/i);
    expect(html).not.toMatch(/href="data:/i);
    expect(html).toMatch(/href="https:\/\/example\.com\/read\?x=1/);
    expect(html).toContain('target="_blank" rel="noreferrer"');
    expect(html).toContain("&lt;script&gt;owned&lt;/script&gt;");
  });

  it("normalizes whitespace before matching annotation quotes in the iframe", () => {
    expect(HEADING_INTERACTION_SCRIPT).toContain("function normalizeQuoteText");
    expect(HEADING_INTERACTION_SCRIPT).toContain("function findQuoteRange");
    expect(HEADING_INTERACTION_SCRIPT).toContain(
      "replace(/\\s+/g, ' ').trim()",
    );
    expect(HEADING_INTERACTION_SCRIPT).toContain(
      "var match = findQuoteRange(fullText, quote);",
    );
    expect(HEADING_INTERACTION_SCRIPT).toContain(
      "if (!findQuoteRange(escapeText(mark.textContent), quote)) continue;",
    );
  });

  it("falls back to block annotations when quote matching fails", () => {
    const applyCommentsSource = extractFunctionSource(
      HEADING_INTERACTION_SCRIPT,
      "applyComments",
    );

    const blockOne = {
      attrs: {} as Record<string, string>,
      setAttribute(name: string, value: string) {
        this.attrs[name] = value;
      },
    };
    const blockTwo = {
      attrs: {} as Record<string, string>,
      setAttribute(name: string, value: string) {
        this.attrs[name] = value;
      },
    };
    const annotationData = new Map<object, unknown>();
    const context = {
      document: {
        querySelector(selector: string) {
          if (selector === '[data-se-block-id="spine-1"]') return blockOne;
          if (selector === '[data-se-block-id="spine-2"]') return blockTwo;
          return null;
        },
      },
      currentAnnotationsById: {} as Record<string, unknown>,
      clearCommentMarks() {},
      escapeText(value: string) {
        return value == null ? "" : String(value);
      },
      wrapQuoteInBlock() {
        return false;
      },
      appendCommentToExistingMark() {
        return false;
      },
      setAnnotationData(target: object, annotations: unknown) {
        annotationData.set(target, annotations);
      },
    };

    const applyComments = vm.runInNewContext(
      `${applyCommentsSource}; applyComments;`,
      context,
    ) as (comments: unknown[]) => void;

    const comment = {
      id: "comment-1",
      kind: "translation",
      comment: "translated text",
      sourceText: "A quote that no longer matches",
      sourceFragments: [{ blockId: "spine-1", text: "Fragment miss" }],
      blockIds: ["spine-1", "spine-2"],
    };

    applyComments([comment]);

    expect(context.currentAnnotationsById).toEqual({ "comment-1": comment });
    expect(blockOne.attrs["data-se-commented"]).toBe("1");
    expect(blockTwo.attrs["data-se-commented"]).toBe("1");
    expect(annotationData.get(blockOne)).toEqual([comment]);
    expect(annotationData.get(blockTwo)).toEqual([comment]);
  });
});
