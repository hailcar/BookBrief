"use client";

import { renderMarkdownToHtml } from "@/lib/markdown";

type Props = {
  content: string;
  className?: string;
};

export function SummaryMarkdown({ content, className }: Props) {
  return (
    <div
      className={`summary-markdown text-sm leading-relaxed ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(content) }}
    />
  );
}
