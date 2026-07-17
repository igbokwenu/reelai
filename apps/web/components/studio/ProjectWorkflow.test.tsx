import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectWorkflow } from "./ProjectWorkflow";

const router = { refresh: vi.fn() };

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

describe("ProjectWorkflow", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps stage state mounted while changing the visible panel", () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    Element.prototype.scrollIntoView = vi.fn();

    const { container } = render(
      <ProjectWorkflow
        assets={<p>Asset library</p>}
        brand={<p>Brand kit</p>}
        concepts={<p>Creative concepts</p>}
        final={<p>Final render</p>}
        finalComplete={false}
        hasBrandKit
        hasSelectedConcept
        latestAutoRun={null}
        production={<p>Production console</p>}
        productionComplete={false}
        projectId="project-1"
        storyboard={
          <input aria-label="Storyboard draft" defaultValue="Opening beat" />
        }
        storyboardStatus={null}
      />,
    );

    const draft = screen.getByRole("textbox", {
      name: "Storyboard draft",
    }) as HTMLInputElement;
    fireEvent.change(draft, { target: { value: "Edited opening beat" } });
    fireEvent.click(screen.getByRole("tab", { name: /Concepts/ }));

    expect(
      container
        .querySelector(".workflow-panels")
        ?.getAttribute("data-active-stage"),
    ).toBe("concepts");
    expect(document.body.contains(screen.getByText("Creative concepts"))).toBe(
      true,
    );
    expect(draft.value).toBe("Edited opening beat");

    fireEvent.click(screen.getByRole("tab", { name: /Storyboard/ }));
    expect(draft.value).toBe("Edited opening beat");
  });

  it("presents a focused production room while Auto mode owns the run", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => undefined)),
    );

    render(
      <ProjectWorkflow
        assets={<p>Asset library</p>}
        brand={<p>Brand kit</p>}
        concepts={<p>Creative concepts</p>}
        final={<p>Final render</p>}
        finalComplete={false}
        hasBrandKit
        hasSelectedConcept
        latestAutoRun={{
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
        }}
        production={<p>Production console</p>}
        productionComplete={false}
        projectId="project-1"
        storyboard={<p>Storyboard editor</p>}
        storyboardStatus={null}
      />,
    );

    expect(
      screen.getByText("Automatic production has the controls"),
    ).toBeDefined();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByText("Storyboard editor")).toBeNull();
    expect(screen.queryByText("Production console")).toBeNull();
    expect(screen.queryByRole("button", { name: "Review details" })).toBeNull();
  });

  it("locks downstream stages until their prerequisite is complete", () => {
    render(
      <ProjectWorkflow
        assets={<p>Asset library</p>}
        brand={<p>Brand kit</p>}
        concepts={<p>Creative concepts</p>}
        final={<p>Final render</p>}
        finalComplete={false}
        hasBrandKit={false}
        hasSelectedConcept={false}
        latestAutoRun={null}
        production={<p>Production console</p>}
        productionComplete={false}
        projectId="project-1"
        storyboard={<p>Storyboard editor</p>}
        storyboardStatus={null}
      />,
    );

    expect(
      (screen.getByRole("tab", { name: /Concepts/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("tab", { name: /Storyboard/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("tab", { name: /Production/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("tab", { name: /Final/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("tab", { name: /Assets/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
});
