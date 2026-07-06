import { FileText, ImageIcon, Video } from "lucide-react";

type Artifact = {
  id: string;
  type: string;
  mimeType: string;
  publicUrl: string | null;
  createdAt: Date | string;
  metadata: unknown;
};

export function ArtifactPreview({ artifact }: { artifact: Artifact }) {
  const isImage = artifact.mimeType.startsWith("image/");
  const isVideo = artifact.mimeType.startsWith("video/");
  const href = `/api/artifacts/${artifact.id}/file`;

  return (
    <a
      className="block rounded-md border border-border bg-background/50 p-3 transition-colors hover:bg-accent"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        {isImage ? (
          <ImageIcon className="size-4 text-primary" aria-hidden="true" />
        ) : isVideo ? (
          <Video className="size-4 text-primary" aria-hidden="true" />
        ) : (
          <FileText className="size-4 text-primary" aria-hidden="true" />
        )}
        {artifact.type}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{artifact.mimeType}</p>
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt="Uploaded artifact preview"
          className="mt-3 aspect-video w-full rounded-md border border-border object-cover"
          src={href}
        />
      ) : isVideo ? (
        <video
          className="mt-3 aspect-video w-full rounded-md border border-border object-cover"
          controls
          preload="metadata"
          src={href}
        />
      ) : (
        <div className="mt-3 flex aspect-video items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
          Document stored
        </div>
      )}
    </a>
  );
}
