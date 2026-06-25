import { describe, expect, it } from "vitest";
import {
  summaryQueueLabelForState,
  summaryQueueStatsForTasks,
} from "@/lib/summary-queue";
import type { SummaryTask } from "@/lib/types";

function task(status: SummaryTask["status"]): SummaryTask {
  return {
    id: status,
    bookId: "b1",
    chapterId: "s1",
    headingId: "h1",
    headingText: "Heading",
    headingLevel: 2,
    blockIds: [],
    contentHash: "hash",
    mode: "manual",
    status,
    retryCount: 0,
    createdAt: "now",
    updatedAt: "now",
  };
}

describe("summary queue labels", () => {
  it("counts skipped tasks as cached", () => {
    const stats = summaryQueueStatsForTasks([
      task("queued"),
      task("running"),
      task("skipped"),
      task("failed"),
    ]);

    expect(stats).toMatchObject({
      queued: 1,
      running: 1,
      skipped: 1,
      failed: 1,
      cached: 1,
    });
  });

  it("formats active and paused labels", () => {
    const tasks = [task("queued")];

    expect(summaryQueueLabelForState({ tasks, paused: true })).toBe(
      "总结队列已暂停 · 排队 1",
    );
    expect(summaryQueueLabelForState({ tasks, paused: false })).toContain(
      "总结队列：运行 0 · 排队 1",
    );
  });
});
