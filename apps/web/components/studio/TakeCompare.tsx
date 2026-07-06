"use client";

import { Check, ImageIcon, Loader2, RotateCcw, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export type TakeArtifact = {
  id: string;
  type: string;
  mimeType: string;
  publicUrl: string | null;
  metadata: unknown;
  createdAt: Date | string;
};

export type SceneTake = {
  id: string;
  kind: "KEYFRAME_START" | "KEYFRAME_END" | "VIDEO";
  attempt: number;
  prompt: string;
  artifactId: string | null;
  status: string;
  selected: boolean;
  notes: string | null;
  createdAt: Date | string;
};

export type TakeCompareScene = {
  id: string;
  index: number;
  captionText: string;
  status: string;
  selectedKeyframeTakeId: string | null;
  selectedVideoTakeId: string | null;
  takes: SceneTake[];
};

export function TakeCompare({
  scene,
  artifacts,
}: {
  scene: TakeCompareScene;
  artifacts: TakeArtifact[];
}) {
  const keyframes = scene.takes.filter((take) =>
    take.kind.startsWith("KEYFRAME"),
  );
  const videos = scene.takes.filter((take) => take.kind === "VIDEO");

  return (
    <div className="grid gap-4">
      <TakeGroup
        artifacts={artifacts}
        selectedTakeId={scene.selectedKeyframeTakeId}
        takes={keyframes}
        title="Keyframe Takes"
      />
      <TakeGroup
        artifacts={artifacts}
        selectedTakeId={scene.selectedVideoTakeId}
        takes={videos}
        title="Video Takes"
      />
    </div>
  );
}

function TakeGroup({
  title,
  takes,
  artifacts,
  selectedTakeId,
}: {
  title: string;
  takes: SceneTake[];
  artifacts: TakeArtifact[];
  selectedTakeId: string | null;
}) {
  const router = useRouter();
  const [selectingTakeId, setSelectingTakeId] = useState<string | null>(null);
  const artifactById = new Map(artifacts.map((artifact) => [artifact.id, artifact]));

  async function selectTake(takeId: string) {
    setSelectingTakeId(takeId);
    await fetch(`/api/takes/${takeId}/select`, { method: "POST" });
    setSelectingTakeId(null);
    router.refresh();
  }

  if (takes.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
        No {title.toLowerCase()} yet.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm font-medium">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {takes.map((take) => {
          const artifact = take.artifactId
            ? artifactById.get(take.artifactId)
            : null;
          const isSelected = selectedTakeId === take.id;
          const isVideo = artifact?.mimeType.startsWith("video/");
          const href = artifact ? `/api/artifacts/${artifact.id}/file` : null;

          return (
            <div
              className={`rounded-md border p-3 ${
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background/60"
              }`}
              key={take.id}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {isVideo ? (
                    <Video className="size-4 text-primary" aria-hidden="true" />
                  ) : (
                    <ImageIcon className="size-4 text-primary" aria-hidden="true" />
                  )}
                  Attempt {take.attempt}
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatEnum(take.status)}
                </span>
              </div>

              {href && artifact?.mimeType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={`Take ${take.attempt}`}
                  className="mt-3 aspect-[9/16] w-full rounded-md border border-border object-cover"
                  src={href}
                />
              ) : null}

              {href && isVideo ? (
                <video
                  className="mt-3 aspect-[9/16] w-full rounded-md border border-border object-cover"
                  controls
                  preload="metadata"
                  src={href}
                />
              ) : null}

              {!href ? (
                <div className="mt-3 flex aspect-[9/16] items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                  {take.status === "RUNNING" || take.status === "QUEUED"
                    ? "Generating"
                    : take.notes ?? "No artifact"}
                </div>
              ) : null}

              <p className="mt-3 line-clamp-3 text-xs text-muted-foreground">
                {take.prompt}
              </p>

              <Button
                className="mt-3 w-full"
                disabled={
                  take.status !== "COMPLETE" ||
                  !take.artifactId ||
                  isSelected ||
                  selectingTakeId === take.id
                }
                onClick={() => selectTake(take.id)}
                size="sm"
                type="button"
              >
                {selectingTakeId === take.id ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : isSelected ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : (
                  <RotateCcw className="size-4" aria-hidden="true" />
                )}
                {isSelected ? "Selected" : "Select Take"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
