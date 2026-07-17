export type VideoSceneTask = {
  sceneId: string;
  takeId: string;
  taskId?: string;
  status: "WAITING_PROVIDER" | "COMPLETE" | "FAILED";
  artifactId?: string;
  error?: string;
};

export type VideoJobOutput = {
  scenes: VideoSceneTask[];
};

type SceneWithVideoTakes = {
  selectedVideoTakeId: string | null;
  takes: Array<{
    id: string;
    kind: string;
    status: string;
    artifactId: string | null;
  }>;
};

type SceneWithKeyframeTakes = {
  index: number;
  selectedKeyframeTakeId: string | null;
  takes: Array<{
    id: string;
    kind: string;
    status: string;
    artifactId: string | null;
  }>;
};

export function parseVideoJobOutput(value: unknown): VideoJobOutput | null {
  if (!isRecord(value) || !Array.isArray(value.scenes)) return null;

  const scenes: VideoSceneTask[] = [];
  for (const candidate of value.scenes) {
    if (!isRecord(candidate)) return null;

    const { sceneId, takeId, taskId, status, artifactId, error } = candidate;
    if (
      typeof sceneId !== "string" ||
      typeof takeId !== "string" ||
      !isTaskStatus(status)
    ) {
      return null;
    }
    if (status !== "FAILED" && typeof taskId !== "string") return null;
    if (status === "COMPLETE" && typeof artifactId !== "string") return null;

    scenes.push({
      sceneId,
      takeId,
      status,
      ...(typeof taskId === "string" ? { taskId } : {}),
      ...(typeof artifactId === "string" ? { artifactId } : {}),
      ...(typeof error === "string" ? { error } : {}),
    });
  }

  return scenes.length > 0 ? { scenes } : null;
}

export function summarizeVideoTasks(tasks: VideoSceneTask[]) {
  const hasWaiting = tasks.some((task) => task.status === "WAITING_PROVIDER");
  const hasFailed = tasks.some((task) => task.status === "FAILED");

  if (hasWaiting) {
    return { status: "WAITING_PROVIDER" as const, terminal: false, hasFailed };
  }
  if (hasFailed || tasks.length === 0) {
    return { status: "FAILED" as const, terminal: true, hasFailed: true };
  }
  return { status: "COMPLETE" as const, terminal: true, hasFailed: false };
}

export function hasExactSceneCoverage(
  tasks: VideoSceneTask[],
  expectedSceneIds: string[],
) {
  if (tasks.length !== expectedSceneIds.length) return false;
  const actual = new Set(tasks.map((task) => task.sceneId));
  const expected = new Set(expectedSceneIds);
  return (
    actual.size === tasks.length &&
    expected.size === expectedSceneIds.length &&
    expectedSceneIds.every((sceneId) => actual.has(sceneId))
  );
}

export function selectRequestedScenes<T extends { id: string }>(
  scenes: T[],
  requestedSceneIds: string[],
): T[] | null {
  if (
    requestedSceneIds.length === 0 ||
    new Set(requestedSceneIds).size !== requestedSceneIds.length
  ) {
    return null;
  }

  const sceneById = new Map(scenes.map((scene) => [scene.id, scene]));
  const requested = requestedSceneIds.map((sceneId) => sceneById.get(sceneId));
  return requested.every((scene): scene is T => Boolean(scene))
    ? requested
    : null;
}

export function selectVideoGenerationTargets<T extends SceneWithVideoTakes>(
  scenes: T[],
) {
  const missing = scenes.filter(
    (scene) =>
      !scene.takes.some(
        (take) =>
          take.id === scene.selectedVideoTakeId &&
          take.kind === "VIDEO" &&
          take.status === "COMPLETE" &&
          Boolean(take.artifactId),
      ),
  );

  // Once every clip is complete, the global action intentionally means
  // "recreate all". While partial, it spends only on missing scenes.
  return missing.length > 0 ? missing : scenes;
}

/** Scene 1 is already paid for at concept time and is reused verbatim. */
export function selectKeyframeGenerationTargets<
  T extends SceneWithKeyframeTakes,
>(scenes: T[], conceptPreviewArtifactId: string | null) {
  return scenes.filter((scene) => {
    if (scene.index !== 1) return true;
    const selected = scene.takes.find(
      (take) => take.id === scene.selectedKeyframeTakeId,
    );
    return !(
      selected?.kind === "KEYFRAME_START" &&
      selected.status === "COMPLETE" &&
      Boolean(selected.artifactId) &&
      selected.artifactId === conceptPreviewArtifactId
    );
  });
}

export function stableSceneStatus(selectedVideoTakeId: string | null) {
  return selectedVideoTakeId ? ("COMPLETE" as const) : ("APPROVED" as const);
}

export function isStalePollClaim(
  updatedAt: Date,
  now = new Date(),
  staleAfterMs = 90_000,
) {
  return now.getTime() - updatedAt.getTime() >= staleAfterMs;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isTaskStatus(value: unknown): value is VideoSceneTask["status"] {
  return ["WAITING_PROVIDER", "COMPLETE", "FAILED"].includes(String(value));
}
