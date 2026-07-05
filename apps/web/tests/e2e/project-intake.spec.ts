import { expect, test } from "@playwright/test";

test("creates a project and registers a source", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Project name").fill(`Playwright Reel ${Date.now()}`);
  await page.getByLabel("Business name").fill("Signal Loom Studio");
  await page.getByLabel("Website URL").fill("https://example.com");
  await page
    .getByLabel("Target audience")
    .fill("Operators launching short-form product ads");
  await page
    .getByLabel("Offer")
    .fill("A fast studio workflow for vertical reels");
  await page.getByRole("button", { name: "Create project" }).click();

  await expect(page).toHaveURL(/\/projects\/.+/);
  await expect(page.getByText("Project Sources")).toBeVisible();
  await expect(
    page.locator("header").getByText("Signal Loom Studio"),
  ).toBeVisible();

  await page
    .getByPlaceholder("https://brand.example/about")
    .fill("https://example.com/about");
  await page
    .getByPlaceholder("About page, press kit, product page")
    .fill("About page");
  await page.getByRole("button", { name: "Add URL" }).click();

  await expect(page.getByText("https://example.com/about")).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page.getByRole("button", { name: "Store source" }).click();

  await expect(page.getByText("image/png")).toBeVisible();

  await page.reload();

  await expect(page.getByText("https://example.com/about")).toBeVisible();
  await expect(page.getByText("image/png")).toBeVisible();
});
