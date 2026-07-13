import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectWorkflow } from "./ProjectWorkflow";

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
        production={<p>Production console</p>}
        productionComplete={false}
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
});
