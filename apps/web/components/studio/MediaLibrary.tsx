"use client";

import {
  CalendarDays,
  Check,
  Clock3,
  Download,
  ExternalLink,
  Film,
  FolderOpen,
  Play,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type LibraryOutput = {
  id: string;
  artifactId: string;
  thumbnailArtifactId: string | null;
  label: string;
  isLatest: boolean;
  isCurrent: boolean;
  completedAt: string;
  durationSec: number | null;
  format: string;
  width: number | null;
  height: number | null;
  aiDisclosureEnabled: boolean | null;
  bgmEnabled: boolean | null;
};

export type LibraryProject = {
  id: string;
  name: string;
  businessName: string;
  outputMode: "STANDARD" | "PRODUCT_SHOWCASE";
  style: string;
  videoLengthSec: number;
  outputs: LibraryOutput[];
};

type ModeFilter = "ALL" | LibraryProject["outputMode"];

const filters: Array<{ value: ModeFilter; label: string }> = [
  { value: "ALL", label: "All finals" },
  { value: "STANDARD", label: "Brand reels" },
  { value: "PRODUCT_SHOWCASE", label: "Product showcases" },
];

export function MediaLibrary({ projects }: { projects: LibraryProject[] }) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<ModeFilter>("ALL");
  const [selected, setSelected] = useState<{
    project: LibraryProject;
    output: LibraryOutput;
  } | null>(null);

  const visibleProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesMode = mode === "ALL" || project.outputMode === mode;
      const matchesQuery =
        !normalizedQuery ||
        project.name.toLowerCase().includes(normalizedQuery) ||
        project.businessName.toLowerCase().includes(normalizedQuery);
      return matchesMode && matchesQuery;
    });
  }, [mode, projects, query]);

  const visibleOutputCount = visibleProjects.reduce(
    (total, project) => total + project.outputs.length,
    0,
  );

  return (
    <>
      <section aria-label="Media library controls" className="mt-8">
        <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/55 p-3 shadow-lg shadow-black/10 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              aria-label="Search projects"
              className="h-11 w-full rounded-xl border border-border bg-background/70 pl-10 pr-10 text-sm outline-none transition placeholder:text-muted-foreground/70 hover:border-border/80 focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by project or brand"
              type="search"
              value={query}
            />
            {query ? (
              <button
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setQuery("")}
                type="button"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            ) : null}
          </div>

          <div
            aria-label="Filter final videos"
            className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-background/60 p-1"
            role="group"
          >
            {filters.map((filter) => (
              <button
                aria-pressed={mode === filter.value}
                className={cn(
                  "h-9 shrink-0 rounded-lg px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  mode === filter.value
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                key={filter.value}
                onClick={() => setMode(filter.value)}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
        <p aria-live="polite" className="mt-3 text-xs text-muted-foreground">
          Showing {visibleOutputCount} finished{" "}
          {visibleOutputCount === 1 ? "video" : "videos"} across{" "}
          {visibleProjects.length}{" "}
          {visibleProjects.length === 1 ? "project" : "projects"}.
        </p>
      </section>

      {visibleProjects.length > 0 ? (
        <div className="mt-10 space-y-14">
          {visibleProjects.map((project) => (
            <ProjectOutputGroup
              key={project.id}
              onSelect={(output) => setSelected({ project, output })}
              project={project}
            />
          ))}
        </div>
      ) : (
        <div className="mt-10 grid min-h-80 place-items-center rounded-3xl border border-dashed border-border bg-card/25 p-8 text-center">
          <div>
            <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-border bg-card text-muted-foreground">
              <FolderOpen aria-hidden="true" className="size-5" />
            </span>
            <h2 className="mt-4 text-base font-semibold">
              No finals match this view
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              Try another filter or clear the search to see every completed
              final render.
            </p>
            <Button
              className="mt-5"
              onClick={() => {
                setMode("ALL");
                setQuery("");
              }}
              variant="outline"
            >
              Reset filters
            </Button>
          </div>
        </div>
      )}

      {selected ? (
        <OutputViewer
          onClose={() => setSelected(null)}
          output={selected.output}
          project={selected.project}
        />
      ) : null}
    </>
  );
}

function ProjectOutputGroup({
  project,
  onSelect,
}: {
  project: LibraryProject;
  onSelect: (output: LibraryOutput) => void;
}) {
  return (
    <section aria-labelledby={`project-${project.id}`}>
      <div className="mb-5 flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className="truncate text-xl font-semibold tracking-tight sm:text-2xl"
              id={`project-${project.id}`}
            >
              {project.name}
            </h2>
            <OutputModeBadge mode={project.outputMode} />
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>{project.businessName}</span>
            <span aria-hidden="true" className="text-border">
              /
            </span>
            <span>{formatEnum(project.style)}</span>
            <span aria-hidden="true" className="text-border">
              /
            </span>
            <span>{project.videoLengthSec}s brief</span>
          </p>
        </div>
        <Link
          className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href={`/projects/${project.id}`}
        >
          Open project
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </Link>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {project.outputs.map((output) => (
          <OutputCard
            key={output.id}
            onSelect={() => onSelect(output)}
            output={output}
            project={project}
          />
        ))}
      </div>
    </section>
  );
}

function OutputCard({
  project,
  output,
  onSelect,
}: {
  project: LibraryProject;
  output: LibraryOutput;
  onSelect: () => void;
}) {
  const videoUrl = `/api/artifacts/${output.artifactId}/file`;
  const thumbnailUrl = output.thumbnailArtifactId
    ? `/api/artifacts/${output.thumbnailArtifactId}/file`
    : undefined;

  return (
    <article className="group overflow-hidden rounded-2xl border border-border/80 bg-card/70 shadow-lg shadow-black/10 transition duration-300 hover:-translate-y-0.5 hover:border-white/15 hover:shadow-2xl hover:shadow-black/25">
      <button
        aria-label={`Play ${project.name}, ${output.label}`}
        className="relative block aspect-[9/12] w-full overflow-hidden bg-black text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onClick={onSelect}
        type="button"
      >
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="size-full object-cover transition duration-500 group-hover:scale-[1.025]"
            loading="lazy"
            src={thumbnailUrl}
          />
        ) : (
          <video
            aria-hidden="true"
            className="size-full object-cover opacity-80"
            muted
            playsInline
            preload="metadata"
            src={`${videoUrl}#t=0.1`}
          />
        )}
        <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/20" />
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid size-12 place-items-center rounded-full border border-white/25 bg-black/35 text-white shadow-xl backdrop-blur-md transition duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground">
            <Play aria-hidden="true" className="ml-0.5 size-4 fill-current" />
          </span>
        </span>
        <span className="absolute left-3 top-3 flex items-center gap-2">
          {output.isLatest ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-foreground shadow-lg">
              <Sparkles aria-hidden="true" className="size-3" />
              Latest
            </span>
          ) : null}
          {!output.isCurrent ? (
            <span className="rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/80 shadow-lg backdrop-blur">
              Previous version
            </span>
          ) : null}
        </span>
        <span className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3 text-white">
          <span>
            <span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-white/65">
              Final merged output
            </span>
            <span className="mt-1 block text-sm font-semibold">
              {output.label}
            </span>
          </span>
          <span className="rounded-md bg-black/45 px-2 py-1 text-[11px] tabular-nums backdrop-blur">
            {formatDuration(output.durationSec ?? project.videoLengthSec)}
          </span>
        </span>
      </button>

      <div className="flex items-center justify-between gap-3 p-3.5">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">
            {formatDate(output.completedAt)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {output.format} · {formatResolution(output)}
          </p>
        </div>
        <a
          aria-label={`Download ${project.name}, ${output.label}`}
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          download={`${slugify(project.name)}-${slugify(output.label)}.mp4`}
          href={videoUrl}
          onClick={(event) => event.stopPropagation()}
        >
          <Download aria-hidden="true" className="size-4" />
        </a>
      </div>
    </article>
  );
}

function OutputViewer({
  project,
  output,
  onClose,
}: {
  project: LibraryProject;
  output: LibraryOutput;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const videoUrl = `/api/artifacts/${output.artifactId}/file`;
  const thumbnailUrl = output.thumbnailArtifactId
    ? `/api/artifacts/${output.thumbnailArtifactId}/file`
    : undefined;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      aria-labelledby="media-viewer-title"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/85 p-3 backdrop-blur-xl sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
    >
      <div className="my-auto w-full max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-[#101211] shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p
              className="truncate text-sm font-semibold"
              id="media-viewer-title"
            >
              {project.name} · {output.label}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {project.businessName} · {formatDate(output.completedAt)}
            </p>
          </div>
          <button
            aria-label="Close video viewer"
            className="grid size-9 shrink-0 place-items-center rounded-full border border-white/10 text-muted-foreground transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="grid min-h-[55vh] place-items-center bg-black p-3 sm:p-5">
            <video
              autoPlay
              className="max-h-[78vh] w-full rounded-xl bg-black object-contain"
              controls
              playsInline
              poster={thumbnailUrl}
              preload="metadata"
              src={videoUrl}
            />
          </div>
          <aside className="border-t border-white/10 p-5 lg:border-l lg:border-t-0">
            <OutputModeBadge mode={project.outputMode} />
            <h3 className="mt-4 text-xl font-semibold tracking-tight">
              {output.label}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Final merged output
            </p>

            <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-1">
              <ViewerDetail
                icon={Clock3}
                label="Runtime"
                value={formatDuration(
                  output.durationSec ?? project.videoLengthSec,
                )}
              />
              <ViewerDetail
                icon={Film}
                label="Format"
                value={`${output.format} · ${formatResolution(output)}`}
              />
              <ViewerDetail
                icon={CalendarDays}
                label="Completed"
                value={formatDate(output.completedAt)}
              />
              {output.aiDisclosureEnabled !== null ? (
                <ViewerDetail
                  icon={Check}
                  label="AI disclosure"
                  value={
                    output.aiDisclosureEnabled ? "Included" : "Not included"
                  }
                />
              ) : null}
              <ViewerDetail
                icon={Check}
                label="Project version"
                value={output.isCurrent ? "Current final" : "Previous final"}
              />
            </dl>

            <div className="mt-7 grid gap-2">
              <Button asChild className="w-full">
                <a
                  download={`${slugify(project.name)}-${slugify(output.label)}.mp4`}
                  href={videoUrl}
                >
                  <Download aria-hidden="true" className="size-4" />
                  Download MP4
                </a>
              </Button>
              <Button asChild className="w-full" variant="outline">
                <Link href={`/projects/${project.id}`}>
                  <ExternalLink aria-hidden="true" className="size-4" />
                  Open project
                </Link>
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function ViewerDetail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/45 p-3">
      <Icon
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-primary"
      />
      <div>
        <dt className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </dt>
        <dd className="mt-1 text-xs font-medium">{value}</dd>
      </div>
    </div>
  );
}

function OutputModeBadge({ mode }: { mode: LibraryProject["outputMode"] }) {
  return (
    <span className="inline-flex w-fit items-center rounded-full border border-primary/20 bg-primary/[0.07] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
      {mode === "PRODUCT_SHOWCASE" ? "Product showcase" : "Brand reel"}
    </span>
  );
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatResolution(output: LibraryOutput) {
  if (output.width && output.height) return `${output.width}×${output.height}`;
  return "Vertical MP4";
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
