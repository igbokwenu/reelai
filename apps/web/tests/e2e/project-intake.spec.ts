import { expect, test } from "@playwright/test";

test("creates a URL-first project and starts Brand Kit research", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByLabel("Company website").fill("https://example.com");
  await page
    .getByLabel("Anything to keep in mind? Optional")
    .fill("Keep the tone direct and practical.");
  await page
    .getByRole("button", { name: "Create project & Brand Kit" })
    .click();

  await expect(page).toHaveURL(/\/projects\/.+/);
  await expect(
    page.getByRole("heading", { level: 1, name: /reel$/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Brand/ }).click();
  await expect(page.getByText("Brand Kit Agent")).toBeVisible();
  await page.getByRole("button", { name: "Assets Anytime" }).click();
  await expect(page.getByRole("heading", { name: "Assets" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Source material" }),
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
  await page.getByRole("button", { name: "Assets Anytime" }).click();

  await expect(page.getByText("https://example.com/about")).toBeVisible();
  await expect(page.getByText("image/png")).toBeVisible();
});

test("requires confirmation before deleting a project", async ({
  page,
  request,
}) => {
  const name = `Disposable project ${Date.now()}`;
  const response = await request.post("/api/projects", {
    data: { name, businessName: "Disposable Brand", generateBrandKit: false },
  });
  expect(response.ok()).toBeTruthy();

  await page.goto("/");
  await page.getByRole("button", { name: `Delete ${name}` }).click();
  await expect(page.getByRole("dialog")).toContainText(`Delete “${name}”?`);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: `Delete ${name}` }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete project" })
    .click();
  await expect(page.getByText(name, { exact: true })).toHaveCount(0);
});
