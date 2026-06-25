"use client";

import { useState } from "react";
import { ImmersiveSummaryPanel } from "@/components/immersive-summary-panel";

export default function DebugImmersivePage() {
  const [reactChecked, setReactChecked] = useState(false);

  return (
    <main className="min-h-screen bg-neutral-100 p-4">
      <button
        id="react-check-btn"
        className="mb-2 rounded border px-3 py-1 text-sm"
        onClick={() => {
          setReactChecked((value) => !value);
          (window as Window & { __reactCheck?: number }).__reactCheck =
            ((window as Window & { __reactCheck?: number }).__reactCheck ?? 0) + 1;
        }}
      >
        React 点击测试
      </button>
      <p id="react-check-state">{reactChecked ? "clicked" : "idle"}</p>
      <ImmersiveSummaryPanel
        sectionTitle="示例章节"
        summaryText="用于回归测试的示例总结内容。"
        summary={null}
        isSummaryPlaceholder
        summaries={[]}
        activeSummaryId={null}
        summarizing={false}
        summarizeDisabled={false}
        selectedBlockCount={0}
        onSummarizeCurrent={() => {
          // no-op for debug harness
        }}
        onClearSelection={() => {
          // no-op for debug harness
        }}
        onExpandSelectionRange={() => {
          // no-op for debug harness
        }}
        onDeleteSummary={() => {
          // no-op for debug harness
        }}
        onSelectSummary={() => {
          // no-op for debug harness
        }}
      />
    </main>
  );
}
