import type { AiSettings, HeadingSectionSummaryRequest } from "@/lib/types";

export const DEFAULT_SUMMARY_SYSTEM_PROMPT =
  "You summarize one passage from an EPUB or PDF section. Use the same language as the source. Be concise: 2–4 bullet points or a short paragraph. Do not invent content beyond the passage.";

export const DEFAULT_SUMMARY_USER_TEMPLATE = `Section title: {title}
Paragraph {index} of {total}

{paragraph}`;

export const DEFAULT_HEADING_SUMMARY_SYSTEM_PROMPT = `You receive the full body text under one heading in an EPUB or PDF section. Do not summarize paragraph by paragraph. Extract what a reader must remember.

Requirements:
1. Keep concepts, definitions, rules, conclusions, and essential examples.
2. Remove padding, repetition, transitions, and filler.
3. Rewrite indirect prose into direct statements.
4. If examples precede a conclusion, state the conclusion clearly.
5. Make implicit logic explicit.
6. Organize steps, categories, and comparisons clearly.
7. Explain terms when they matter.
8. Preserve key code or technical logic when present.
9. Do not invent information not in the source.
10. Do not drop important points for brevity.

Use the same language as the source. Output in Markdown with this structure:

# {heading}

## 必须记住
- ...

## 直白解释
- ...

## 关键结构
- ...

## 容易误解的点
- ...

## 可忽略内容
- ...`;

export const DEFAULT_HEADING_SUMMARY_USER_TEMPLATE = `Chapter: {chapterTitle}
Heading (level {level}): {heading}

Content under this heading:

{content}`;

export const DEFAULT_HEADING_CHUNK_MERGE_SYSTEM_PROMPT =
  "You merge partial summaries of one EPUB or PDF heading section into a single coherent summary. Remove redundancy. Keep the same Markdown section structure. Use the source language. Do not add new facts.";

export const DEFAULT_HEADING_CHUNK_MERGE_USER_TEMPLATE = `Heading: {heading}

Partial summaries:

{partials}`;

export type SummaryPromptVars = {
  title: string;
  paragraph: string;
  index: number;
  total: number;
};

export type HeadingSummaryPromptVars = {
  chapterTitle: string;
  heading: string;
  level: number;
  content: string;
};

export function applySummaryUserTemplate(
  template: string,
  vars: SummaryPromptVars,
): string {
  return template
    .replaceAll("{title}", vars.title)
    .replaceAll("{paragraph}", vars.paragraph)
    .replaceAll("{index}", String(vars.index))
    .replaceAll("{total}", String(vars.total));
}

export function applyHeadingSummaryUserTemplate(
  template: string,
  vars: HeadingSummaryPromptVars,
): string {
  return template
    .replaceAll("{chapterTitle}", vars.chapterTitle)
    .replaceAll("{heading}", vars.heading)
    .replaceAll("{level}", String(vars.level))
    .replaceAll("{content}", vars.content);
}

export function resolveSummaryPrompts(settings: AiSettings): {
  system: string;
  userTemplate: string;
} {
  const system =
    settings.summarySystemPrompt?.trim() || DEFAULT_SUMMARY_SYSTEM_PROMPT;
  const userTemplate =
    settings.summaryUserTemplate?.trim() || DEFAULT_SUMMARY_USER_TEMPLATE;
  return { system, userTemplate };
}

export function applyHeadingSummaryOptions(
  systemPrompt: string,
  options?: HeadingSectionSummaryRequest["options"],
): string {
  if (!options) return systemPrompt;
  const lines: string[] = [];
  if (options.summaryStyle === "must_remember_points") {
    lines.push(
      "Summary style (must_remember_points): focus on concepts, definitions, rules, and conclusions the reader must retain; use the 必须记住 section heavily.",
    );
  }
  if (options.removeRedundancy === true) {
    lines.push(
      "Remove redundancy: cut repeated explanations, padding, and filler; merge duplicate points.",
    );
  }
  if (options.makeImplicitMeaningExplicit === true) {
    lines.push(
      "Make implicit meaning explicit: state unstated assumptions, causal links, and conclusions clearly.",
    );
  }
  if (lines.length === 0) return systemPrompt;
  return `${systemPrompt}\n\nRequest options:\n${lines.map((l) => `- ${l}`).join("\n")}`;
}

export function resolveHeadingSummaryPrompts(settings: AiSettings): {
  system: string;
  userTemplate: string;
  mergeSystem: string;
  mergeUserTemplate: string;
} {
  const system =
    settings.headingSummarySystemPrompt?.trim() ||
    DEFAULT_HEADING_SUMMARY_SYSTEM_PROMPT;
  const userTemplate =
    settings.headingSummaryUserTemplate?.trim() ||
    DEFAULT_HEADING_SUMMARY_USER_TEMPLATE;
  return {
    system,
    userTemplate,
    mergeSystem: DEFAULT_HEADING_CHUNK_MERGE_SYSTEM_PROMPT,
    mergeUserTemplate: DEFAULT_HEADING_CHUNK_MERGE_USER_TEMPLATE,
  };
}
