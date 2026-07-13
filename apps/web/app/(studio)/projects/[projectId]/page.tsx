import {
  ArrowLeft,
  Boxes,
  Clapperboard,
  Database,
  FileVideo,
  Globe2,
  HardDrive,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArtifactStore } from "@/components/studio/ArtifactStore";
import { BrandKitPanel } from "@/components/studio/BrandKitPanel";
import { ConceptTable } from "@/components/studio/ConceptTable";
import { FinalVideoPlayer } from "@/components/studio/FinalVideoPlayer";
import { GenerationConsole } from "@/components/studio/GenerationConsole";
import { ProjectList } from "@/components/studio/ProjectList";
import { StoryboardTimeline } from "@/components/studio/StoryboardTimeline";
import { SourceUploader } from "@/components/studio/SourceUploader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_340px]">
        <aside className="border-border bg-sidebar/70 border-b px-4 py-5 lg:border-r lg:border-b-0">
          <Link
            className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            href="/"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Intake
          </Link>
          <div className="flex items-center gap-3">
            <Image
              alt="Reel AI logo"
              className="size-10 rounded-md object-cover"
              height={40}
              priority
              src="/reelai_logo.jpeg"
              width={40}
            />
            <div>
              <p className="text-sm font-semibold">Reel AI</p>
              <p className="text-muted-foreground text-xs">Project graph</p>
            </div>
          </div>
          <div className="mt-7">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              <Boxes className="size-4" aria-hidden="true" />
              Projects
            </div>
            <ProjectList projects={projects} />
          </div>
        </aside>

        <section className="min-w-0 px-5 py-5 lg:px-7">
          <header className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-muted-foreground text-sm">
                {project.businessName}
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-normal">
                {project.name}
              </h1>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <Metric label="Style" value={formatEnum(project.style)} />
              <Metric label="Length" value={`${project.videoLengthSec}s`} />
              <Metric label="Sources" value={String(project.sources.length)} />
              <Metric
                label="Artifacts"
                value={String(project.artifacts.length)}
              />
            </div>
          </header>

          <div className="mt-6 grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Brand Kit</CardTitle>
              </CardHeader>
              <CardContent>
                <BrandKitPanel
                  brandKit={project.brandKit}
                  latestBrandKitJob={latestBrandKitJob}
                  projectId={project.id}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Concepts</CardTitle>
              </CardHeader>
              <CardContent>
                <ConceptTable
                  artifacts={project.artifacts}
                  concepts={project.concepts}
                  hasBrandKit={Boolean(project.brandKit)}
                  latestConceptJob={latestConceptJob}
                  projectId={project.id}
                  sources={project.sources}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Storyboard</CardTitle>
              </CardHeader>
              <CardContent>
                <StoryboardTimeline
                  key={
                    project.storyboard
                      ? `${project.storyboard.id}-${project.storyboard.updatedAt.toISOString()}`
                      : selectedConcept?.id ?? "no-storyboard"
                  }
                  latestPolicyJob={latestPolicyJob}
                  latestStoryboardJob={latestStoryboardJob}
                  projectId={project.id}
                  selectedConcept={selectedConcept}
                  storyboard={project.storyboard}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Generation</CardTitle>
              </CardHeader>
              <CardContent>
                <GenerationConsole
                  artifacts={project.artifacts}
                  latestKeyframeJob={latestKeyframeJob}
                  latestVideoJob={latestVideoJob}
                  projectId={project.id}
                  storyboard={project.storyboard}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Final Render</CardTitle>
              </CardHeader>
              <CardContent>
                <FinalVideoPlayer
                  artifacts={project.artifacts}
                  latestNarrationJob={latestNarrationJob}
                  latestRenderJob={latestRenderJob}
                  projectId={project.id}
                  renders={project.renders}
                  storyboard={project.storyboard}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Project Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <SourceUploader projectId={project.id} />
              </CardContent>
            </Card>

            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Registered Sources</CardTitle>
                </CardHeader>
                <CardContent>
                  {project.sources.length > 0 ? (
                    <div className="grid gap-2">
                      {project.sources.map((source) => (
                        <div
                          className="rounded-md border border-border bg-background/50 p-3 text-sm"
                          key={source.id}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium">
                              {formatEnum(source.type)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {source.artifactId
                                ? "artifact linked"
                                : "metadata"}
                            </span>
                          </div>
                          <p className="mt-1 break-all text-xs text-muted-foreground">
                            {source.url ?? source.artifactId ?? "Uploaded file"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState text="No sources yet." />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Artifact Store</CardTitle>
                </CardHeader>
                <CardContent>
                  <ArtifactStore artifacts={project.artifacts} />
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <aside className="border-border bg-card/40 border-t px-5 py-5 lg:border-t-0 lg:border-l">
          <p className="text-sm font-semibold">Inspector</p>
          <div className="mt-4 space-y-3">
            <InspectorRow
              icon={Globe2}
              label="Website"
              value={project.websiteUrl ?? "Not set"}
            />
            <InspectorRow
              icon={Database}
              label="Status"
              value={formatEnum(project.status)}
            />
            <InspectorRow
              icon={HardDrive}
              label="Storage rows"
              value={`${project.artifacts.length}`}
            />
            <InspectorRow
              icon={FileVideo}
              label="Next phase"
              value={
                project.storyboard
                  ? "Keyframes"
                  : selectedConcept
                    ? "Storyboard"
                    : project.concepts.length === 3
                      ? "Concept Selection"
                      : project.brandKit
                        ? "Creative Concepts"
                        : "Brand Kit"
              }
            />
            <InspectorRow
              icon={Clapperboard}
              label="Brand Kit job"
              value={latestBrandKitJob?.status ?? "Not started"}
            />
            <InspectorRow
              icon={Clapperboard}
              label="Concept"
              value={selectedConcept?.title ?? "Not selected"}
            />
            <InspectorRow
              icon={Clapperboard}
              label="Storyboard"
              value={project.storyboard?.status ?? "Not started"}
            />
            <InspectorRow
              icon={FileVideo}
              label="Final render"
              value={project.renders[0]?.status ?? "Not started"}
            />
          </div>
          <div className="mt-5 rounded-md border border-dashed border-border p-3 text-sm">
            <p className="font-medium">Persistence check</p>
            <p className="mt-2 text-muted-foreground">
              This page is rendered from the project graph API shape: project,
              sources, artifacts, jobs, storyboard, renders, and related rows.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <p className="text-muted-foreground text-[11px] uppercase tracking-[0.16em]">
        {label}
      </p>
      <p className="mt-1 whitespace-nowrap text-sm font-semibold">{value}</p>
    </div>
  );
}

function InspectorRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Globe2;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border px-3 py-2 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <p className="mt-1 break-words font-medium">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
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
