import { test, expect, type Page } from "@playwright/test";

type PointerCounterWindow = Window & {
  __pointerDown: number;
  __pointerMove: number;
  __pointerUp: number;
};

async function openCollapsedSummaryButton(page: Page) {
  const collapsedButton = page.locator(".summary-panel-collapsed-drag-handle");
  await expect(collapsedButton).toBeVisible();
  await collapsedButton.click();
  await expect(page.locator(".summary-panel-drag-handle")).toBeVisible();
}

test("immersive summary panel starts collapsed in the top-right corner", async ({
  page,
}) => {
  await page.goto("/debug-immersive", {
    waitUntil: "networkidle",
  });

  await expect(page.locator("aside")).toHaveCount(0);

  const collapsedButton = page.locator(".summary-panel-collapsed-drag-handle");
  await expect(collapsedButton).toBeVisible();

  const box = await collapsedButton.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThan(viewport!.width - box!.width - 40);
  expect(box!.y).toBeLessThan(40);
});

test("immersive summary panel drag updates position", async ({ page }) => {
  await page.goto("/debug-immersive", {
    waitUntil: "networkidle",
  });

  await openCollapsedSummaryButton(page);

  const handle = page.locator(".summary-panel-drag-handle");
  await expect(handle).toBeVisible();

  const panel = page.locator("aside").filter({ has: handle });
  await expect(panel).toBeVisible();

  await page.evaluate(() => {
    const handle = document.querySelector(".summary-panel-drag-handle");
    if (!handle) throw new Error("Drag handle missing");
    const counters = window as unknown as PointerCounterWindow;
    counters.__pointerDown = 0;
    counters.__pointerMove = 0;
    counters.__pointerUp = 0;

    handle.addEventListener("pointerdown", () => {
      const w = window as unknown as PointerCounterWindow;
      w.__pointerDown += 1;
    });
    handle.addEventListener("pointermove", () => {
      const w = window as unknown as PointerCounterWindow;
      w.__pointerMove += 1;
    });
    handle.addEventListener("pointerup", () => {
      const w = window as unknown as PointerCounterWindow;
      w.__pointerUp += 1;
    });
  });

  const beforeRect = await panel.boundingBox();
  const beforeStyle = await panel.evaluate((el) => {
    const style = getComputedStyle(el);
    return { position: style.position, left: style.left, top: style.top };
  });
  const beforeStyleAttr = await panel.getAttribute("style");
  expect(beforeRect).not.toBeNull();

  const handleBox = await handle.boundingBox();
  if (!handleBox || !beforeRect) {
    throw new Error("Could not get panel/handle geometry");
  }

  const startX = handleBox.x + 6;
  const startY = handleBox.y + 6;
  const endX = startX + 120;
  const endY = startY + 70;
  const pointerId = 42;

  await page.dispatchEvent(".summary-panel-drag-handle", "pointerdown", {
    bubbles: true,
    clientX: startX,
    clientY: startY,
    pointerId,
    pointerType: "mouse",
    isPrimary: true,
    button: 0,
  });

  await page.waitForTimeout(50);

  await page.evaluate(
    ({ endX, endY, pointerId }) => {
      const handle = document.querySelector(".summary-panel-drag-handle");
      if (!handle) throw new Error("Drag handle missing");

      const move = new PointerEvent("pointermove", {
        bubbles: true,
        clientX: endX,
        clientY: endY,
        pointerId,
      });
      handle.dispatchEvent(move);

      const up = new PointerEvent("pointerup", {
        bubbles: true,
        clientX: endX,
        clientY: endY,
        pointerId,
      });
      handle.dispatchEvent(up);
    },
    { endX, endY, pointerId },
  );

  const dragCounters = await page.evaluate(() => ({
    down: (window as unknown as PointerCounterWindow).__pointerDown,
    move: (window as unknown as PointerCounterWindow).__pointerMove,
    up: (window as unknown as PointerCounterWindow).__pointerUp,
  }));
  console.log("pointer events", dragCounters);

  const afterRect = await panel.boundingBox();
  const afterStyle = await panel.evaluate((el) => {
    const style = getComputedStyle(el);
    return { position: style.position, left: style.left, top: style.top };
  });
  const afterStyleAttr = await panel.getAttribute("style");

  expect(afterRect).not.toBeNull();
  console.log("before", beforeRect, beforeStyle, beforeStyleAttr);
  console.log("after", afterRect, afterStyle, afterStyleAttr);
  expect(afterStyle.position).toBe("fixed");
  expect(beforeRect).not.toEqual(afterRect);
  expect(beforeRect!.x).not.toBe(afterRect!.x);
  expect(beforeRect!.y).not.toBe(afterRect!.y);
});

test("immersive summary panel keeps position after reload", async ({ page }) => {
  await page.goto("/debug-immersive", {
    waitUntil: "networkidle",
  });

  await openCollapsedSummaryButton(page);

  const handle = page.locator(".summary-panel-drag-handle");
  const panel = page.locator("aside").filter({ has: handle });
  await expect(panel).toBeVisible();

  const handleBox = await handle.boundingBox();
  if (!handleBox) {
    throw new Error("Could not get panel handle geometry");
  }

  const startX = handleBox.x + 8;
  const startY = handleBox.y + 8;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 120, startY + 70, { steps: 5 });
  await page.mouse.up();

  const movedRect = await panel.boundingBox();
  expect(movedRect).not.toBeNull();

  await page.reload({ waitUntil: "networkidle" });

  const restoredHandle = page.locator(".summary-panel-drag-handle");
  const restoredPanel = page.locator("aside").filter({ has: restoredHandle });
  await expect(restoredPanel).toBeVisible();

  const restoredRect = await restoredPanel.boundingBox();
  expect(restoredRect).not.toBeNull();
  expect(Math.abs(restoredRect!.x - movedRect!.x)).toBeLessThan(2);
  expect(Math.abs(restoredRect!.y - movedRect!.y)).toBeLessThan(2);
});

test("collapsed immersive summary button remains draggable without reopening", async ({
  page,
}) => {
  await page.goto("/debug-immersive", {
    waitUntil: "networkidle",
  });

  const collapsedButton = page.locator(".summary-panel-collapsed-drag-handle");
  await expect(collapsedButton).toBeVisible();

  const beforeRect = await collapsedButton.boundingBox();
  if (!beforeRect) {
    throw new Error("Could not get collapsed button geometry");
  }

  const startX = beforeRect.x + beforeRect.width / 2;
  const startY = beforeRect.y + beforeRect.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 120, startY + 70, { steps: 5 });
  await page.mouse.up();

  await expect(collapsedButton).toBeVisible();
  await expect(page.locator("aside")).toHaveCount(0);

  const afterRect = await collapsedButton.boundingBox();
  expect(afterRect).not.toBeNull();
  expect(afterRect!.x).not.toBe(beforeRect.x);
  expect(afterRect!.y).not.toBe(beforeRect.y);
});

test("dragging expanded panel does not block reopening from collapsed button", async ({
  page,
}) => {
  await page.goto("/debug-immersive", {
    waitUntil: "networkidle",
  });

  await openCollapsedSummaryButton(page);

  const handle = page.locator(".summary-panel-drag-handle");
  await expect(handle).toBeVisible();

  const handleBox = await handle.boundingBox();
  if (!handleBox) {
    throw new Error("Could not get panel handle geometry");
  }

  const startX = handleBox.x + 8;
  const startY = handleBox.y + 8;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 80, startY + 50, { steps: 4 });
  await page.mouse.up();

  await page.getByRole("button", { name: "收起 AI 总结" }).click();

  const collapsedButton = page.locator(".summary-panel-collapsed-drag-handle");
  await expect(collapsedButton).toBeVisible();
  await collapsedButton.click();

  await expect(handle).toBeVisible();
});
