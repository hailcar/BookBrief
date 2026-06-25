import {
  getBrowserStorageItem,
  setBrowserStorageItem,
} from "@/lib/browser-storage";

export type ReaderFontSize = "small" | "default" | "large";
export type ReaderContentWidth = "narrow" | "standard" | "wide" | "full";
export type ReaderImageMode = "contain" | "original" | "full-width";

export type ReaderSettings = {
  fontSize: ReaderFontSize;
  contentWidth: ReaderContentWidth;
  imageMode: ReaderImageMode;
};

const KEY = "summary_epub_reader_settings";

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  fontSize: "default",
  contentWidth: "standard",
  imageMode: "contain",
};

export const READER_FONT_SIZE_PX: Record<ReaderFontSize, number> = {
  small: 15,
  default: 17,
  large: 19,
};

export const READER_CONTENT_MAX_PX: Record<ReaderContentWidth, number> = {
  narrow: 680,
  standard: 920,
  wide: 1080,
  full: 1440,
};

export const READER_FONT_SIZE_LABELS: Record<ReaderFontSize, string> = {
  small: "小",
  default: "默认",
  large: "大",
};

export const READER_CONTENT_WIDTH_LABELS: Record<ReaderContentWidth, string> = {
  narrow: "窄",
  standard: "标准",
  wide: "宽",
  full: "满宽",
};

export const READER_IMAGE_MODE_LABELS: Record<ReaderImageMode, string> = {
  contain: "完整",
  original: "原始",
  "full-width": "满宽",
};

function isFontSize(v: string): v is ReaderFontSize {
  return v === "small" || v === "default" || v === "large";
}

function isContentWidth(v: string): v is ReaderContentWidth {
  return v === "narrow" || v === "standard" || v === "wide" || v === "full";
}

function isImageMode(v: string): v is ReaderImageMode {
  return v === "contain" || v === "original" || v === "full-width";
}

export function loadReaderSettings(): ReaderSettings {
  try {
    const raw = getBrowserStorageItem(KEY);
    if (!raw) return DEFAULT_READER_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ReaderSettings>;
    const fontSize = parsed.fontSize;
    const contentWidth = parsed.contentWidth;
    const imageMode = parsed.imageMode;
    return {
      fontSize:
        fontSize !== undefined && isFontSize(fontSize)
          ? fontSize
          : DEFAULT_READER_SETTINGS.fontSize,
      contentWidth:
        contentWidth !== undefined && isContentWidth(contentWidth)
          ? contentWidth
          : DEFAULT_READER_SETTINGS.contentWidth,
      imageMode:
        imageMode !== undefined && isImageMode(imageMode)
          ? imageMode
          : DEFAULT_READER_SETTINGS.imageMode,
    };
  } catch {
    return DEFAULT_READER_SETTINGS;
  }
}

export function saveReaderSettings(settings: ReaderSettings): boolean {
  return setBrowserStorageItem(KEY, JSON.stringify(settings));
}

/** Stable reference for useSyncExternalStore — must not return a new object every call. */
let cachedReaderSnapshot: ReaderSettings = DEFAULT_READER_SETTINGS;
let cachedReaderKey = "";

export function getReaderSettingsSnapshot(): ReaderSettings {
  if (typeof window === "undefined") return DEFAULT_READER_SETTINGS;
  const next = loadReaderSettings();
  const key = `${next.fontSize}\0${next.contentWidth}\0${next.imageMode}`;
  if (key === cachedReaderKey) return cachedReaderSnapshot;
  cachedReaderKey = key;
  cachedReaderSnapshot = next;
  return cachedReaderSnapshot;
}

export function invalidateReaderSettingsSnapshot(): void {
  cachedReaderKey = "";
}
