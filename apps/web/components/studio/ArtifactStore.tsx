"use client";

import { Grid2X2, Images, X } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";

import { ArtifactPreview } from "@/components/studio/ArtifactPreview";
import { Button } from "@/components/ui/button";

type Artifact = {
  id: string;
  type: string;
  mimeType: string;
  publicUrl: string | null;
  createdAt: Date | string;
  metadata: unknown;
};

const visibleArtifactCount = 3;

export function ArtifactStore({ artifacts }: { artifacts: Artifact[] }) {
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const titleId = useId();
  const recentArtifacts = useMemo(
    () => artifacts.slice(0, visibleArtifactCount),
    [artifacts],
  );
  const hiddenArtifactCount = Math.max(
    artifacts.length - visibleArtifactCount,
    0,
  );

  useEffect(() => {
    if (!isGalleryOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsGalleryOpen(false);
      }
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isGalleryOpen]);

  if (artifacts.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
        Uploads will appear here as durable artifacts.
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3">
        <div className="flex flex-col gap-3 rounded-md border border-border bg-background/50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Images className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium">
                {artifacts.length} durable{" "}
                {artifacts.length === 1 ? "artifact" : "artifacts"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Showing the latest {recentArtifacts.length}
                {hiddenArtifactCount > 0
                  ? `, with ${hiddenArtifactCount} more in the gallery`
                  : ""}
                .
              </p>
            </div>
          </div>
          {hiddenArtifactCount > 0 ? (
            <Button
              onClick={() => setIsGalleryOpen(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Grid2X2 className="size-4" aria-hidden="true" />
              View all
            </Button>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          {recentArtifacts.map((artifact) => (
            <ArtifactPreview artifact={artifact} key={artifact.id} />
          ))}
        </div>
      </div>

      {isGalleryOpen ? (
        <div
          aria-labelledby={titleId}
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-background/85 p-4 backdrop-blur-sm"
          role="dialog"
        >
          <button
            aria-label="Close artifact gallery"
            className="absolute inset-0 cursor-default"
            onClick={() => setIsGalleryOpen(false)}
            type="button"
          />
          <div className="relative flex max-h-[min(760px,calc(100vh-2rem))] w-full max-w-5xl flex-col rounded-md border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <h2 className="text-base font-semibold" id={titleId}>
                  Artifact Gallery
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {artifacts.length} stored files, newest first
                </p>
              </div>
              <Button
                aria-label="Close artifact gallery"
                onClick={() => setIsGalleryOpen(false)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="overflow-y-auto p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {artifacts.map((artifact) => (
                  <ArtifactPreview artifact={artifact} key={artifact.id} />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
