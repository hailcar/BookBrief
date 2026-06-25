import { afterEach, describe, expect, it, vi } from "vitest";
import { loadAiSettings, saveAiSettings } from "@/lib/settings";

describe("AI settings storage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps AI settings usable when localStorage writes fail", () => {
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
      saveAiSettings({
        apiKey: "sk-test",
        baseUrl: "https://api.example.test/v1",
        model: "model-a",
      }),
    ).toBe(false);
    expect(loadAiSettings()).toMatchObject({
      apiKey: "sk-test",
      baseUrl: "https://api.example.test/v1",
      model: "model-a",
    });
  });
});
