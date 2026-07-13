import { describe, expect, it } from "vitest";

import {
  isStalePollClaim,
  hasExactSceneCoverage,
  parseVideoJobOutput,
  resolveSelectedFrameTakes,
  selectRequestedScenes,
  selectVideoGenerationTargets,
  stableSceneStatus,
  summarizeVideoTasks,
} from "./production-state";

describe("production state", () => {
  it("keeps polling healthy tasks when a sibling task has failed", () => {
    expect(
      summarizeVideoTasks([
        {
          sceneId: "scene-1",
          takeId: "take-1",
          taskId: "task-1",
          status: "WAITING_PROVIDER",
        },
        {
          sceneId: "scene-2",
          takeId: "take-2",
          status: "FAILED",
          error: "Rejected",
        },
      ]),
    ).toEqual({
      status: "WAITING_PROVIDER",
      terminal: false,
      hasFailed: true,
    });
  });

  it("rejects malformed persisted provider state", () => {
    expect(
      parseVideoJobOutput({
        scenes: [
          { sceneId: "scene-1", takeId: "take-1", status: "WAITING_PROVIDER" },
        ],
      }),
    ).toBeNull();
  });

  it("preserves a previous completed clip after a retry failure", () => {
    expect(stableSceneStatus("previous-video-take")).toBe("COMPLETE");
    expect(stableSceneStatus(null)).toBe("APPROVED");
  });

  it("only recovers abandoned polling claims after the stale window", () => {
    const now = new Date("2026-07-13T12:02:00.000Z");
    expect(isStalePollClaim(new Date("2026-07-13T12:00:00.000Z"), now)).toBe(
      true,
    );
    expect(isStalePollClaim(new Date("2026-07-13T12:01:30.001Z"), now)).toBe(
      false,
    );
  });

  it("does not silently reuse stale frames after an edit clears selections", () => {
    expect(
      resolveSelectedFrameTakes({
        selectedStartTakeId: null,
        selectedEndTakeId: null,
        takes: [frameTake("start", "KEYFRAME_START", 1)],
      }),
    ).toBeNull();
  });

  it("reads a legacy matched pair without mixing generation attempts", () => {
    const start = frameTake("start-2", "KEYFRAME_START", 2);
    const end = frameTake("end-2", "KEYFRAME_END", 2);

    expect(
      resolveSelectedFrameTakes({
        selectedStartTakeId: start.id,
        selectedEndTakeId: null,
        takes: [frameTake("end-3", "KEYFRAME_END", 3), end, start],
      }),
    ).toEqual({ start, end });
  });

  it("rejects an invalid explicit end selection instead of falling back", () => {
    expect(
      resolveSelectedFrameTakes({
        selectedStartTakeId: "start",
        selectedEndTakeId: "missing-end",
        takes: [
          frameTake("start", "KEYFRAME_START", 1),
          frameTake("other-end", "KEYFRAME_END", 1),
        ],
      }),
    ).toBeNull();
  });

  it("requires persisted tasks to cover the whole storyboard exactly once", () => {
    const tasks = [
      { sceneId: "scene-1", takeId: "take-1", status: "FAILED" as const },
      { sceneId: "scene-2", takeId: "take-2", status: "FAILED" as const },
    ];

    expect(hasExactSceneCoverage(tasks, ["scene-1", "scene-2"])).toBe(true);
    expect(hasExactSceneCoverage(tasks, ["scene-1", "scene-3"])).toBe(false);
    expect(
      hasExactSceneCoverage([tasks[0], tasks[0]], ["scene-1", "scene-2"]),
    ).toBe(false);
  });

  it("selects only the ordered scenes requested by a targeted retry", () => {
    const scenes = [{ id: "scene-1" }, { id: "scene-2" }];

    expect(selectRequestedScenes(scenes, ["scene-2"])).toEqual([
      { id: "scene-2" },
    ]);
    expect(selectRequestedScenes(scenes, ["missing"])).toBeNull();
    expect(selectRequestedScenes(scenes, ["scene-1", "scene-1"])).toBeNull();
  });

  it("generates only missing clips while retaining recreate-all behavior", () => {
    const missing = videoScene("scene-1", false);
    const complete = videoScene("scene-2", true);

    expect(selectVideoGenerationTargets([missing, complete])).toEqual([
      missing,
    ]);
    expect(selectVideoGenerationTargets([complete])).toEqual([complete]);
  });
});

function frameTake(
  id: string,
  kind: "KEYFRAME_START" | "KEYFRAME_END",
  attempt: number,
) {
  return {
    id,
    kind,
    attempt,
    status: "COMPLETE",
    artifactId: `${id}-artifact`,
  };
}

function videoScene(id: string, complete: boolean) {
  const takeId = `${id}-video`;
  return {
    id,
    selectedVideoTakeId: complete ? takeId : null,
    takes: complete
      ? [
          {
            id: takeId,
            kind: "VIDEO",
            status: "COMPLETE",
            artifactId: `${takeId}-artifact`,
          },
        ]
      : [],
  };
}
