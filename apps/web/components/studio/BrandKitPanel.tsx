"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Palette,
  Sparkles,
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
  const [error, setError] = useState<string | null>(latestBrandKitJob?.error ?? null);
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
            Website research, visual analysis, source citations, and ad-readiness notes.
          </p>
        </div>
        <Button disabled={isStarting || isRunning} onClick={generateBrandKit} size="sm">
          {isStarting || isRunning ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="size-4" aria-hidden="true" />
          )}
          {brandKit ? "Regenerate" : "Generate Brand Kit"}
        </Button>
      </div>

      {job ? (
        <div className="grid gap-2 rounded-md border border-border bg-background/60 p-3 text-sm md:grid-cols-3">
          <StatusPill status={job.status} />
          <span className="text-muted-foreground">Model: {job.model ?? "pending"}</span>
          <span className="text-muted-foreground">Job: {job.id}</span>
        </div>
      ) : null}

      {error ? (
        <div className="flex gap-2 rounded-md border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {parsed ? (
        <div className="grid gap-4">
          <section className="rounded-md border border-border bg-background/50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
              Summary
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{parsed.summary}</p>
            {parsed.audience ? (
              <p className="mt-3 text-sm">
                <span className="font-medium">Audience:</span> {parsed.audience}
              </p>
            ) : null}
            <p className="mt-2 text-sm">
              <span className="font-medium">Tone:</span> {parsed.tone}
            </p>
            <p className="mt-2 text-sm">
              <span className="font-medium">Locked style:</span> {parsed.lockedStyle}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Grounded in {parsed.sourceCitations.length} cited source{parsed.sourceCitations.length === 1 ? "" : "s"}. Review low-confidence claims and risks before production.
            </p>
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <FieldList title="Value Props" items={parsed.valueProps} />
            <PaletteList items={parsed.palette} />
            <FieldList title="Claims" items={parsed.claims} />
            <FieldList title="Policy Risks" items={parsed.policyRisks} />
            <FieldList title="Visual Motifs" items={parsed.visualMotifs} />
            <FieldList title="Citations" items={parsed.sourceCitations} />
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          Generate a Brand Kit after registering a website URL or uploading brand materials.
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

function FieldList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-md border border-border bg-background/50 p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      <ul className="mt-3 grid gap-2 text-sm text-muted-foreground">
        {items.map((item, index) => (
          <li className="rounded-md bg-card px-3 py-2" key={`${title}-${index}`}>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PaletteList({ items }: { items: PaletteItem[] }) {
  return (
    <section className="rounded-md border border-border bg-background/50 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Palette className="size-4 text-primary" aria-hidden="true" />
        Palette
      </div>
      <div className="mt-3 grid gap-2">
        {items.map((item, index) => (
          <div className="flex items-center gap-3 rounded-md bg-card px-3 py-2" key={`${item.hex}-${index}`}>
            <span
              className="size-5 shrink-0 rounded-sm border border-border"
              style={{ backgroundColor: item.hex }}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium">{item.name} {item.hex}</p>
              <p className="text-xs text-muted-foreground">{item.usage}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
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
        hex: /^#[0-9A-Fa-f]{6}$/.test(String(record.hex)) ? String(record.hex) : "#7C8A99",
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
