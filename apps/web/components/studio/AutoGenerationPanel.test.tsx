import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AutoGenerationPanel, type AutoRunView } from "./AutoGenerationPanel";

const refresh = vi.fn();
const router = { refresh };

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

const initialRun: AutoRunView = {
  id: "auto-1",
  status: "RUNNING",
  phase: "STORYBOARD",
  currentJobId: null,
  attempt: 0,
  maxAttempts: 3,
  nextAttemptAt: null,
  error: null,
  startedAt: "2026-07-15T10:00:00.000Z",
  completedAt: null,
};

describe("AutoGenerationPanel", () => {
  beforeEach(() => {
    refresh.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("updates progress before refreshing server data when a phase advances", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        run: { ...initialRun, phase: "KEYFRAMES" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const view = render(
      <AutoGenerationPanel
        initialRun={initialRun}
        onReviewStage={vi.fn()}
        projectId="project-1"
      />,
    );

    await waitFor(() =>
      expect(screen.getByText("Designing the visual world")).toBeDefined(),
    );

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    view.unmount();
  });
});
