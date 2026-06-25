import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getBrowserSessionItem,
  getBrowserStorageItem,
  setBrowserSessionItem,
  setBrowserStorageItem,
} from "@/lib/browser-storage";

describe("browser storage helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns safe defaults outside the browser", () => {
    vi.stubGlobal("window", undefined);

    expect(getBrowserStorageItem("missing")).toBeNull();
    expect(setBrowserStorageItem("key", "value")).toBe(false);
    expect(getBrowserSessionItem("missing")).toBeNull();
    expect(setBrowserSessionItem("key", "value")).toBe(false);
  });

  it("reads and writes localStorage when available", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => {
          values.set(key, value);
        },
      },
    });

    expect(setBrowserStorageItem("key", "value")).toBe(true);
    expect(getBrowserStorageItem("key")).toBe("value");
    expect(values.get("key")).toBe("value");
  });

  it("reads and writes sessionStorage for tab-scoped state", () => {
    const localValues = new Map<string, string>();
    const sessionValues = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => localValues.get(key) ?? null,
        setItem: (key: string, value: string) => {
          localValues.set(key, value);
        },
      },
      sessionStorage: {
        getItem: (key: string) => sessionValues.get(key) ?? null,
        setItem: (key: string, value: string) => {
          sessionValues.set(key, value);
        },
      },
    });

    expect(setBrowserSessionItem("active-book", "tab-book")).toBe(true);
    expect(getBrowserSessionItem("active-book")).toBe("tab-book");
    expect(sessionValues.get("active-book")).toBe("tab-book");
    expect(localValues.get("active-book")).toBeUndefined();
  });

  it("falls back to memory storage when localStorage throws", () => {
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

    expect(setBrowserStorageItem("blocked-key", "value")).toBe(false);
    expect(getBrowserStorageItem("blocked-key")).toBe("value");
  });

  it("prefers a same-session fallback write over stale localStorage", () => {
    const values = new Map<string, string>([["stale-key", "old"]]);
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: () => {
          throw new Error("quota exceeded");
        },
      },
    });

    expect(setBrowserStorageItem("stale-key", "new")).toBe(false);
    expect(getBrowserStorageItem("stale-key")).toBe("new");
    expect(values.get("stale-key")).toBe("old");
  });
});
