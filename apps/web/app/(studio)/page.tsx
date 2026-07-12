import { ChevronDown, Film, Layers3, Sparkles, WandSparkles } from "lucide-react";
import Image from "next/image";

import { ProjectIntakeForm } from "@/components/studio/ProjectIntakeForm";
import { ProjectList } from "@/components/studio/ProjectList";
import { prisma } from "@/lib/prisma";

const pipelineSteps = [
  { label: "Research", detail: "Brand Kit from your website", icon: Sparkles },
  { label: "Direct", detail: "Three distinct creative routes", icon: WandSparkles },
  { label: "Shape", detail: "An editable scene-by-scene plan", icon: Layers3 },
  { label: "Produce", detail: "Visuals, voice, and final reel", icon: Film },
];

export const dynamic = "force-dynamic";

export default async function StudioHome() {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { artifacts: true, sources: true } } },
  });

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_68%_8%,rgba(183,255,60,0.075),transparent_34%),radial-gradient(circle_at_35%_90%,rgba(183,255,60,0.035),transparent_28%)]" />
      <div className="relative grid min-h-screen grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-border/70 bg-sidebar/95 z-20 flex flex-col border-b px-5 py-5 lg:sticky lg:top-0 lg:h-screen lg:overflow-hidden lg:border-r lg:border-b-0 lg:px-5 lg:py-7">
          <div className="flex items-center gap-3 px-1">
            <Image alt="ReelAI logo" className="size-10 rounded-xl object-cover ring-1 ring-white/10" height={40} priority src="/reelai_logo.jpeg" width={40} />
            <div>
              <p className="text-sm font-semibold tracking-tight">ReelAI</p>
              <p className="text-xs text-muted-foreground">Creative studio</p>
            </div>
          </div>

          <div className="mt-8 flex min-h-0 flex-1 flex-col">
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Projects</p>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{projects.length}</span>
            </div>
            <div className="min-h-0 overflow-y-auto pr-1 lg:pb-6">
              <ProjectList allowDelete projects={projects} />
            </div>
          </div>
        </aside>

        <section className="min-w-0 px-5 py-10 sm:px-8 lg:px-12 lg:py-14 xl:px-20">
          <div className="mx-auto max-w-4xl">
            <header className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
                <Sparkles className="size-3.5" aria-hidden="true" />
                From website to production-ready brand
              </div>
              <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-0.035em] sm:text-5xl lg:text-6xl">
                Your next reel starts with your brand.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Share your company website. ReelAI researches the business, builds the Brand Kit, and prepares a creative workspace you can shape before production.
              </p>
            </header>

            <div className="mt-9 rounded-2xl border border-white/10 bg-card/85 p-1 shadow-2xl shadow-black/20 backdrop-blur sm:p-2">
              <div className="rounded-xl border border-white/[0.04] bg-background/35 p-4 sm:p-6">
                <ProjectIntakeForm />
              </div>
            </div>

            <details className="group mt-6 rounded-xl border border-border/60 bg-card/30">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm text-muted-foreground transition hover:text-foreground sm:px-5">
                <span><span className="font-medium text-foreground">What happens next</span> · Review every stage before production</span>
                <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="grid gap-px border-t border-border/60 bg-border/60 sm:grid-cols-2 xl:grid-cols-4">
                {pipelineSteps.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <div className="bg-background/95 p-4" key={step.label}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-primary">0{index + 1}</span>
                        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                      </div>
                      <p className="mt-3 text-sm font-medium">{step.label}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.detail}</p>
                    </div>
                  );
                })}
              </div>
            </details>

            <p className="mt-8 text-center text-xs text-muted-foreground/70">Source-grounded research · Editable creative decisions · You approve before generation</p>
          </div>
        </section>
      </div>
    </main>
  );
}
