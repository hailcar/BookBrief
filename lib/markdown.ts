function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeHref(value: string): string {
  const trimmed = value.trim();
  if (/^(https?:|mailto:)/i.test(trimmed)) return escapeHtml(trimmed);
  return "#";
}

function renderInlineMarkdown(value: string): string {
  let html = escapeHtml(value);
  html = html.replace(
    /`([^`]+)`/g,
    (_match, code: string) => `<code>${code}</code>`,
  );
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, label: string, href: string) =>
      `<a href="${safeHref(href)}" target="_blank" rel="noreferrer">${label}</a>`,
  );
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  html = html.replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");
  return html;
}

function renderParagraph(lines: string[]): string {
  return `<p>${renderInlineMarkdown(lines.join(" "))}</p>`;
}

function renderList(items: string[], ordered: boolean): string {
  const tag = ordered ? "ol" : "ul";
  return `<${tag}>${items
    .map((item) => `<li>${renderInlineMarkdown(item)}</li>`)
    .join("")}</${tag}>`;
}

export function renderMarkdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const html: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let orderedList = false;
  let quoteLines: string[] = [];
  let codeLines: string[] = [];
  let inCodeFence = false;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(renderParagraph(paragraph));
    paragraph = [];
  };
  const flushList = () => {
    if (!listItems.length) return;
    html.push(renderList(listItems, orderedList));
    listItems = [];
  };
  const flushQuote = () => {
    if (!quoteLines.length) return;
    html.push(`<blockquote>${renderMarkdownToHtml(quoteLines.join("\n"))}</blockquote>`);
    quoteLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.trim().startsWith("```")) {
      if (inCodeFence) {
        html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        inCodeFence = false;
      } else {
        flushParagraph();
        flushList();
        flushQuote();
        inCodeFence = true;
      }
      continue;
    }

    if (inCodeFence) {
      codeLines.push(rawLine);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      flushQuote();
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      flushQuote();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flushParagraph();
      flushList();
      quoteLines.push(quote[1]);
      continue;
    }

    const unordered = /^\s*[-*+]\s+(.+)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    if (unordered || ordered) {
      flushParagraph();
      flushQuote();
      const nextOrdered = Boolean(ordered);
      if (listItems.length && orderedList !== nextOrdered) flushList();
      orderedList = nextOrdered;
      listItems.push((ordered ?? unordered)?.[1] ?? "");
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(line.trim());
  }

  if (inCodeFence) {
    html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }
  flushParagraph();
  flushList();
  flushQuote();

  return html.join("\n");
}
