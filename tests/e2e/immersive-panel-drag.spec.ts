import { test, expect } from "@playwright/test";

type PointerCounterWindow = Window & {
  __pointerDown: number;
  __pointerMove: number;
  __pointerUp: number;
};

test("immersive summary panel drag updates position", async ({ page }) => {
  await page.goto("/debug-immersive", {
    waitUntil: "networkidle",
  });

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
