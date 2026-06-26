import { expect, test, type Page } from "@playwright/test";

async function expectRootLandingVisible(page: Page) {
  await expect(page.getByRole("heading", { name: "BookBrief" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "打开一本 EPUB 或 PDF 开始" }),
  ).toBeVisible();
}

test("root page ignores old localStorage fullscreen state when no book is open", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("summary_epub_reader_fullscreen", "1");
    sessionStorage.removeItem("summary_epub_reader_fullscreen");
    sessionStorage.removeItem("summary_epub_active_book_id");
  });

  await page.reload({ waitUntil: "networkidle" });

  await expectRootLandingVisible(page);
});

test("root page stays visible when session fullscreen state has no active book", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    sessionStorage.setItem("summary_epub_reader_fullscreen", "1");
    sessionStorage.removeItem("summary_epub_active_book_id");
  });

  await page.reload({ waitUntil: "networkidle" });

  await expectRootLandingVisible(page);
});
