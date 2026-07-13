import { expect, test } from "@playwright/test";

import { E2E_PROJECT_PREFIX } from "./project-cleanup";

test("creates and navigates a URL-first project", async ({
  page,
}) => {
  const projectName = `${E2E_PROJECT_PREFIX} URL intake ${Date.now()} reel`;
  await page.route("**/api/projects", async (route) => {
    const request = route.request();

    if (request.method() !== "POST") {
      await route.continue();
      return;
    }

    // Keep browser tests deterministic and immediately deletable. Brand Kit
    // generation calls an external model and is intentionally kept outside
    // this project-intake and workflow-navigation smoke test.
    const payload = request.postDataJSON() as Record<string, unknown>;
    await route.continue({
      postData: JSON.stringify({ ...payload, generateBrandKit: false }),
    });
  });
  await page.goto("/");

  await page.getByLabel("Company website").fill("https://example.com");
  await page
    .getByLabel("Anything to keep in mind? Optional")
    .fill("Keep the tone direct and practical.");
  await page.getByText("Customize project settings").click();
  await page.getByLabel("Project name").fill(projectName);
  await page
    .getByRole("button", { name: "Create project & Brand Kit" })
    .click();

  await expect(page).toHaveURL(/\/projects\/.+/);
  await expect(
    page.getByRole("heading", { level: 1, name: projectName }),
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
  const name = `${E2E_PROJECT_PREFIX} Disposable project ${Date.now()}`;
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
