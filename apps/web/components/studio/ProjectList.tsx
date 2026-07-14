"use client";

import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { GuideTooltip } from "@/components/ui/guide-tooltip";

type ProjectSummary = {
  id: string;
  name: string;
  businessName: string;
  status: string;
  updatedAt: Date;
  _count?: { artifacts: number; sources: number };
};

export function ProjectList({
  projects,
  allowDelete = false,
}: {
  projects: ProjectSummary[];
  allowDelete?: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<ProjectSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteProject() {
    if (!selected) return;
    setIsDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${selected.id}`, {
        method: "DELETE",
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "This project could not be deleted.");
        return;
      }
      setSelected(null);
      router.refresh();
    } catch {
      setError("ReelAI could not be reached. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/80 px-4 py-6 text-center">
        <p className="text-sm text-muted-foreground">
          Your projects will appear here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-1.5">
        {projects.map((project) => (
          <div className="group relative" key={project.id}>
            <Link
              className="block rounded-xl border border-transparent px-3 py-3 pr-10 text-sm transition hover:border-border hover:bg-card"
              href={`/projects/${project.id}`}
            >
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-medium">
                  {project.name}
                </span>
                <span
                  className="size-1.5 rounded-full bg-primary/70"
                  aria-label={project.status}
                  title={formatStatus(project.status)}
                />
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {project.businessName}
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground/70">
                {project._count?.sources ?? 0} sources ·{" "}
                {project._count?.artifacts ?? 0} assets
              </p>
            </Link>
            {allowDelete ? (
              <GuideTooltip
                className="absolute right-2 top-2.5"
                content="Opens a confirmation before permanently deleting this project."
                side="bottom"
              >
                <button
                  aria-label={`Delete ${project.name}`}
                  className="grid size-8 place-items-center rounded-lg text-muted-foreground opacity-100 transition hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:opacity-0 sm:group-hover:opacity-100"
                  onClick={() => {
                    setError(null);
                    setSelected(project);
                  }}
                  type="button"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              </GuideTooltip>
            ) : null}
          </div>
        ))}
      </div>

      {selected ? (
        <div
          aria-labelledby="delete-project-title"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isDeleting)
              setSelected(null);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl shadow-black/50 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-destructive/10 p-2.5 text-destructive">
                <AlertTriangle className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-semibold" id="delete-project-title">
                  Delete “{selected.name}”?
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  This permanently removes the project and its Brand Kit,
                  sources, concepts, storyboard, jobs, and render records. This
                  cannot be undone.
                </p>
              </div>
            </div>
            {error ? (
              <p
                className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <Button
                disabled={isDeleting}
                onClick={() => setSelected(null)}
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                className="bg-destructive text-white hover:bg-destructive/90"
                disabled={isDeleting}
                onClick={deleteProject}
                tooltip="Permanently deletes this project and all of its saved sources and outputs."
                tooltipSide="bottom"
              >
                {isDeleting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="size-4" aria-hidden="true" />
                )}
                Delete project
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function formatStatus(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}
