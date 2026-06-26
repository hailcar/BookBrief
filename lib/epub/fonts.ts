import JSZip from "jszip";

export type EpubFontStyle = "normal" | "italic" | "oblique";

export type EpubFontFace = {
  family: string;
  url: string;
  weight: number;
  style: EpubFontStyle;
  format: "opentype" | "truetype" | "woff" | "woff2";
  path: string;
};

const FONT_EXTENSIONS = new Set(["otf", "ttf", "woff", "woff2"]);
const MAX_FONT_ASSETS = 24;
const MAX_FONT_BYTES = 5 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  otf: "font/otf",
  ttf: "font/ttf",
  woff: "font/woff",
  woff2: "font/woff2",
};

const FORMAT_BY_EXTENSION: Record<string, EpubFontFace["format"]> = {
  otf: "opentype",
  ttf: "truetype",
  woff: "woff",
  woff2: "woff2",
};

const WEIGHT_WORDS: Record<string, number> = {
  thin: 100,
  extralight: 200,
  ultralight: 200,
  light: 300,
  regular: 400,
  normal: 400,
  book: 400,
  roman: 400,
  medium: 500,
  semibold: 600,
  demibold: 600,
  bold: 700,
  extrabold: 800,
  ultrabold: 800,
  black: 900,
  heavy: 900,
};

const STYLE_WORDS = new Set(["italic", "ital", "oblique"]);

function fileNameFromPath(path: string): string {
  return path.split("/").pop() ?? path;
}

function extensionFromPath(path: string): string | null {
  return path.match(/\.([^.]+)$/)?.[1]?.toLowerCase() ?? null;
}

function splitFontName(path: string): string[] {
  const base = fileNameFromPath(path).replace(/\.[^.]+$/, "");
  return base
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function compactName(path: string): string {
  return fileNameFromPath(path)
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

function knownFamily(path: string): string | null {
  const compact = compactName(path);
  if (compact.startsWith("dejavuserif")) return "DejaVu Serif";
  if (compact.startsWith("dejavusansmono")) return "DejaVu Sans Mono";
  if (compact.startsWith("dejavusans")) return "DejaVu Sans";
  if (compact.startsWith("ubuntumono")) return "Ubuntu Mono";
  if (compact.startsWith("sourceserif4")) return "Source Serif 4";
  if (compact.startsWith("sourcecodepro")) return "Source Code Pro";
  if (compact.startsWith("sourcesans3")) return "Source Sans 3";
  if (compact.startsWith("notoserif")) return "Noto Serif";
  if (compact.startsWith("notosans")) return "Noto Sans";
  return null;
}

export function inferEpubFontFace(path: string, url: string): EpubFontFace | null {
  const extension = extensionFromPath(path);
  if (!extension || !FONT_EXTENSIONS.has(extension)) return null;

  const parts = splitFontName(path);
  const familyParts = parts.filter((part) => {
    const normalized = part.toLowerCase().replace(/[^a-z0-9]/g, "");
    return !(normalized in WEIGHT_WORDS) && !STYLE_WORDS.has(normalized);
  });
  const fallbackFamily = familyParts.join(" ").trim() || fileNameFromPath(path);
  const family = knownFamily(path) ?? fallbackFamily;

  const normalizedWords = parts.map((part) =>
    part.toLowerCase().replace(/[^a-z0-9]/g, ""),
  );
  const weight =
    normalizedWords
      .map((word) => WEIGHT_WORDS[word])
      .find((value): value is number => typeof value === "number") ?? 400;
  const style = normalizedWords.includes("oblique")
    ? "oblique"
    : normalizedWords.some((word) => STYLE_WORDS.has(word))
      ? "italic"
      : "normal";

  return {
    family,
    url,
    weight,
    style,
    format: FORMAT_BY_EXTENSION[extension],
    path,
  };
}

export async function extractEpubFontFaces(
  arrayBuffer: ArrayBuffer,
): Promise<EpubFontFace[]> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const entries = Object.values(zip.files)
    .filter((entry) => {
      if (entry.dir) return false;
      const extension = extensionFromPath(entry.name);
      return !!extension && FONT_EXTENSIONS.has(extension);
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, MAX_FONT_ASSETS);

  const faces: EpubFontFace[] = [];
  for (const entry of entries) {
    const extension = extensionFromPath(entry.name);
    if (!extension) continue;
    const bytes = await entry.async("uint8array");
    if (bytes.byteLength > MAX_FONT_BYTES) continue;
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const blob = new Blob([buffer], {
      type: MIME_BY_EXTENSION[extension] ?? "application/octet-stream",
    });
    const url = URL.createObjectURL(blob);
    const face = inferEpubFontFace(entry.name, url);
    if (face) {
      faces.push(face);
    } else {
      URL.revokeObjectURL(url);
    }
  }
  return faces;
}

export function revokeEpubFontFaces(faces: EpubFontFace[]): void {
  for (const face of faces) {
    URL.revokeObjectURL(face.url);
  }
}
