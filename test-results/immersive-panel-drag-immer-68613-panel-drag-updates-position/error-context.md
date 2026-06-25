# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: immersive-panel-drag.spec.ts >> immersive summary panel drag updates position
- Location: tests/e2e/immersive-panel-drag.spec.ts:3:5

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/debug-immersive
Call log:
  - navigating to "http://localhost:3000/debug-immersive", waiting until "networkidle"

```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | 
  3   | test("immersive summary panel drag updates position", async ({ page }) => {
> 4   |   await page.goto("/debug-immersive", {
      |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/debug-immersive
  5   |     waitUntil: "networkidle",
  6   |   });
  7   | 
  8   |   const handle = page.locator(".summary-panel-drag-handle");
  9   |   await expect(handle).toBeVisible();
  10  | 
  11  |   const panel = page.locator("aside").filter({ has: handle });
  12  |   await expect(panel).toBeVisible();
  13  | 
  14  |   await page.evaluate(() => {
  15  |     const handle = document.querySelector(".summary-panel-drag-handle");
  16  |     if (!handle) throw new Error("Drag handle missing");
  17  |     (window as Window & { __pointerDown: number; __pointerMove: number; __pointerUp: number }).__pointerDown = 0;
  18  |     (window as Window & { __pointerDown: number; __pointerMove: number; __pointerUp: number }).__pointerMove = 0;
  19  |     (window as Window & { __pointerDown: number; __pointerMove: number; __pointerUp: number }).__pointerUp = 0;
  20  | 
  21  |     handle.addEventListener("pointerdown", () => {
  22  |       const w = window as Window & {
  23  |         __pointerDown: number;
  24  |         __pointerMove: number;
  25  |         __pointerUp: number;
  26  |       };
  27  |       w.__pointerDown += 1;
  28  |     });
  29  |     handle.addEventListener("pointermove", () => {
  30  |       const w = window as Window & {
  31  |         __pointerDown: number;
  32  |         __pointerMove: number;
  33  |         __pointerUp: number;
  34  |       };
  35  |       w.__pointerMove += 1;
  36  |     });
  37  |     handle.addEventListener("pointerup", () => {
  38  |       const w = window as Window & {
  39  |         __pointerDown: number;
  40  |         __pointerMove: number;
  41  |         __pointerUp: number;
  42  |       };
  43  |       w.__pointerUp += 1;
  44  |     });
  45  |   });
  46  | 
  47  |   const beforeRect = await panel.boundingBox();
  48  |   const beforeStyle = await panel.evaluate((el) => {
  49  |     const style = getComputedStyle(el);
  50  |     return { position: style.position, left: style.left, top: style.top };
  51  |   });
  52  |   const beforeStyleAttr = await panel.getAttribute("style");
  53  |   expect(beforeRect).not.toBeNull();
  54  | 
  55  |   const handleBox = await handle.boundingBox();
  56  |   if (!handleBox || !beforeRect) {
  57  |     throw new Error("Could not get panel/handle geometry");
  58  |   }
  59  | 
  60  |   const startX = handleBox.x + 6;
  61  |   const startY = handleBox.y + 6;
  62  |   const endX = startX + 120;
  63  |   const endY = startY + 70;
  64  |   const pointerId = 42;
  65  | 
  66  |   await page.dispatchEvent(".summary-panel-drag-handle", "pointerdown", {
  67  |     bubbles: true,
  68  |     clientX: startX,
  69  |     clientY: startY,
  70  |     pointerId,
  71  |     pointerType: "mouse",
  72  |     isPrimary: true,
  73  |     button: 0,
  74  |   });
  75  | 
  76  |   await page.waitForTimeout(50);
  77  | 
  78  |   await page.evaluate(
  79  |     ({ endX, endY, pointerId }) => {
  80  |       const handle = document.querySelector(".summary-panel-drag-handle");
  81  |       if (!handle) throw new Error("Drag handle missing");
  82  | 
  83  |       const move = new PointerEvent("pointermove", {
  84  |         bubbles: true,
  85  |         clientX: endX,
  86  |         clientY: endY,
  87  |         pointerId,
  88  |       });
  89  |       handle.dispatchEvent(move);
  90  | 
  91  |       const up = new PointerEvent("pointerup", {
  92  |         bubbles: true,
  93  |         clientX: endX,
  94  |         clientY: endY,
  95  |         pointerId,
  96  |       });
  97  |       handle.dispatchEvent(up);
  98  |     },
  99  |     { endX, endY, pointerId },
  100 |   );
  101 | 
  102 |   const dragCounters = await page.evaluate(() => ({
  103 |     down: (window as Window & { __pointerDown: number; __pointerMove: number; __pointerUp: number })
  104 |       .__pointerDown,
```