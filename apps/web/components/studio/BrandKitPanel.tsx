"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FileCheck2,
  Lightbulb,
  Loader2,
  Palette,
  ShieldAlert,
  Sparkles,
  SwatchBook,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

type BrandKit = {
  summary: string;
  valueProps: unknown;
  audience: string | null;
  tone: string;
  palette: unknown;
  visualMotifs: unknown;
  claims: unknown;
  policyRisks: unknown;
  sourceCitations: unknown;
  lockedStyle: string;
};

type Job = {
  id: string;
  type: string;
  status: string;
  model: string | null;
  error: string | null;
  createdAt: Date | string;
  completedAt: Date | string | null;
};

export function BrandKitPanel({
  projectId,
  brandKit,
  latestBrandKitJob,
}: {
  projectId: string;
  brandKit: BrandKit | null;
  latestBrandKitJob: Job | null;
}) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(latestBrandKitJob);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(
    latestBrandKitJob?.error ?? null,
  );
  const isRunning = job?.status === "QUEUED" || job?.status === "RUNNING";
  const parsed = useMemo(() => normalizeBrandKit(brandKit), [brandKit]);

  useEffect(() => {
    if (!job || !isRunning) {
      return;
    }

    const interval = window.setInterval(async () => {
      const response = await fetch(`/api/jobs/${job.id}`);

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as { job: Job };
      setJob(data.job);

      if (data.job.status === "COMPLETE") {
        setError(null);
        router.refresh();
      }

      if (data.job.status === "FAILED") {
        setError(data.job.error ?? "Brand Kit generation failed.");
        router.refresh();
      }
    }, 1500);

    return () => window.clearInterval(interval);
  }, [isRunning, job, router]);

  async function generateBrandKit() {
    setIsStarting(true);
    setError(null);

    const response = await fetch(`/api/projects/${projectId}/brand-kit`, {
      method: "POST",
    });
    const data = (await response.json()) as {
      job?: Job;
      error?: string;
    };

    setIsStarting(false);

    if (!response.ok || !data.job) {
      setError(data.error ?? "Brand Kit generation could not start.");
      return;
    }

    setJob(data.job);

    if (data.job.status === "FAILED") {
      setError(data.job.error ?? "Brand Kit generation failed.");
    }

    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium">Brand Kit Agent</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Website research, visual analysis, source citations, and
            ad-readiness notes.
          </p>
        </div>
        <Button
          disabled={isStarting || isRunning}
          onClick={generateBrandKit}
          size="sm"
        >
          {isStarting || isRunning ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="size-4" aria-hidden="true" />
          )}
          {brandKit ? "Regenerate" : "Generate Brand Kit"}
        </Button>
      </div>

      {job ? (
        <details className="group rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-3">
              <StatusPill status={job.status} />
              <span className="text-muted-foreground">
                {job.model ?? "Model pending"}
              </span>
            </span>
            <ChevronDown
              className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <p className="mt-2 break-all border-t border-border pt-2 text-xs text-muted-foreground">
            Generation ID: {job.id}
          </p>
        </details>
      ) : null}

      {error ? (
        <div className="flex gap-2 rounded-md border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <span>{error}</span>
        </div>
      ) : null}

      {parsed ? (
        <div className="grid gap-5">
          <section className="overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/[0.08] via-background/60 to-background/40 p-5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2
                className="size-4 text-primary"
                aria-hidden="true"
              />
              Brand foundation ready
            </div>
            <p className="mt-3 max-w-4xl text-base leading-7 text-foreground/90">
              {parsed.summary}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <BrandSignal
                label="Audience"
                value={parsed.audience ?? "Broad audience"}
              />
              <BrandSignal label="Tone" value={parsed.tone} />
              <BrandSignal label="Creative lock" value={parsed.lockedStyle} />
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
            <FieldList
              description="The benefits every creative direction should make tangible."
              items={parsed.valueProps}
              title="Core value props"
            />
            <PaletteList items={parsed.palette} />
          </div>

          <div>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Creative guardrails</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Open these when you need deeper creative or evidence context.
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {parsed.sourceCitations.length} cited source
                {parsed.sourceCitations.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <ExpandableField
                icon={SwatchBook}
                items={parsed.visualMotifs}
                summary="Reusable imagery, textures, and composition cues."
                title="Visual motifs"
              />
              <ExpandableField
                icon={Lightbulb}
                items={parsed.claims}
                summary="Evidence-backed statements available to the script."
                title="Approved claims"
              />
              <ExpandableField
                icon={ShieldAlert}
                items={parsed.policyRisks}
                summary="Language or visuals that need extra care."
                title="Policy risks"
                warning
              />
              <ExpandableField
                icon={FileCheck2}
                items={parsed.sourceCitations}
                summary="The source trail behind this brand kit."
                title="Citations"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          Generate a Brand Kit after registering a website URL or uploading
          brand materials.
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className="inline-flex w-fit items-center rounded-md border border-border px-2 py-1 text-xs font-medium">
      {formatEnum(status)}
    </span>
  );
}

function BrandSignal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-background/45 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 line-clamp-3 text-sm leading-5">{value}</p>
    </div>
  );
}

function FieldList({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <section className="rounded-xl border border-border bg-background/50 p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <ul className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        {items.map((item, index) => (
          <li
            className="flex gap-2 rounded-lg border border-border/60 bg-card px-3 py-2.5"
            key={`${title}-${index}`}
          >
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PaletteList({ items }: { items: PaletteItem[] }) {
  return (
    <section className="rounded-xl border border-border bg-background/50 p-5">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Palette className="size-4 text-primary" aria-hidden="true" />
        Working palette
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Primary color cues carried into generated frames.
      </p>
      <div className="mt-4 flex min-h-16 overflow-hidden rounded-lg border border-border">
        {items.map((item, index) => (
          <div
            className="group relative min-w-12 flex-1"
            key={`${item.hex}-${index}`}
            style={{ backgroundColor: item.hex }}
          >
            <div className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1.5 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
              <p className="truncate text-[10px] font-medium text-white">
                {item.name}
              </p>
              <p className="text-[9px] text-white/70">{item.hex}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-2">
        {items.map((item, index) => (
          <div
            className="flex items-start gap-2 text-xs"
            key={`${item.name}-legend-${index}`}
          >
            <span
              className="mt-0.5 size-3 shrink-0 rounded-sm border border-white/10"
              style={{ backgroundColor: item.hex }}
            />
            <span className="font-medium">{item.name}</span>
            <span className="text-muted-foreground">{item.usage}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ExpandableField({
  title,
  summary,
  items,
  icon: Icon,
  warning = false,
}: {
  title: string;
  summary: string;
  items: string[];
  icon: typeof SwatchBook;
  warning?: boolean;
}) {
  return (
    <details
      className={`group rounded-xl border bg-background/50 ${warning && items.length > 0 ? "border-amber-400/25" : "border-border"}`}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${warning && items.length > 0 ? "bg-amber-400/10 text-amber-300" : "bg-primary/10 text-primary"}`}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-medium">
            {title}
            <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {items.length}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {summary}
          </span>
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <ul className="grid gap-2 border-t border-border px-4 py-3 text-sm text-muted-foreground">
        {items.length > 0 ? (
          items.map((item, index) => (
            <li
              className="rounded-lg bg-card px-3 py-2.5"
              key={`${title}-${index}`}
            >
              {item}
            </li>
          ))
        ) : (
          <li className="py-1 text-xs">No items identified.</li>
        )}
      </ul>
    </details>
  );
}

type PaletteItem = {
  name: string;
  hex: string;
  usage: string;
};

function normalizeBrandKit(brandKit: BrandKit | null) {
  if (!brandKit) {
    return null;
  }

  return {
    summary: brandKit.summary,
    audience: brandKit.audience,
    tone: brandKit.tone,
    lockedStyle: brandKit.lockedStyle,
    valueProps: normalizeList(brandKit.valueProps),
    palette: normalizePalette(brandKit.palette),
    visualMotifs: normalizeList(brandKit.visualMotifs),
    claims: normalizeList(brandKit.claims),
    policyRisks: normalizeList(brandKit.policyRisks),
    sourceCitations: normalizeList(brandKit.sourceCitations),
  };
}

function normalizePalette(value: unknown): PaletteItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => {
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      return {
        name: String(record.name ?? "Color"),
        hex: /^#[0-9A-Fa-f]{6}$/.test(String(record.hex))
          ? String(record.hex)
          : "#7C8A99",
        usage: String(record.usage ?? ""),
      };
    }

    return { name: String(item), hex: "#7C8A99", usage: "" };
  });
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => {
    if (typeof item === "string") {
      return item;
    }

    if (item && typeof item === "object") {
      return Object.entries(item as Record<string, unknown>)
        .map(([key, entry]) => `${formatEnum(key)}: ${String(entry)}`)
        .join(" | ");
    }

    return String(item);
  });
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
