import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiSettings } from "@/lib/types";

const settingsState = vi.hoisted(() => ({
  current: {
    apiKey: "test-key",
    baseUrl: "https://api.example.test/v1/",
    model: "test-model",
  } as AiSettings,
}));

vi.mock("@/lib/settings", () => ({
  loadAiSettings: () => settingsState.current,
}));

import {
  summarizeParagraph,
  translateSelectedText,
} from "@/lib/summarize-client";

function pendingFetch() {
  return vi.fn((_url: string | URL | Request, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      );
    });
  });
}

describe("summarize client requests", () => {
  beforeEach(() => {
    settingsState.current = {
      apiKey: "test-key",
      baseUrl: "https://api.example.test/v1/",
      model: "test-model",
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("sends OpenAI-compatible chat completions with a cancellable signal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: " Summary text " } }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await summarizeParagraph("Body text", "Chapter", 1, 2, {
      timeoutMs: 0,
    });

    expect(result).toEqual({ summary: "Summary text", model: "test-model" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.test/v1/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.headers).toMatchObject({
      Authorization: "Bearer test-key",
      "Content-Type": "application/json",
    });
    const body = JSON.parse(String(init.body)) as {
      model: string;
      messages: { role: string; content: string }[];
    };
    expect(body.model).toBe("test-model");
    expect(body.messages[1].content).toContain("Body text");
  });

  it("fails hanging model requests with a clear timeout message", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", pendingFetch());

    const request = summarizeParagraph("Body text", "Chapter", 1, 1, {
      timeoutMs: 50,
    });
    const assertion = expect(request).rejects.toThrow("模型请求超时");

    await vi.advanceTimersByTimeAsync(50);
    await assertion;
  });

  it("aborts requests when the caller cancels the summary", async () => {
    const controller = new AbortController();
    vi.stubGlobal("fetch", pendingFetch());

    const request = summarizeParagraph("Body text", "Chapter", 1, 1, {
      signal: controller.signal,
      timeoutMs: 0,
    });
    const assertion = expect(request).rejects.toThrow("总结已取消");
    controller.abort();

    await assertion;
  });

  it("does not send a request if the caller already cancelled it", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      summarizeParagraph("Body text", "Chapter", 1, 1, {
        signal: controller.signal,
      }),
    ).rejects.toThrow("总结已取消");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("translates selected text through the configured chat completion endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: " 你好世界 " } }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await translateSelectedText("Hello world", {
      timeoutMs: 0,
    });

    expect(result).toEqual({ translation: "你好世界", model: "test-model" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.test/v1/chat/completions");
    const body = JSON.parse(String(init.body)) as {
      messages: { role: string; content: string }[];
    };
    expect(body.messages[0].content).toContain("translate selected ebook text");
    expect(body.messages[1].content).toContain("Hello world");
  });
});
