import {
  Activity,
  BadgeDollarSign,
  Boxes,
  Clapperboard,
  FileVideo,
  Film,
  Layers3,
  Sparkles,
  WandSparkles,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectIntakeForm } from "@/components/studio/ProjectIntakeForm";
import { ProjectList } from "@/components/studio/ProjectList";
import { prisma } from "@/lib/prisma";

const pipelineSteps = [
  { label: "Brand Kit", status: "Phase 3", icon: Sparkles },
  { label: "Concepts", status: "Three-way pitch", icon: WandSparkles },
  { label: "Storyboard", status: "Approval loop", icon: Layers3 },
  { label: "Generation", status: "Keyframes and clips", icon: Film },
  { label: "Final Render", status: "9:16 export", icon: FileVideo },
];

export const dynamic = "force-dynamic";

export default async function StudioHome() {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: { artifacts: true, sources: true },
      },
    },
  });

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="border-border bg-sidebar/70 border-b px-4 py-5 lg:border-r lg:border-b-0">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-md">
              <Clapperboard className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold">Reel AI</p>
              <p className="text-muted-foreground text-xs">Showrunner studio</p>
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
              <p className="text-muted-foreground text-sm">Project intake</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-normal">
                Create a persisted production project
              </h1>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <Metric label="Target" value="15-30s" />
              <Metric label="Format" value="9:16" />
              <Metric label="Sources" value="OSS/local" />
              <Metric label="Status" value="Draft" />
            </div>
          </header>

          <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
            <Card>
              <CardHeader>
                <CardTitle>New Project</CardTitle>
              </CardHeader>
              <CardContent>
                <ProjectIntakeForm />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Run Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <StatusRow label="Database" value="Prisma/Postgres" />
                <StatusRow label="Storage" value="OSS adapter" />
                <StatusRow label="Artifacts" value="Durable rows" />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Generation spend
                  </span>
                  <span className="inline-flex items-center gap-1 text-amber-300">
                    <BadgeDollarSign className="size-4" aria-hidden="true" />
                    none yet
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {pipelineSteps.map((step) => {
              const Icon = step.icon;

              return (
                <div
                  className="rounded-md border border-border bg-card p-3 text-card-foreground"
                  key={step.label}
                >
                  <Icon className="text-primary size-5" aria-hidden="true" />
                  <p className="mt-3 text-sm font-medium">{step.label}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {step.status}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="border-border bg-card/40 border-t px-5 py-5 lg:border-t-0 lg:border-l">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-primary" aria-hidden="true" />
            <p className="text-sm font-semibold">Inspector</p>
          </div>
          <div className="mt-4 space-y-3">
            <StatusRow label="Projects" value={String(projects.length)} />
            <StatusRow label="Next step" value="Open project" />
            <StatusRow label="Approval" value="Sources first" />
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

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
