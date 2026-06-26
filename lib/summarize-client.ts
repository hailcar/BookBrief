import type { HeadingSectionSummaryRequest } from "@/lib/types";
import { loadAiSettings } from "@/lib/settings";
import { splitTextForChunks } from "@/lib/epub/blocks";
import {
  applyHeadingSummaryOptions,
  applyHeadingSummaryUserTemplate,
  applySummaryUserTemplate,
  resolveHeadingSummaryPrompts,
  resolveSummaryPrompts,
} from "@/lib/summary-prompt";

const PARAGRAPH_MAX_CHARS = 12000;
const HEADING_CHUNK_MAX_CHARS = 10000;
const SELECTED_BLOCK_SUMMARY_CHUNK_MAX_CHARS = 10000;
export const AI_REQUEST_TIMEOUT_MS = 120000;

export type SummarizeProgress = {
  phase: "chunk" | "merge" | "paragraph";
  done: number;
  total: number;
  message?: string;
};

export type SummarizeRequestOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error("总结已取消");
  }
}

function modelConnectionErrorMessage(baseUrl: string): string {
  return [
    "模型请求失败：浏览器无法连接 Base URL。",
    "请检查 Base URL 是否完整并以 /v1 结尾、服务是否可访问，以及供应商是否允许浏览器 CORS 跨域请求。",
    `当前 Base URL：${baseUrl}`,
  ].join(" ");
}

async function responseErrorText(res: Response): Promise<string> {
  const contentType = res.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const data = (await res.json()) as {
        error?: { message?: unknown; type?: unknown; code?: unknown };
        message?: unknown;
      };
      const message =
        typeof data.error?.message === "string"
          ? data.error.message
          : typeof data.message === "string"
            ? data.message
            : "";
      const code =
        typeof data.error?.code === "string" ? ` (${data.error.code})` : "";
      return `${message}${code}`.trim();
    }
    return (await res.text()).trim();
  } catch {
    return "";
  }
}

async function modelHttpErrorMessage(
  res: Response,
  settings: { baseUrl: string; model: string },
): Promise<string> {
  const detail = (await responseErrorText(res)).slice(0, 300);
  const suffix = detail ? ` 服务返回：${detail}` : "";
  if (res.status === 401 || res.status === 403) {
    return `模型请求失败 (${res.status})：API Key 无效、权限不足或账户不可用。请检查设置中的 API Key 和供应商权限。${suffix}`;
  }
  if (res.status === 404) {
    return `模型请求失败 (404)：未找到 /chat/completions。请检查 Base URL 是否指向 OpenAI-compatible /v1 接口。当前 Base URL：${settings.baseUrl}.${suffix}`;
  }
  if (res.status === 400 || res.status === 422) {
    return `模型请求失败 (${res.status})：请求参数或 Model 可能不被该供应商支持。当前 Model：${settings.model}.${suffix}`;
  }
  if (res.status === 429) {
    return `模型请求失败 (429)：请求过于频繁、额度不足或被限流。请稍后重试或检查供应商额度。${suffix}`;
  }
  if (res.status >= 500) {
    return `模型请求失败 (${res.status})：供应商服务暂时不可用。请稍后重试或换用其他 Base URL。${suffix}`;
  }
  return `模型请求失败 (${res.status})：请检查 Base URL、API Key、Model 和 CORS 设置。${suffix}`;
}

async function chatCompletion(
  system: string,
  userContent: string,
  options: SummarizeRequestOptions = {},
): Promise<{ text: string; model: string }> {
  throwIfAborted(options.signal);
  const settings = loadAiSettings();
  const apiKey = settings.apiKey.trim();
  if (!apiKey) {
    throw new Error("请先在「设置」中填写 API Key（仅存于本机浏览器）。");
  }

  const baseUrl = settings.baseUrl.trim().replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("请先在「设置」中填写 Base URL。");
  }
  const model = settings.model.trim();
  if (!model) {
    throw new Error("请先在「设置」中填写 Model。");
  }
  const timeoutMs = options.timeoutMs ?? AI_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const abortFromParent = () => controller.abort();

  options.signal?.addEventListener("abort", abortFromParent, { once: true });
  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
      }),
    });
  } catch (err) {
    if (controller.signal.aborted) {
      if (timedOut) {
        const timeoutSeconds = Math.max(1, Math.ceil(timeoutMs / 1000));
        throw new Error(
          `模型请求超时（${timeoutSeconds} 秒），请稍后重试或换用响应更快的 Base URL。`,
        );
      }
      throw new Error("总结已取消");
    }
    if (err instanceof TypeError) {
      throw new Error(modelConnectionErrorMessage(baseUrl));
    }
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    options.signal?.removeEventListener("abort", abortFromParent);
  }

  if (!res.ok) {
    throw new Error(await modelHttpErrorMessage(res, { baseUrl, model }));
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("模型返回为空");

  return { text, model };
}

/** Single paragraph mode (legacy). */
export async function summarizeParagraph(
  paragraph: string,
  title: string,
  index: number,
  total: number,
  options: SummarizeRequestOptions = {},
): Promise<{ summary: string; model: string }> {
  const settings = loadAiSettings();
  const { system, userTemplate } = resolveSummaryPrompts(settings);
  const excerpt =
    paragraph.length > PARAGRAPH_MAX_CHARS
      ? `${paragraph.slice(0, PARAGRAPH_MAX_CHARS)}…`
      : paragraph;

  const userContent = applySummaryUserTemplate(userTemplate, {
    title,
    paragraph: excerpt,
    index,
    total,
  });

  const { text, model } = await chatCompletion(system, userContent, options);
  return { summary: text, model };
}

export async function summarizeHeadingSection(
  request: HeadingSectionSummaryRequest,
  chapterTitle: string,
  onProgress?: (p: SummarizeProgress, accumulatedText: string) => void,
  options: SummarizeRequestOptions = {},
): Promise<{
  summary: string;
  model: string;
  chunked: boolean;
}> {
  throwIfAborted(options.signal);
  const settings = loadAiSettings();
  const { system, userTemplate, mergeSystem, mergeUserTemplate } =
    resolveHeadingSummaryPrompts(settings);
  const systemPrompt = applyHeadingSummaryOptions(system, request.options);
  const mergeSystemPrompt = applyHeadingSummaryOptions(
    mergeSystem,
    request.options,
  );

  const body =
    request.content.markdownText.trim() || request.content.plainText.trim();
  if (!body) {
    throw new Error("该标题下没有可总结的正文");
  }

  const chunks = splitTextForChunks(body, HEADING_CHUNK_MAX_CHARS);
  const chunked = chunks.length > 1;

  if (!chunked) {
    const userContent = applyHeadingSummaryUserTemplate(userTemplate, {
      chapterTitle,
      heading: request.heading.text,
      level: request.heading.level,
      content: body,
    });
    onProgress?.(
      { phase: "chunk", done: 1, total: 1 },
      "",
    );
    const { text, model } = await chatCompletion(
      systemPrompt,
      userContent,
      options,
    );
    return { summary: text, model, chunked: false };
  }

  const partials: string[] = [];
  let model = "";
  const total = chunks.length;

  for (let i = 0; i < total; i++) {
    throwIfAborted(options.signal);
    onProgress?.(
      {
        phase: "chunk",
        done: i,
        total: total + 1,
        message: "内容较长，已自动分块总结",
      },
      partials.join("\n\n---\n\n"),
    );
    const userContent = applyHeadingSummaryUserTemplate(userTemplate, {
      chapterTitle,
      heading: `${request.heading.text}（块 ${i + 1}/${total}）`,
      level: request.heading.level,
      content: chunks[i],
    });
    const { text, model: m } = await chatCompletion(
      systemPrompt,
      userContent,
      options,
    );
    model = m;
    partials.push(text);
    onProgress?.(
      {
        phase: "chunk",
        done: i + 1,
        total: total + 1,
        message: "内容较长，已自动分块总结",
      },
      partials.join("\n\n---\n\n"),
    );
  }

  const mergeUser = mergeUserTemplate
    .replaceAll("{heading}", request.heading.text)
    .replaceAll("{partials}", partials.map((p, i) => `### 块 ${i + 1}\n${p}`).join("\n\n"));

  onProgress?.(
    { phase: "merge", done: total, total: total + 1, message: "正在合并分块总结…" },
    partials.join("\n\n---\n\n"),
  );

  throwIfAborted(options.signal);
  const { text: merged, model: mergeModel } = await chatCompletion(
    mergeSystemPrompt,
    mergeUser,
    options,
  );
  model = mergeModel || model;

  onProgress?.(
    { phase: "merge", done: total + 1, total: total + 1 },
    merged,
  );

  return { summary: merged, model, chunked: true };
}

export async function summarizeSectionParagraphs(
  paragraphs: string[],
  title: string,
  onProgress?: (done: number, total: number, accumulatedText: string) => void,
  options: SummarizeRequestOptions = {},
): Promise<{ summary: string; model: string }> {
  if (paragraphs.length === 0) {
    throw new Error("本章没有可总结的段落文本");
  }

  const total = paragraphs.length;
  const parts: string[] = [];
  let model = "";

  for (let i = 0; i < total; i++) {
    throwIfAborted(options.signal);
    const { summary, model: m } = await summarizeParagraph(
      paragraphs[i],
      title,
      i + 1,
      total,
      options,
    );
    model = m;
    const header = total > 1 ? `【段 ${i + 1}/${total}】\n` : "";
    parts.push(`${header}${summary}`);
    onProgress?.(i + 1, total, parts.join("\n\n"));
  }

  return {
    summary: parts.join("\n\n"),
    model,
  };
}

export async function summarizeSelectedBlocks(
  blocks: { id: string; text: string }[],
  onProgress?: (done: number, total: number, accumulatedText: string) => void,
  options: SummarizeRequestOptions = {},
): Promise<{ summary: string; model: string; chunked: boolean }> {
  if (blocks.length === 0) {
    throw new Error("请先选择要总结的段落");
  }

  const chunks: { id: string; text: string }[][] = [];
  let current: { id: string; text: string }[] = [];
  let currentChars = 0;
  for (const block of blocks) {
    const nextChars = block.text.length + 32;
    if (
      current.length &&
      currentChars + nextChars > SELECTED_BLOCK_SUMMARY_CHUNK_MAX_CHARS
    ) {
      chunks.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(block);
    currentChars += nextChars;
  }
  if (current.length) chunks.push(current);

  const system = [
    "You summarize only the selected EPUB passages provided by the user.",
    "Do not summarize the whole section or infer from missing context.",
    "Preserve key facts, people, claims, causal links, chronology, and unresolved questions.",
    "Use Markdown with concise headings or bullets when helpful.",
    "Write in the source language by default; use Chinese if the selected passages or user's reading context are Chinese.",
  ].join(" ");

  const partials: string[] = [];
  let model = "";
  for (let i = 0; i < chunks.length; i++) {
    throwIfAborted(options.signal);
    const body = chunks[i]
      .map((block, index) => `[[段落 ${index + 1} | ${block.id}]]\n${block.text}`)
      .join("\n\n");
    const { text, model: m } = await chatCompletion(
      system,
      [
        "请只总结下面选中的段落，不要总结整个小节或页面。",
        "保留关键事实、人物、因果关系和重要细节；避免复述原文。",
        chunks.length > 1 ? `这是分块 ${i + 1}/${chunks.length}。` : "",
        "",
        body,
      ].join("\n"),
      options,
    );
    model = m;
    partials.push(text);
    onProgress?.(i + 1, chunks.length, partials.join("\n\n---\n\n"));
  }

  if (partials.length === 1) {
    return { summary: partials[0], model, chunked: false };
  }

  onProgress?.(partials.length, partials.length + 1, partials.join("\n\n---\n\n"));
  throwIfAborted(options.signal);
  const { text: merged, model: mergeModel } = await chatCompletion(
    system,
    [
      "下面是同一组选中段落的分块总结。请合并为一个 Markdown 总结。",
      "去除重复，保留关键事实、人物、因果关系和重要细节。",
      "不要加入未出现在分块总结中的整节背景。",
      "",
      partials.map((part, index) => `### 分块 ${index + 1}\n${part}`).join("\n\n"),
    ].join("\n"),
    options,
  );

  return { summary: merged, model: mergeModel || model, chunked: true };
}

export async function translateSelectedText(
  selectedText: string,
  options: SummarizeRequestOptions = {},
): Promise<{ translation: string; model: string }> {
  const text = selectedText.trim();
  if (!text) {
    throw new Error("请先选择要翻译的文字");
  }
  const excerpt =
    text.length > SELECTED_BLOCK_SUMMARY_CHUNK_MAX_CHARS
      ? text.slice(0, SELECTED_BLOCK_SUMMARY_CHUNK_MAX_CHARS)
      : text;
  const { text: translated, model } = await chatCompletion(
    [
      "You translate selected ebook text for a reader.",
      "Translate into fluent Simplified Chinese unless the source text is already Chinese; if already Chinese, provide a concise English translation.",
      "Return only the translation, without explanations, markdown fences, or extra labels.",
      "Preserve names, code, symbols, and formatting-sensitive terminology.",
    ].join(" "),
    ["请翻译下面选中的文字，只返回译文：", "", excerpt].join("\n"),
    options,
  );
  return { translation: translated, model };
}
