import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MediaLibrary, type LibraryProject } from "./MediaLibrary";

const projects: LibraryProject[] = [
  {
    id: "project-brand",
    name: "Summer Brand Reel",
    businessName: "Northstar Coffee",
    outputMode: "STANDARD",
    style: "REALISTIC",
    videoLengthSec: 30,
    outputs: [
      {
        id: "render-2",
        artifactId: "artifact-2",
        thumbnailArtifactId: "thumbnail-2",
        label: "Latest final",
        isLatest: true,
        isCurrent: true,
        completedAt: "2026-07-16T12:00:00.000Z",
        durationSec: 30,
        format: "9:16",
        width: 1080,
        height: 1920,
        aiDisclosureEnabled: true,
        bgmEnabled: true,
      },
      {
        id: "render-1",
        artifactId: "artifact-1",
        thumbnailArtifactId: null,
        label: "Final cut 01",
        isLatest: false,
        isCurrent: false,
        completedAt: "2026-07-15T12:00:00.000Z",
        durationSec: 30,
        format: "9:16",
        width: 1080,
        height: 1920,
        aiDisclosureEnabled: true,
        bgmEnabled: false,
      },
    ],
  },
  {
    id: "project-product",
    name: "Hero Bottle",
    businessName: "Aster Labs",
    outputMode: "PRODUCT_SHOWCASE",
    style: "THREE_D_ANIMATION",
    videoLengthSec: 10,
    outputs: [
      {
        id: "render-3",
        artifactId: "artifact-3",
        thumbnailArtifactId: "thumbnail-3",
        label: "Latest final",
        isLatest: true,
        isCurrent: true,
        completedAt: "2026-07-14T12:00:00.000Z",
        durationSec: 10,
        format: "9:16",
        width: 1080,
        height: 1920,
        aiDisclosureEnabled: false,
        bgmEnabled: false,
      },
    ],
  },
];

describe("MediaLibrary", () => {
  it("groups final outputs by their originating project", () => {
    render(<MediaLibrary projects={projects} />);

    expect(
      screen.getByRole("heading", { name: "Summer Brand Reel" }),
    ).toBeDefined();
    expect(screen.getByRole("heading", { name: "Hero Bottle" })).toBeDefined();
    expect(screen.getAllByText("Latest final")).toHaveLength(2);
    expect(screen.getByText("Final cut 01")).toBeDefined();
    expect(screen.getByText("Previous version")).toBeDefined();
    expect(
      screen.getByText(/Showing 3 finished videos across 2 projects/),
    ).toBeDefined();
  });

  it("filters by output type and project search", () => {
    render(<MediaLibrary projects={projects} />);

    fireEvent.click(screen.getByRole("button", { name: "Product showcases" }));
    expect(
      screen.queryByRole("heading", { name: "Summer Brand Reel" }),
    ).toBeNull();
    expect(screen.getByRole("heading", { name: "Hero Bottle" })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "All finals" }));
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search projects" }),
      {
        target: { value: "Northstar" },
      },
    );
    expect(
      screen.getByRole("heading", { name: "Summer Brand Reel" }),
    ).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Hero Bottle" })).toBeNull();
  });

  it("opens a focused viewer for the selected final", () => {
    render(<MediaLibrary projects={projects} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Play Summer Brand Reel, Latest final",
      }),
    );

    expect(
      screen.getByRole("dialog", { name: /Summer Brand Reel/ }),
    ).toBeDefined();
    expect(
      screen.getByRole("link", { name: "Download MP4" }).getAttribute("href"),
    ).toBe("/api/artifacts/artifact-2/file");

    fireEvent.click(screen.getByRole("button", { name: "Close video viewer" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
