"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

export function ProjectIntakeForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as
      { project: { id: string } } | { error: string };

    setIsSubmitting(false);

    if (!response.ok || "error" in body) {
      setError("Could not create project. Check the highlighted inputs.");
      return;
    }

    router.push(`/projects/${body.project.id}`);
    router.refresh();
  }

  return (
    <form className="grid gap-3" onSubmit={onSubmit}>
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label="Project name"
          name="name"
          placeholder="Summer launch reel"
        />
        <Field
          label="Business name"
          name="businessName"
          placeholder="Northstar Coffee"
        />
      </div>
      <Field
        label="Website URL"
        name="websiteUrl"
        placeholder="https://example.com"
        type="url"
      />
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label="Target audience"
          name="targetAudience"
          placeholder="Busy founders and creative teams"
        />
        <Field
          label="Offer"
          name="offer"
          placeholder="Cold brew subscription"
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Style</span>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-foreground"
            name="style"
            defaultValue="REALISTIC"
          >
            <option value="REALISTIC">Realistic</option>
            <option value="THREE_D_ANIMATION">3D animation</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Length target</span>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-foreground"
            name="videoLengthSec"
            defaultValue="30"
          >
            <option value="15">15 seconds</option>
            <option value="30">30 seconds</option>
            <option value="45">45 seconds</option>
            <option value="60">60 seconds</option>
          </select>
        </label>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button className="w-fit" disabled={isSubmitting} type="submit">
        {isSubmitting ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Plus className="size-4" aria-hidden="true" />
        )}
        Create project
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
}: {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        className="h-10 rounded-md border border-input bg-background px-3 text-foreground placeholder:text-muted-foreground"
        name={name}
        placeholder={placeholder}
        required={name === "name" || name === "businessName"}
        type={type}
      />
    </label>
  );
}
