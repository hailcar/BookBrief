import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_READER_SETTINGS,
  getReaderSettingsSnapshot,
  invalidateReaderSettingsSnapshot,
  loadReaderSettings,
  saveReaderSettings,
} from "@/lib/reader-settings";

describe("getReaderSettingsSnapshot", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    invalidateReaderSettingsSnapshot();
  });

  it("returns the same object reference when called twice without invalidation", () => {
    invalidateReaderSettingsSnapshot();
    const a = getReaderSettingsSnapshot();
    const b = getReaderSettingsSnapshot();
    expect(a).toBe(b);
  });

  it("server snapshot is DEFAULT_READER_SETTINGS", () => {
    expect(DEFAULT_READER_SETTINGS.fontSize).toBe("default");
    expect(DEFAULT_READER_SETTINGS.fontFamily).toBe("book");
  });

  it("keeps reader settings usable when localStorage writes fail", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      },
    });

    expect(
      saveReaderSettings({
        fontSize: "large",
        fontFamily: "serif",
        contentWidth: "wide",
        imageMode: "full-width",
      }),
    ).toBe(false);
    expect(loadReaderSettings()).toEqual({
      fontSize: "large",
      fontFamily: "serif",
      contentWidth: "wide",
      imageMode: "full-width",
    });
  });
});
