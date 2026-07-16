import { ArrowLeft, Film, FolderOpen, Plus, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import {
  MediaLibrary,
  type LibraryProject,
} from "@/components/studio/MediaLibrary";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const projectRecords = await prisma.project.findMany({
    where: {
      renders: {
        some: { artifactId: { not: null } },
      },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      businessName: true,
      outputMode: true,
      style: true,
      videoLengthSec: true,
      artifacts: {
        where: { type: { in: ["FINAL_RENDER", "THUMBNAIL"] } },
        select: {
          id: true,
          type: true,
          durationSec: true,
          width: true,
          height: true,
        },
      },
      renders: {
        where: { artifactId: { not: null } },
        orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          artifactId: true,
          completedAt: true,
          createdAt: true,
          format: true,
          settings: true,
          status: true,
        },
      },
    },
  });

  const projects = projectRecords.flatMap((project) => {
    const artifactById = new Map(
      project.artifacts.map((artifact) => [artifact.id, artifact]),
    );
    const validRenders = project.renders.flatMap((render) => {
      if (!render.artifactId) return [];
      const artifact = artifactById.get(render.artifactId);
      if (!artifact || artifact.type !== "FINAL_RENDER") return [];

      const settings = asRecord(render.settings);
      const thumbnailId = settings?.thumbnailArtifactId;
      const thumbnail =
        typeof thumbnailId === "string"
          ? artifactById.get(thumbnailId)
          : undefined;

      return [{ render, artifact, settings, thumbnail }];
    });

    if (validRenders.length === 0) return [];

    const libraryProject: LibraryProject = {
      id: project.id,
      name: project.name,
      businessName: project.businessName,
      outputMode: project.outputMode,
      style: project.style,
      videoLengthSec: project.videoLengthSec,
      outputs: validRenders.map(
        ({ render, artifact, settings, thumbnail }, index) => ({
          id: render.id,
          artifactId: artifact.id,
          thumbnailArtifactId:
            thumbnail?.type === "THUMBNAIL" ? thumbnail.id : null,
          label:
            index === 0
              ? "Latest final"
              : `Final cut ${String(validRenders.length - index).padStart(2, "0")}`,
          isLatest: index === 0,
          isCurrent: render.status === "COMPLETE",
          completedAt: (render.completedAt ?? render.createdAt).toISOString(),
          durationSec: artifact.durationSec,
          format: render.format,
          width: artifact.width,
          height: artifact.height,
          aiDisclosureEnabled: readBoolean(settings?.aiDisclosureEnabled),
          bgmEnabled: readBoolean(settings?.bgmEnabled),
        }),
      ),
    };

    return [libraryProject];
  });

  const outputCount = projects.reduce(
    (total, project) => total + project.outputs.length,
    0,
  );
  const productShowcaseCount = projects.reduce(
    (total, project) =>
      total +
      (project.outputMode === "PRODUCT_SHOWCASE" ? project.outputs.length : 0),
    0,
  );
  const latestOutput = projects
    .flatMap((project) =>
      project.outputs.map((output) => ({ project, output })),
    )
    .sort(
      (left, right) =>
        new Date(right.output.completedAt).getTime() -
        new Date(left.output.completedAt).getTime(),
    )[0];

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_72%_4%,rgba(183,255,60,0.08),transparent_30%),radial-gradient(circle_at_18%_80%,rgba(183,255,60,0.035),transparent_24%)]" />
      <div className="relative grid min-h-screen grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="z-20 border-b border-border/70 bg-sidebar/95 px-5 py-5 backdrop-blur-xl lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:py-7">
          <Link
            className="inline-flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href="/"
          >
            <Image
              alt="ReelAI logo"
              className="size-10 rounded-xl object-cover ring-1 ring-white/10"
              height={40}
              priority
              src="/reelai_logo.jpeg"
              width={40}
            />
            <span>
              <span className="block text-sm font-semibold tracking-tight">
                ReelAI
              </span>
              <span className="block text-xs text-muted-foreground">
                Creative studio
              </span>
            </span>
          </Link>

          <nav
            aria-label="Studio"
            className="mt-8 grid grid-cols-2 gap-2 lg:grid-cols-1"
          >
            <Link
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href="/"
            >
              <Plus aria-hidden="true" className="size-4" />
              New project
            </Link>
            <Link
              aria-current="page"
              className="flex items-center gap-2.5 rounded-xl border border-primary/15 bg-primary/[0.08] px-3 py-2.5 text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href="/library"
            >
              <Film aria-hidden="true" className="size-4" />
              Media library
            </Link>
          </nav>

          <div className="mt-8 hidden border-t border-border/60 pt-6 lg:block">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              What belongs here
            </p>
            <p className="mt-3 text-xs leading-5 text-muted-foreground/80">
              Only completed, fully merged MP4 exports. Scene clips and working
              assets stay inside their projects.
            </p>
          </div>
        </aside>

        <section className="min-w-0 px-5 py-8 sm:px-8 lg:px-10 lg:py-12 xl:px-14 2xl:px-20">
          <div className="mx-auto max-w-[1500px]">
            <Link
              className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href="/"
            >
              <ArrowLeft aria-hidden="true" className="size-3.5" />
              Back to studio
            </Link>

            <header className="mt-7 flex flex-col gap-7 border-b border-border/70 pb-8 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1.5 text-xs font-medium text-primary">
                  <Sparkles aria-hidden="true" className="size-3.5" />
                  Your finished work
                </div>
                <h1 className="mt-5 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl lg:text-6xl">
                  Media library
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
                  Every final merged video, organized by the project that
                  created it. Review, compare, and download delivery-ready cuts
                  without digging through production assets.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-border/80 bg-border/80 shadow-xl shadow-black/10 xl:min-w-[440px]">
                <LibraryMetric label="Finals" value={String(outputCount)} />
                <LibraryMetric
                  label="Projects"
                  value={String(projects.length)}
                />
                <LibraryMetric
                  label="Latest"
                  value={
                    latestOutput
                      ? shortDate(latestOutput.output.completedAt)
                      : "—"
                  }
                />
              </div>
            </header>

            {projects.length > 0 ? (
              <MediaLibrary projects={projects} />
            ) : (
              <div className="mt-10 grid min-h-[430px] place-items-center overflow-hidden rounded-3xl border border-dashed border-border bg-[radial-gradient(circle_at_50%_0%,rgba(183,255,60,0.07),transparent_35%),rgba(17,19,18,0.35)] p-8 text-center">
                <div className="max-w-md">
                  <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-primary/15 bg-primary/[0.07] text-primary shadow-xl shadow-black/20">
                    <FolderOpen aria-hidden="true" className="size-6" />
                  </span>
                  <h2 className="mt-5 text-xl font-semibold">
                    Your finished reels will collect here
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Complete a project’s Final step and its merged MP4 will
                    appear automatically. Draft scene clips and other production
                    files are intentionally kept out.
                  </p>
                  <Button asChild className="mt-6">
                    <Link href="/">
                      <Plus aria-hidden="true" className="size-4" />
                      Start a project
                    </Link>
                  </Button>
                </div>
              </div>
            )}

            {productShowcaseCount > 0 ? (
              <p className="mt-12 text-center text-xs text-muted-foreground/70">
                Brand reels and product showcases share one delivery library
                while keeping their project context.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function LibraryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card/90 px-4 py-4 sm:px-5">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 truncate text-lg font-semibold tracking-tight">
        {value}
      </p>
    </div>
  );
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}
