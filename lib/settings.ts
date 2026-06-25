import type { AiSettings } from "@/lib/types";
import {
  getBrowserStorageItem,
  setBrowserStorageItem,
} from "@/lib/browser-storage";

const KEY = "summary_epub_ai_settings";

import {
  DEFAULT_HEADING_SUMMARY_SYSTEM_PROMPT,
  DEFAULT_HEADING_SUMMARY_USER_TEMPLATE,
  DEFAULT_SUMMARY_SYSTEM_PROMPT,
  DEFAULT_SUMMARY_USER_TEMPLATE,
} from "@/lib/summary-prompt";

const defaults: AiSettings = {
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  summarySystemPrompt: DEFAULT_SUMMARY_SYSTEM_PROMPT,
  summaryUserTemplate: DEFAULT_SUMMARY_USER_TEMPLATE,
  headingSummarySystemPrompt: DEFAULT_HEADING_SUMMARY_SYSTEM_PROMPT,
  headingSummaryUserTemplate: DEFAULT_HEADING_SUMMARY_USER_TEMPLATE,
};

export function loadAiSettings(): AiSettings {
  try {
    const raw = getBrowserStorageItem(KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

export function saveAiSettings(settings: AiSettings): boolean {
  return setBrowserStorageItem(KEY, JSON.stringify(settings));
}
