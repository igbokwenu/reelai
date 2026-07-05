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

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const pipelineSteps = [
  { label: "Brand Kit", status: "Ready for Phase 3", icon: Sparkles },
  { label: "Concepts", status: "Three-way pitch", icon: WandSparkles },
  { label: "Storyboard", status: "Human approval loop", icon: Layers3 },
  { label: "Generation", status: "Keyframes and clips", icon: Film },
  { label: "Final Render", status: "9:16 export", icon: FileVideo },
];

const emptyScenes = [
  "Hook",
  "Proof",
  "Offer",
  "CTA",
];

export default function StudioHome() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)_320px]">
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

          <div className="mt-8 space-y-2">
            <Button className="w-full justify-start" size="sm">
              <Boxes className="size-4" aria-hidden="true" />
              New project
            </Button>
            <Button className="w-full justify-start" size="sm" variant="outline">
              <Activity className="size-4" aria-hidden="true" />
              Demo project
            </Button>
          </div>

          <div className="mt-8 rounded-md border border-dashed border-border p-3">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Phase 1
            </p>
            <p className="mt-2 text-sm">Foundation is running locally.</p>
          </div>
        </aside>

        <section className="min-w-0 px-5 py-5 lg:px-7">
          <header className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Studio workspace</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-normal">
                Build a vertical ad reel from brand material
              </h1>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <Metric label="Target" value="15-30s" />
              <Metric label="Format" value="9:16" />
              <Metric label="Scenes" value="2-4" />
              <Metric label="Status" value="Draft" />
            </div>
          </header>

          <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
            <Card>
              <CardHeader>
                <CardTitle>Production Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-4">
                  {emptyScenes.map((scene, index) => (
                    <div
                      className="bg-muted/40 min-h-36 rounded-md border border-border p-3"
                      key={scene}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">
                          Scene {index + 1}
                        </span>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
                          ghost
                        </span>
                      </div>
                      <p className="mt-12 text-lg font-semibold">{scene}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Run Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Model calls</span>
                  <span>Prepared only</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Storage</span>
                  <span>OSS contract</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Database</span>
                  <span>Prisma/Postgres</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cost estimate</span>
                  <span className="inline-flex items-center gap-1 text-amber-300">
                    <BadgeDollarSign className="size-4" aria-hidden="true" />
                    pending
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
          <p className="text-sm font-semibold">Inspector</p>
          <div className="mt-4 space-y-3">
            <InspectorRow label="Business" value="Not set" />
            <InspectorRow label="Audience" value="Not set" />
            <InspectorRow label="Style" value="Realistic" />
            <InspectorRow label="Approval" value="Concept required" />
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

function InspectorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
