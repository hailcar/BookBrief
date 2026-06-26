import { sanitizeEpubHtml } from "@/lib/epub/sanitize";

type ReaderWindowSection = {
  html?: string;
  sectionId?: string;
  title?: string;
  role: "prev" | "current" | "next";
  interactive?: boolean;
};

type ReaderWindowOptions = {
  currentHtml: string;
  currentSectionId: string;
  currentTitle?: string;
  prevHtml?: string;
  prevSectionId?: string;
  prevTitle?: string;
  nextHtml?: string;
  nextSectionId?: string;
  nextTitle?: string;
};

type ReaderDocumentOptions = {
  sections: Array<{
    html: string;
    sectionId: string;
    title?: string;
  }>;
  currentSectionId?: string;
};

const READER_DATA_ATTR_RE =
  /\s+(?:data-se-block-id|data-block-id|data-chapter-id|data-se-heading-level|data-heading-id|data-heading-level)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+)/gi;

function tagInnerHtml(html: string, tag: "head" | "body"): string {
  const match = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1]?.trim() ?? (tag === "head" ? "" : html.trim());
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function stripReaderDataAttrs(html: string): string {
  return html.replace(READER_DATA_ATTR_RE, "");
}

function isBlankBody(html: string | undefined): boolean {
  if (!html) return true;
  return html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim().length === 0;
}

function blankPage(label: string): string {
  return `<div class="summary-epub-reader-window-blank" aria-label="${escapeAttribute(label)}"></div>`;
}

function readerWindowStyle(): string {
  return `<style id="summary-epub-reader-window-style">
    .summary-epub-reader-window {
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }
    .summary-epub-reader-window-section {
      box-sizing: border-box;
      min-height: min(88vh, 980px);
      scroll-margin-top: 0;
    }
    .summary-epub-reader-window-section + .summary-epub-reader-window-section {
      border-top: 1px solid rgb(214 211 209 / 70%);
      padding-top: 2rem;
    }
    .summary-epub-reader-window-passive {
      opacity: 0.98;
    }
    .summary-epub-reader-window-blank {
      min-height: min(68vh, 760px);
    }
  </style>`;
}

function renderSection({
  html,
  sectionId,
  title,
  role,
  interactive,
}: ReaderWindowSection): string {
  if (!sectionId) return "";
  const safeHtml = html ? sanitizeEpubHtml(html) : "";
  const body = safeHtml ? tagInnerHtml(safeHtml, "body") : "";
  const content = interactive ? body : stripReaderDataAttrs(body);
  const roleClass =
    role === "current"
      ? "summary-epub-reader-window-current"
      : "summary-epub-reader-window-passive";
  return `<section class="summary-epub-reader-window-section ${roleClass}" data-reader-window-role="${role}" data-reader-window-section-id="${escapeAttribute(sectionId)}" aria-label="${escapeAttribute(title ?? "页面")}">
    ${isBlankBody(content) ? blankPage(`${title ?? "页面"}暂无内容`) : content}
  </section>`;
}

export function buildReaderWindowHtml({
  currentHtml,
  currentSectionId,
  currentTitle = "当前位置",
  prevHtml,
  prevSectionId,
  prevTitle = "上一页",
  nextHtml,
  nextSectionId,
  nextTitle = "下一页",
}: ReaderWindowOptions): string {
  const currentHead = tagInnerHtml(sanitizeEpubHtml(currentHtml), "head");
  const sections = [
    renderSection({
      html: prevHtml,
      sectionId: prevSectionId,
      title: prevTitle,
      role: "prev",
    }),
    renderSection({
      html: currentHtml,
      sectionId: currentSectionId,
      title: currentTitle,
      role: "current",
      interactive: true,
    }),
    renderSection({
      html: nextHtml,
      sectionId: nextSectionId,
      title: nextTitle,
      role: "next",
    }),
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html lang="zh-Hans">
<head>
  ${currentHead}
  ${readerWindowStyle()}
</head>
<body data-reader-window-current-section-id="${escapeAttribute(currentSectionId)}">
  <main class="summary-epub-reader-window">
    ${sections.join("\n")}
  </main>
</body>
</html>`;
}

export function buildReaderDocumentHtml({
  sections,
  currentSectionId,
}: ReaderDocumentOptions): string {
  const first = sections[0];
  const currentHead = first ? tagInnerHtml(sanitizeEpubHtml(first.html), "head") : "";
  const rendered = sections
    .map((section) =>
      renderSection({
        html: section.html,
        sectionId: section.sectionId,
        title: section.title,
        role: section.sectionId === currentSectionId ? "current" : "next",
        interactive: true,
      }),
    )
    .filter(Boolean);

  return `<!DOCTYPE html>
<html lang="zh-Hans">
<head>
  ${currentHead}
  ${readerWindowStyle()}
</head>
<body data-reader-window-full-document="true" data-reader-window-current-section-id="${escapeAttribute(currentSectionId ?? first?.sectionId ?? "")}">
  <main class="summary-epub-reader-window">
    ${rendered.join("\n")}
  </main>
</body>
</html>`;
}
