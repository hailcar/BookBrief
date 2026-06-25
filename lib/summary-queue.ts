import type { SummaryQueueStats, SummaryTask } from "@/lib/types";

export function summaryQueueStatsForTasks(
  tasks: SummaryTask[],
): SummaryQueueStats {
  return tasks.reduce<SummaryQueueStats>(
    (acc, task) => {
      acc[task.status] += 1;
      if (task.status === "skipped") acc.cached += 1;
      return acc;
    },
    {
      queued: 0,
      running: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      cancelled: 0,
      cached: 0,
    },
  );
}

export function summaryQueueLabelForState({
  tasks,
  paused,
  stats = summaryQueueStatsForTasks(tasks),
}: {
  tasks: SummaryTask[];
  paused: boolean;
  stats?: SummaryQueueStats;
}): string {
  if (tasks.length === 0) return "";
  if (paused) return `总结队列已暂停 · 排队 ${stats.queued}`;
  return `总结队列：运行 ${stats.running} · 排队 ${stats.queued} · 成功 ${stats.success} · 缓存 ${stats.cached} · 失败 ${stats.failed}`;
}
