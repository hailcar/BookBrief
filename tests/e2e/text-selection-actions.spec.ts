import { expect, test } from "@playwright/test";

test("left-drag text selection shows comment and translate actions", async ({
  page,
}) => {
  await page.goto("/debug-selection", { waitUntil: "networkidle" });

  const frameElement = page.locator("iframe").first();
  await expect(frameElement).toBeVisible();
  await page.waitForTimeout(700);
  const frame = page.frames().find((item) => item.url() === "about:srcdoc");
  if (!frame) throw new Error("Debug EPUB iframe is missing");

  const firstParagraph = frame.locator('[data-se-block-id="debug-p-1"]');
  const secondParagraph = frame.locator('[data-se-block-id="debug-p-2"]');
  await expect(firstParagraph).toBeVisible();
  await expect(secondParagraph).toBeVisible();

  const start = await firstParagraph.boundingBox();
  const end = await secondParagraph.boundingBox();
  if (!start || !end) throw new Error("Could not read paragraph geometry");

  const client = await page.context().newCDPSession(page);
  const startPoint = { x: start.x + 12, y: start.y + start.height / 2 };
  const endPoint = { x: end.x + end.width - 12, y: end.y + end.height / 2 };
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: startPoint.x,
    y: startPoint.y,
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: startPoint.x,
    y: startPoint.y,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  for (let i = 1; i <= 8; i += 1) {
    const t = i / 8;
    await client.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: startPoint.x + (endPoint.x - startPoint.x) * t,
      y: startPoint.y + (endPoint.y - startPoint.y) * t,
      button: "left",
      buttons: 1,
    });
  }
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: endPoint.x,
    y: endPoint.y,
    button: "left",
    buttons: 0,
    clickCount: 1,
  });

  await expect(frame.getByRole("button", { name: "添加评论" })).toBeVisible();
  await expect(frame.getByRole("button", { name: "翻译" })).toBeVisible();

  await frame.getByRole("button", { name: "添加评论" }).click();
  await expect(page.locator("#selection-action-state")).toHaveText(
    "comment:debug-p-1,debug-p-2",
  );
});
