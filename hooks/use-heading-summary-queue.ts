"use client";

import { useCallback, useMemo, useState } from "react";
import {
  summaryQueueLabelForState,
  summaryQueueStatsForTasks,
} from "@/lib/summary-queue";
import type { SummaryTask } from "@/lib/types";

export function useHeadingSummaryQueue() {
  const [summaryTasks, setSummaryTasks] = useState<SummaryTask[]>([]);
  const [summaryQueuePaused, setSummaryQueuePaused] = useState(false);
  const [autoSummaryOnReading, setAutoSummaryOnReading] = useState(false);

  const pauseSummaryQueue = useCallback(() => {
    setSummaryQueuePaused(true);
  }, []);

  const resumeSummaryQueue = useCallback(() => {
    setSummaryQueuePaused(false);
  }, []);

  const summaryQueueStats = useMemo(
    () => summaryQueueStatsForTasks(summaryTasks),
    [summaryTasks],
  );
  const summaryQueueLabel = useMemo(
    () =>
      summaryQueueLabelForState({
        tasks: summaryTasks,
        paused: summaryQueuePaused,
        stats: summaryQueueStats,
      }),
    [summaryQueuePaused, summaryQueueStats, summaryTasks],
  );

  return {
    summaryTasks,
    setSummaryTasks,
    summaryQueuePaused,
    setSummaryQueuePaused,
    pauseSummaryQueue,
    resumeSummaryQueue,
    summaryQueueStats,
    summaryQueueLabel,
    autoSummaryOnReading,
    setAutoSummaryOnReading,
  };
}
