import { expect, test } from "@playwright/test";

import { E2E_PROJECT_PREFIX } from "./project-cleanup";

test("opens the final-only media library from the studio", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Media library/ }).click();

  await expect(page).toHaveURL(/\/library$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Media library" }),
  ).toBeVisible();
  await expect(page.getByText(/Every final merged video/)).toBeVisible();
  await expect(
    page.getByText(/Only completed, fully merged MP4 exports/),
  ).toBeVisible();
});

test("creates and navigates a URL-first project", async ({ page }) => {
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
  await page.route("**/api/projects/*/brand-kit", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          job: { id: "e2e-brand-kit-job" },
          brandKit: null,
        }),
      });
      return;
    }
    await route.continue();
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
  await page.getByRole("tab", { name: /^Brand/ }).click();
  await expect(page.getByText("Brand Kit Agent")).toBeVisible();
  await page.getByRole("tab", { name: "Assets Anytime" }).click();
  await expect(page.getByRole("heading", { name: "Assets" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Source material" }),
  ).toBeVisible();

  await expect(page.getByText("Website slot filled")).toBeVisible();
  await expect(
    page
      .getByText("Website slot filled")
      .locator("..")
      .getByText("https://example.com"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Add URL" })).toBeDisabled();

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
  await page.getByRole("tab", { name: "Assets Anytime" }).click();

  await expect(
    page
      .getByText("Website slot filled")
      .locator("..")
      .getByText("https://example.com"),
  ).toBeVisible();
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

test("persists Cinematic Boost in project settings", async ({ request }) => {
  const name = `${E2E_PROJECT_PREFIX} Cinematic boost ${Date.now()}`;
  const response = await request.post("/api/projects", {
    data: { name, businessName: "Cinematic Brand", generateBrandKit: false },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { project: { id: string } };

  const update = await request.patch(`/api/projects/${payload.project.id}`, {
    data: { cinematicBoost: true },
  });
  expect(update.ok()).toBeTruthy();

  const reloaded = await request.get(`/api/projects/${payload.project.id}`);
  expect(reloaded.ok()).toBeTruthy();
  const reloadedPayload = (await reloaded.json()) as {
    project: { cinematicBoost: boolean };
  };
  expect(reloadedPayload.project.cinematicBoost).toBe(true);
});

test("creates a Razzmatazz product showcase with a required product image", async ({
  page,
}) => {
  const projectName = `${E2E_PROJECT_PREFIX} Product showcase ${Date.now()}`;
  await page.route("**/api/projects/*/brand-kit", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          job: { id: "e2e-brand-kit-job" },
          brandKit: null,
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/");
  await page.getByRole("button", { name: /Product showcase/ }).click();
  await page.getByLabel("Enable Razzmatazz mode").check();
  await expect(page.getByText("Locked by Razzmatazz")).toBeVisible();
  await page.getByLabel("Product 1 name").fill("Midnight Burger");
  await page
    .getByLabel("Product 1 details")
    .fill("Double patty, cheddar, pickles, and a toasted brioche bun.");
  await page.getByLabel("Product image").setInputFiles({
    name: "burger.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page.getByText("Customize project settings").click();
  await page.getByLabel("Project name").fill(projectName);
  await page.getByLabel("Business name").fill("E2E Foods");
  await page
    .getByRole("button", { name: "Create project & Brand Kit" })
    .click();

  await expect(page).toHaveURL(/\/projects\/.+/);
  await expect(
    page.getByRole("heading", { level: 1, name: projectName }),
  ).toBeVisible();
  await expect(
    page.getByText("Three seconds. One unforgettable hero moment."),
  ).toBeVisible();
  await expect(
    page.getByText("Midnight Burger", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Razzmatazz", { exact: true })).toBeVisible();
  await expect(page.getByText("1 scene · 5 seconds")).toBeVisible();
});
