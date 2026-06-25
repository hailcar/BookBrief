import type { DocumentFormat } from "@/lib/types";

const FALLBACK_EPUB_FILE_NAME = "downloaded.epub";
const FALLBACK_PDF_FILE_NAME = "downloaded.pdf";

function stripPathSegments(value: string): string {
  return value.replace(/\\/g, "/").split("/").pop() ?? "";
}

function decodeFileName(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function cleanFileName(value: string): string {
  return cleanFileNameCandidate(value) ?? FALLBACK_EPUB_FILE_NAME;
}

function cleanFileNameCandidate(value: string): string | null {
  const base = stripPathSegments(value)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"|?*]/g, "_")
    .trim();

  if (!base || base === "." || base === "..") {
    return null;
  }
  return base;
}

export function fileNameFromContentDisposition(
  disposition: string | null,
): string | null {
  if (!disposition) return null;

  const utf8Match = disposition.match(/filename\*=(?:UTF-8)?(?:'[^']*')?("?[^;]+"?)/i);
  if (utf8Match?.[1]) {
    return cleanFileName(
      decodeFileName(utf8Match[1].trim().replace(/^"|"$/g, "")),
    );
  }

  const asciiMatch = disposition.match(
    /filename\s*=\s*(?:"([^"]+)"|([^;\s]+))/i,
  );
  const raw = asciiMatch?.[1] ?? asciiMatch?.[2];
  return raw ? cleanFileName(raw) : null;
}

export function fileNameFromEpubUrl(
  rawUrl: string,
  disposition: string | null = null,
): string {
  const fromHeader = fileNameFromContentDisposition(disposition);
  if (fromHeader) return ensureEpubExtension(fromHeader);

  try {
    const url = new URL(rawUrl);
    const pathName = cleanFileName(
      decodeFileName(url.pathname.split("/").pop() ?? ""),
    );
    if (pathName) return ensureEpubExtension(pathName);
  } catch {
    /* caller handles invalid URL */
  }

  return FALLBACK_EPUB_FILE_NAME;
}

function supportedFormatFromFileName(fileName: string): DocumentFormat | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".epub")) return "epub";
  if (lower.endsWith(".pdf")) return "pdf";
  return null;
}

function fallbackFileName(format: DocumentFormat): string {
  return format === "pdf" ? FALLBACK_PDF_FILE_NAME : FALLBACK_EPUB_FILE_NAME;
}

function formatFromContentType(contentType: string | null): DocumentFormat | null {
  if (!contentType) return null;
  const lower = contentType.toLowerCase();
  if (lower.includes("application/pdf")) return "pdf";
  if (
    lower.includes("application/epub+zip") ||
    lower.includes("application/x-epub+zip")
  ) {
    return "epub";
  }
  return null;
}

export function ensureDocumentExtension(
  fileName: string,
  defaultFormat: DocumentFormat = "epub",
): string {
  const cleanName = cleanFileNameCandidate(fileName) ?? fallbackFileName(defaultFormat);
  if (supportedFormatFromFileName(cleanName)) return cleanName;
  return `${cleanName}.${defaultFormat}`;
}

export function fileNameFromDocumentUrl(
  rawUrl: string,
  disposition: string | null = null,
  contentType: string | null = null,
): string {
  const defaultFormat = formatFromContentType(contentType) ?? "epub";
  const fromHeader = fileNameFromContentDisposition(disposition);
  if (fromHeader) {
    return ensureDocumentExtension(
      fromHeader,
      supportedFormatFromFileName(fromHeader) ?? defaultFormat,
    );
  }

  try {
    const url = new URL(rawUrl);
    const pathName = cleanFileNameCandidate(
      decodeFileName(url.pathname.split("/").pop() ?? ""),
    );
    if (pathName) {
      return ensureDocumentExtension(
        pathName,
        supportedFormatFromFileName(pathName) ?? defaultFormat,
      );
    }
  } catch {
    /* caller handles invalid URL */
  }

  return fallbackFileName(defaultFormat);
}

export function supportedFileNameFromDocumentUrlPath(
  rawUrl: string,
): string | null {
  try {
    const url = new URL(rawUrl);
    const pathName = cleanFileNameCandidate(
      decodeFileName(url.pathname.split("/").pop() ?? ""),
    );
    return pathName && supportedFormatFromFileName(pathName)
      ? pathName
      : null;
  } catch {
    return null;
  }
}

export function ensureEpubExtension(fileName: string): string {
  const cleanName = cleanFileName(fileName);
  return cleanName.toLowerCase().endsWith(".epub")
    ? cleanName
    : `${cleanName}.epub`;
}

export function assertHttpDocumentUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("请输入有效的 EPUB/PDF URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("EPUB/PDF URL 只支持 http 或 https");
  }

  return url.toString();
}

export function assertHttpEpubUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("请输入有效的 EPUB URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("EPUB URL 只支持 http 或 https");
  }

  return url.toString();
}
