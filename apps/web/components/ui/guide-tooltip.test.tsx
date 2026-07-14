import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "./button";

describe("GuideTooltip", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows plain-language guidance after a deliberate mouse hover", () => {
    vi.useFakeTimers();
    render(
      <Button tooltip="Creates the final reel from your selected clips.">
        Render reel
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Render reel" });
    const trigger = button.closest('[data-slot="guide-tooltip-trigger"]');
    expect(trigger).not.toBeNull();
    expect(document.querySelector(".guide-tooltip")).toBeNull();

    fireEvent.pointerEnter(trigger!, { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(419));
    expect(document.querySelector(".guide-tooltip")).toBeNull();

    act(() => vi.advanceTimersByTime(1));
    expect(document.querySelector(".guide-tooltip")?.textContent).toContain(
      "Creates the final reel from your selected clips.",
    );

    fireEvent.pointerLeave(trigger!, { pointerType: "mouse" });
    expect(document.querySelector(".guide-tooltip")).toBeNull();
  });

  it("describes disabled actions and opens guidance from keyboard focus", () => {
    vi.useFakeTimers();
    render(
      <>
        <Button disabled tooltip="Approve the storyboard before rendering.">
          Render reel
        </Button>
        <Button tooltip="Saves your current scene edits.">Save changes</Button>
      </>,
    );

    const disabledButton = screen.getByRole("button", {
      name: "Render reel",
    });
    const descriptionId = disabledButton.getAttribute("aria-describedby");
    expect(descriptionId).toBeTruthy();
    expect(document.getElementById(descriptionId!)?.textContent).toBe(
      "Approve the storyboard before rendering.",
    );

    const saveButton = screen.getByRole("button", { name: "Save changes" });
    fireEvent.focus(saveButton);
    act(() => vi.runOnlyPendingTimers());
    expect(document.querySelector(".guide-tooltip")?.textContent).toContain(
      "Saves your current scene edits.",
    );

    fireEvent.keyDown(saveButton, { key: "Escape" });
    expect(document.querySelector(".guide-tooltip")).toBeNull();
  });
});
