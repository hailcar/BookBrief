const ACTIVE_CONTENT_SELECTOR = "script, iframe, object, embed, form, base";

const URL_ATTRIBUTES = new Set([
  "action",
  "formaction",
  "href",
  "poster",
  "src",
  "xlink:href",
]);

const NAVIGATION_URL_ATTRIBUTES = new Set([
  "action",
  "formaction",
  "href",
  "xlink:href",
]);

const DANGEROUS_STYLE_RE =
  /(?:javascript\s*:|vbscript\s*:|expression\s*\(|behavior\s*:|-moz-binding\s*:)/i;

function isDangerousUrlAttribute(name: string, value: string): boolean {
  const compact = value.trim().replace(/[\u0000-\u001f\u007f\s]+/g, "");
  if (/^(?:javascript|vbscript):/i.test(compact)) return true;
  return NAVIGATION_URL_ATTRIBUTES.has(name) && /^data:/i.test(compact);
}

export function sanitizeEpubHtmlFallback(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script\b[^>]*\/?>/gi, "")
    .replace(/<(?:iframe|object|embed|form)\b[^>]*>[\s\S]*?<\/(?:iframe|object|embed|form)\s*>/gi, "")
    .replace(/<(?:iframe|object|embed|form|base)\b[^>]*\/?>/gi, "")
    .replace(/<meta\b(?=[^>]*\bhttp-equiv\s*=\s*["']?refresh\b)[^>]*\/?>/gi, "")
    .replace(/\s+on[a-z][\w:-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?/gi, "")
    .replace(/\s+srcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+)/gi, "")
    .replace(
      /\s+style\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi,
      (match, doubleQuoted?: string, singleQuoted?: string, unquoted?: string) => {
        const value = doubleQuoted ?? singleQuoted ?? unquoted ?? "";
        return DANGEROUS_STYLE_RE.test(value) ? "" : match;
      },
    )
    .replace(
      /\s+(action|formaction|href|poster|src|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi,
      (match, rawName: string, doubleQuoted?: string, singleQuoted?: string, unquoted?: string) => {
        const name = rawName.toLowerCase();
        const value = doubleQuoted ?? singleQuoted ?? unquoted ?? "";
        return isDangerousUrlAttribute(name, value) ? "" : match;
      },
    );
}

export function sanitizeEpubDocument(doc: Document): Document {
  doc.querySelectorAll(ACTIVE_CONTENT_SELECTOR).forEach((el) => el.remove());
  doc.querySelectorAll("meta").forEach((el) => {
    if (el.getAttribute("http-equiv")?.toLowerCase() === "refresh") {
      el.remove();
    }
  });
  doc.querySelectorAll("*").forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (
        name.startsWith("on") ||
        name === "srcdoc" ||
        (URL_ATTRIBUTES.has(name) && isDangerousUrlAttribute(name, attr.value)) ||
        (name === "style" && DANGEROUS_STYLE_RE.test(attr.value))
      ) {
        el.removeAttribute(attr.name);
      }
    });
  });
  return doc;
}

export function sanitizeEpubHtml(html: string): string {
  if (typeof DOMParser === "undefined") {
    return sanitizeEpubHtmlFallback(html);
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  sanitizeEpubDocument(doc);
  return doc.documentElement.outerHTML;
}

export function extractPlainTextFromEpubHtml(html: string): string {
  const safeHtml = sanitizeEpubHtml(html);
  if (typeof DOMParser === "undefined") {
    return safeHtml
      .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  const doc = new DOMParser().parseFromString(safeHtml, "text/html");
  doc.querySelectorAll("style, nav").forEach((el) => el.remove());
  return (doc.body?.textContent ?? "").replace(/\s+/g, " ").trim();
}
