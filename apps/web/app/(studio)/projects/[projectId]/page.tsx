import { ArrowLeft, Boxes, ChevronDown, Globe2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArtifactStore } from "@/components/studio/ArtifactStore";
import { BrandKitPanel } from "@/components/studio/BrandKitPanel";
import { ConceptTable } from "@/components/studio/ConceptTable";
import { FinalVideoPlayer } from "@/components/studio/FinalVideoPlayer";
import { GenerationConsole } from "@/components/studio/GenerationConsole";
import { ProjectList } from "@/components/studio/ProjectList";
import { ProjectWorkflow } from "@/components/studio/ProjectWorkflow";
import { SourceUploader } from "@/components/studio/SourceUploader";
import { StoryboardTimeline } from "@/components/studio/StoryboardTimeline";
import { prisma } from "@/lib/prisma";
import { getProjectGraph } from "@/lib/projects/graph";

type PageProps = {
  params: Promise<{ projectId: string }>;
};

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: PageProps) {
  const { projectId } = await params;
  const [project, projects] = await Promise.all([
    getProjectGraph(projectId),
    prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: { artifacts: true, sources: true },
        },
      },
    }),
  ]);

  if (!project) {
    notFound();
  }

  const latestBrandKitJob =
    project.jobs.find((job) => job.type === "BRAND_KIT") ?? null;
  const latestConceptJob =
    project.jobs.find((job) => job.type === "CONCEPTS") ?? null;
  const latestStoryboardJob =
    project.jobs.find((job) => job.type === "STORYBOARD") ?? null;
  const latestPolicyJob =
    project.jobs.find((job) => job.type === "POLICY_REVIEW") ?? null;
  const latestKeyframeJob =
    project.jobs.find((job) => job.type === "KEYFRAME") ?? null;
  const latestVideoJob =
    project.jobs.find((job) => job.type === "VIDEO") ?? null;
  const latestNarrationJob =
    project.jobs.find((job) => job.type === "TTS") ?? null;
  const latestRenderJob =
    project.jobs.find((job) => job.type === "RENDER") ?? null;
  const selectedConcept =
    project.concepts.find((concept) => concept.selected) ?? null;
  const productionComplete = Boolean(
    project.storyboard?.scenes.length &&
    project.storyboard.scenes.every(
      (scene) => scene.status === "COMPLETE" && scene.selectedVideoTakeId,
    ),
  );
  const finalComplete = project.renders.some(
    (render) => render.status === "COMPLETE" && render.artifactId,
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[268px_minmax(0,1fr)]">
        <aside className="border-border bg-sidebar/80 border-b px-4 py-5 backdrop-blur-xl lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-r lg:border-b-0">
          <Link
            className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            href="/"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            New project
          </Link>
          <div className="flex items-center gap-3">
            <Image
              alt="Reel AI logo"
              className="size-10 rounded-xl object-cover ring-1 ring-white/10"
              height={40}
              priority
              src="/reelai_logo.jpeg"
              width={40}
            />
            <div>
              <p className="text-sm font-semibold">Reel AI</p>
              <p className="text-muted-foreground text-xs">Creative studio</p>
            </div>
          </div>
          <div className="mt-6">
            <details className="group lg:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border border-border bg-card/60 px-3 py-2.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2">
                  <Boxes
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Switch project
                </span>
                <ChevronDown
                  className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="mt-2 max-h-64 overflow-y-auto pr-1">
                <ProjectList projects={projects} />
              </div>
            </details>
            <div className="hidden lg:block">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                <Boxes className="size-4" aria-hidden="true" />
                Projects
              </div>
              <ProjectList projects={projects} />
            </div>
          </div>
        </aside>

        <section className="min-w-0 px-4 py-5 sm:px-6 lg:px-8 xl:px-10">
          <div className="mx-auto max-w-[1480px]">
            <header className="flex flex-col gap-5 border-b border-border/80 pb-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Globe2 className="size-4" aria-hidden="true" />
                  <span className="truncate">{project.businessName}</span>
                </div>
                <h1 className="mt-2 truncate text-3xl font-semibold tracking-tight sm:text-4xl">
                  {project.name}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  One guided workspace from brand research to final reel.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Metric label="Style" value={formatEnum(project.style)} />
                <Metric label="Length" value={`${project.videoLengthSec}s`} />
                <Metric
                  label="Sources"
                  value={String(project.sources.length)}
                />
                <Metric
                  label="Artifacts"
                  value={String(project.artifacts.length)}
                />
              </div>
            </header>

            <details className="group mt-4 rounded-xl border border-border/70 bg-card/50 px-4 py-3 text-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium [&::-webkit-details-marker]:hidden">
                <span>Project details</span>
                <ChevronDown
                  className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="mt-3 grid gap-3 border-t border-border/70 pt-3 text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                <ProjectDetail
                  label="Website"
                  value={project.websiteUrl ?? "Not set"}
                />
                <ProjectDetail
                  label="Status"
                  value={formatEnum(project.status)}
                />
                <ProjectDetail
                  label="Selected concept"
                  value={selectedConcept?.title ?? "Not selected"}
                />
                <ProjectDetail
                  label="Final render"
                  value={
                    project.renders[0]?.status
                      ? formatEnum(project.renders[0].status)
                      : "Not started"
                  }
                />
              </div>
            </details>

            <ProjectWorkflow
              assets={
                <div className="grid gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                  <section>
                    <SectionHeading
                      description="Add logos, product shots, screenshots, or supporting URLs. New material becomes available to future generations."
                      title="Source material"
                    />
                    <SourceUploader projectId={project.id} />
                    <div className="mt-5 grid gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Registered sources · {project.sources.length}
                      </p>
                      {project.sources.length > 0 ? (
                        project.sources.map((source) => (
                          <div
                            className="rounded-xl border border-border bg-background/50 p-3 text-sm"
                            key={source.id}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium">
                                {formatEnum(source.type)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {source.artifactId
                                  ? "File linked"
                                  : "Web source"}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {source.url ??
                                source.artifactId ??
                                "Uploaded file"}
                            </p>
                          </div>
                        ))
                      ) : (
                        <EmptyState text="No sources yet." />
                      )}
                    </div>
                  </section>
                  <section>
                    <SectionHeading
                      description="Every generated preview, take, audio track, and render remains available here."
                      title="Artifact library"
                    />
                    <ArtifactStore artifacts={project.artifacts} />
                  </section>
                </div>
              }
              brand={
                <BrandKitPanel
                  brandKit={project.brandKit}
                  latestBrandKitJob={latestBrandKitJob}
                  projectId={project.id}
                />
              }
              concepts={
                <ConceptTable
                  artifacts={project.artifacts}
                  concepts={project.concepts}
                  hasBrandKit={Boolean(project.brandKit)}
                  latestConceptJob={latestConceptJob}
                  projectId={project.id}
                  sources={project.sources}
                />
              }
              final={
                <FinalVideoPlayer
                  artifacts={project.artifacts}
                  latestNarrationJob={latestNarrationJob}
                  latestRenderJob={latestRenderJob}
                  projectId={project.id}
                  renders={project.renders}
                  storyboard={project.storyboard}
                />
              }
              finalComplete={finalComplete}
              hasBrandKit={Boolean(project.brandKit)}
              hasSelectedConcept={Boolean(selectedConcept)}
              production={
                <GenerationConsole
                  artifacts={project.artifacts}
                  latestKeyframeJob={latestKeyframeJob}
                  latestVideoJob={latestVideoJob}
                  projectId={project.id}
                  storyboard={project.storyboard}
                />
              }
              productionComplete={productionComplete}
              storyboard={
                <StoryboardTimeline
                  artifacts={project.artifacts}
                  key={
                    project.storyboard
                      ? `${project.storyboard.id}-${project.storyboard.updatedAt.toISOString()}`
                      : (selectedConcept?.id ?? "no-storyboard")
                  }
                  latestPolicyJob={latestPolicyJob}
                  latestStoryboardJob={latestStoryboardJob}
                  projectId={project.id}
                  selectedConcept={selectedConcept}
                  storyboard={project.storyboard}
                />
              }
              storyboardStatus={project.storyboard?.status ?? null}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-24 rounded-xl border border-border/80 bg-card px-3 py-2.5">
      <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-[0.14em]">
        {label}
      </p>
      <p className="mt-1 whitespace-nowrap text-sm font-semibold">{value}</p>
    </div>
  );
}

function ProjectDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em]">
        {label}
      </p>
      <p className="mt-1 truncate text-sm text-foreground">{value}</p>
    </div>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
      {text}
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
