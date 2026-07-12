"use client";

import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

export function ProjectIntakeForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const isHydrated = useHydrationStatus();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, generateBrandKit: true }),
      });
      const body = (await response.json()) as
        | { project: { id: string } }
        | { error: string };

      if (!response.ok || "error" in body) {
        setError("We couldn't start this project. Check the website address and try again.");
        return;
      }

      router.push(`/projects/${body.project.id}`);
      router.refresh();
    } catch {
      setError("We couldn't reach ReelAI. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Field
          label="Company website"
          name="websiteUrl"
          placeholder="https://yourcompany.com"
          type="url"
        />
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground">Anything to keep in mind? <span className="opacity-70">Optional</span></span>
          <input
            className="h-12 resize-none rounded-lg border border-input bg-background/80 px-3 py-3 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
            maxLength={500}
            name="brief"
            placeholder="e.g. Focus on our new product launch"
            type="text"
          />
        </label>
      </div>

      <details className="group rounded-lg border border-border bg-background/40">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
          Customize project settings
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="grid gap-4 border-t border-border p-4">
          <p className="text-xs leading-5 text-muted-foreground">
            These are optional when you add a website. For a manual or upload-first project, add both names here.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Project name" name="name" placeholder="Inferred from website" />
            <Field label="Business name" name="businessName" placeholder="Inferred from website" />
            <Field label="Target audience" name="targetAudience" placeholder="Inferred from website" />
            <Field label="Specific offer" name="offer" placeholder="Inferred from website" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Select label="Visual style" name="style" options={[["REALISTIC", "Realistic"], ["THREE_D_ANIMATION", "3D animation"]]} />
            <Select label="Video length" name="videoLengthSec" options={[["15", "15 seconds"], ["30", "30 seconds"], ["45", "45 seconds"], ["60", "60 seconds"]]} defaultValue="30" />
          </div>
        </div>
      </details>

      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-muted-foreground">Review and refine your Brand Kit before anything is produced.</p>
        <Button className="h-11 w-full rounded-lg px-5 sm:w-fit" disabled={!isHydrated || isSubmitting} type="submit">
          {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
          {isSubmitting ? "Setting up your project…" : "Create project & Brand Kit"}
        </Button>
      </div>
    </form>
  );
}

function useHydrationStatus() {
  return useSyncExternalStore(() => () => {}, () => true, () => false);
}

function Field({ label, name, placeholder, type = "text", required = false }: { label: string; name: string; placeholder: string; type?: string; required?: boolean }) {
  return <label className="grid gap-1.5 text-sm"><span className="text-muted-foreground">{label}</span><input className="h-12 rounded-lg border border-input bg-background/80 px-3 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/10" name={name} placeholder={placeholder} required={required} type={type} /></label>;
}

function Select({ label, name, options, defaultValue }: { label: string; name: string; options: string[][]; defaultValue?: string }) {
  return <label className="grid gap-1.5 text-sm"><span className="text-muted-foreground">{label}</span><select className="h-10 rounded-md border border-input bg-background px-3 text-foreground" defaultValue={defaultValue} name={name}>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
}
