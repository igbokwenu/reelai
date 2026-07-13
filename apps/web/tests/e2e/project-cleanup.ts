import type { FullConfig } from "@playwright/test";

export const E2E_PROJECT_PREFIX = "[ReelAI E2E]";

/**
 * Remove projects owned by the browser suite before and after a run.
 *
 * Playwright intentionally reuses an already-running local dev server, which
 * also means it uses that server's database. Keeping test projects explicitly
 * tagged makes cleanup safe for both local and deployed smoke tests.
 */
export default async function cleanupE2EProjects(config: FullConfig) {
  const baseURL =
    config.projects[0]?.use.baseURL ??
    process.env.PLAYWRIGHT_BASE_URL ??
    "http://127.0.0.1:3000";
  const response = await fetch(new URL("/api/projects", baseURL));

  if (!response.ok) {
    throw new Error(`Could not list E2E projects (HTTP ${response.status})`);
  }

  const body = (await response.json()) as {
    projects: Array<{ id: string; name: string }>;
  };
  const projects = body.projects.filter((project) =>
    project.name.startsWith(E2E_PROJECT_PREFIX),
  );
  const results = await Promise.all(
    projects.map(async (project) => ({
      project,
      response: await fetch(new URL(`/api/projects/${project.id}`, baseURL), {
        method: "DELETE",
      }),
    })),
  );

  for (const result of results) {
    if (!result.response.ok) {
      console.warn("Could not remove an E2E project", {
        projectId: result.project.id,
        status: result.response.status,
      });
    }
  }
}
