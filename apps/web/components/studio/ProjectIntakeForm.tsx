"use client";

import {
  Box,
  Check,
  ChevronDown,
  Clapperboard,
  FileImage,
  ImagePlus,
  Zap,
  Loader2,
  PackageOpen,
  Sparkles,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

type OutputMode = "STANDARD" | "PRODUCT_SHOWCASE";
type ProductDraft = {
  name: string;
  details: string;
  file: File | null;
};

export function ProjectIntakeForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [outputMode, setOutputMode] = useState<OutputMode>("STANDARD");
  const [razzmatazzMode, setRazzmatazzMode] = useState(false);
  const [product, setProduct] = useState<ProductDraft>({
    name: "",
    details: "",
    file: null,
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [reelProductFile, setReelProductFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const isHydrated = useHydrationStatus();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const showcaseReady =
    outputMode !== "PRODUCT_SHOWCASE" ||
    Boolean(product.name.trim() && product.file);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const basePayload = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );

    if (
      outputMode === "PRODUCT_SHOWCASE" &&
      (!product.name.trim() || !product.file)
    ) {
      setError("Add a product name and its one hero image to continue.");
      setIsSubmitting(false);
      return;
    }

    const payload = {
      ...basePayload,
      outputMode,
      razzmatazzMode,
      videoLengthSec: razzmatazzMode
        ? 5
        : outputMode === "PRODUCT_SHOWCASE"
          ? basePayload.showcaseLengthSec
          : basePayload.videoLengthSec,
      products:
        outputMode === "PRODUCT_SHOWCASE"
          ? [
              {
                name: product.name,
                details: product.details,
                imageCount: 1,
              },
            ]
          : [],
      generateBrandKit: false,
    };

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as
        | { project: { id: string; products?: Array<{ id: string }> } }
        | { error: string };

      if (!response.ok || "error" in body) {
        setError(
          "We couldn't start this project. Check the website address and try again.",
        );
        return;
      }

      const createdProduct = body.project.products?.[0];
      const productFile =
        outputMode === "PRODUCT_SHOWCASE" ? product.file : reelProductFile;
      setProgress("Securing your identity assets…");
      try {
        if (logoFile) {
          await uploadInitialAsset({
            projectId: body.project.id,
            file: logoFile,
            type: "LOGO",
            label: "Primary logo",
          });
        }
        if (productFile) {
          if (outputMode === "PRODUCT_SHOWCASE" && !createdProduct) {
            throw new Error("Product setup was incomplete.");
          }
          await uploadInitialAsset({
            projectId: body.project.id,
            file: productFile,
            type: "PRODUCT_IMAGE",
            label:
              outputMode === "PRODUCT_SHOWCASE"
                ? product.name
                : "Primary product",
            productId: createdProduct?.id,
          });
        }
      } catch {
        await fetch(`/api/projects/${body.project.id}`, {
          method: "DELETE",
        }).catch(() => undefined);
        setError(
          "We couldn't securely store the identity assets. The incomplete project was removed; please try again.",
        );
        return;
      }

      setProgress(
        logoFile
          ? "Reading your logo and building the palette…"
          : "Building your Brand Kit…",
      );
      await fetch(`/api/projects/${body.project.id}/brand-kit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ background: true }),
      }).catch(() => undefined);

      router.push(`/projects/${body.project.id}`);
      router.refresh();
    } catch {
      setError("We couldn't reach ReelAI. Please try again.");
    } finally {
      setIsSubmitting(false);
      setProgress(null);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium">What are you making?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <ModeCard
            active={outputMode === "STANDARD"}
            description="A story-led short-form ad with flexible pacing and brand research."
            icon={Clapperboard}
            label="Brand reel"
            onClick={() => {
              setOutputMode("STANDARD");
              setRazzmatazzMode(false);
            }}
          />
          <ModeCard
            active={outputMode === "PRODUCT_SHOWCASE"}
            badge="New"
            description="A focused 5–15s product film grounded in your real product photography."
            icon={PackageOpen}
            label="Product showcase"
            onClick={() => setOutputMode("PRODUCT_SHOWCASE")}
          />
        </div>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Field
          label={
            outputMode === "PRODUCT_SHOWCASE"
              ? "Brand website (optional)"
              : "Company website"
          }
          name="websiteUrl"
          placeholder="https://yourcompany.com"
          type="url"
        />
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground">
            Anything to keep in mind?{" "}
            <span className="opacity-70">Optional</span>
          </span>
          <input
            className="h-12 resize-none rounded-lg border border-input bg-background/80 px-3 py-3 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
            maxLength={500}
            name="brief"
            placeholder="e.g. Focus on our new product launch"
            type="text"
          />
        </label>
      </div>

      <IdentityAssetFields
        logoFile={logoFile}
        onLogoChange={setLogoFile}
        onProductChange={
          outputMode === "PRODUCT_SHOWCASE"
            ? (file) => setProduct((current) => ({ ...current, file }))
            : setReelProductFile
        }
        outputMode={outputMode}
        productFile={
          outputMode === "PRODUCT_SHOWCASE" ? product.file : reelProductFile
        }
      />

      {outputMode === "PRODUCT_SHOWCASE" ? (
        <>
          <RazzmatazzToggle
            enabled={razzmatazzMode}
            onChange={setRazzmatazzMode}
          />
          <ProductShowcaseFields product={product} setProduct={setProduct} />
        </>
      ) : null}

      <details className="group rounded-lg border border-border bg-background/40">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
          Customize project settings
          <ChevronDown
            className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="grid gap-4 border-t border-border p-4">
          <p className="text-xs leading-5 text-muted-foreground">
            These are optional when you add a website. For a manual or
            upload-first project, add both names here.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <Field
              label="Project name"
              name="name"
              placeholder="Inferred from website"
            />
            <Field
              label="Business name"
              name="businessName"
              placeholder="Inferred from website"
            />
            <Field
              label="Target audience"
              name="targetAudience"
              placeholder="Inferred from website"
            />
            <Field
              label="Specific offer"
              name="offer"
              placeholder="Inferred from website"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Select
              label="Visual style"
              name="style"
              options={[
                ["REALISTIC", "Realistic"],
                ["THREE_D_ANIMATION", "3D animation"],
              ]}
            />
            {outputMode === "PRODUCT_SHOWCASE" && !razzmatazzMode ? (
              <Select
                key="product-showcase-length"
                label="Showcase length"
                name="showcaseLengthSec"
                options={[
                  ["5", "5 seconds · punchy"],
                  ["10", "10 seconds · balanced"],
                  ["15", "15 seconds · cinematic"],
                ]}
                defaultValue="10"
              />
            ) : outputMode === "STANDARD" ? (
              <Select
                key="standard-reel-length"
                label="Video length"
                name="videoLengthSec"
                options={[
                  ["15", "15 seconds"],
                  ["30", "30 seconds"],
                  ["45", "45 seconds"],
                  ["60", "60 seconds"],
                ]}
                defaultValue="30"
              />
            ) : (
              <div className="grid gap-1.5 text-sm">
                <span className="text-muted-foreground">Showcase length</span>
                <div className="flex h-10 items-center justify-between rounded-md border border-primary/25 bg-primary/[0.07] px-3">
                  <span className="font-medium text-primary">5 seconds</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/75">
                    Locked by Razzmatazz
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </details>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-muted-foreground">
          Review and refine your Brand Kit before anything is produced.
        </p>
        <Button
          className="h-11 w-full rounded-lg px-5 sm:w-fit"
          disabled={!isHydrated || isSubmitting || !showcaseReady}
          tooltip="Creates a new workspace and starts website research for your Brand Kit."
          tooltipClassName="w-full sm:w-fit"
          tooltipSide="bottom"
          type="submit"
        >
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="size-4" aria-hidden="true" />
          )}
          {isSubmitting
            ? (progress ?? "Setting up your project…")
            : "Create project & Brand Kit"}
        </Button>
      </div>
    </form>
  );
}

function RazzmatazzToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <label
      className={`group relative cursor-pointer overflow-hidden rounded-2xl border p-4 transition-all sm:p-5 ${
        enabled
          ? "border-fuchsia-300/35 bg-[radial-gradient(circle_at_12%_0%,rgba(236,72,153,0.2),transparent_38%),radial-gradient(circle_at_92%_110%,rgba(183,255,60,0.15),transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.01))] shadow-[0_24px_70px_rgba(0,0,0,0.28)]"
          : "border-border/80 bg-background/45 hover:border-fuchsia-300/25"
      }`}
    >
      <span className="flex items-start justify-between gap-4">
        <span className="flex min-w-0 gap-3.5">
          <span
            className={`flex size-11 shrink-0 items-center justify-center rounded-xl transition ${
              enabled
                ? "bg-gradient-to-br from-fuchsia-300 to-primary text-black shadow-lg shadow-fuchsia-500/15"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <Zap className="size-5" aria-hidden="true" />
          </span>
          <span>
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">Razzmatazz mode</span>
              <span className="rounded-full border border-fuchsia-300/25 bg-fuchsia-300/[0.08] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-fuchsia-200">
                5-second mini ad
              </span>
            </span>
            <span className="mt-1.5 block max-w-2xl text-xs leading-5 text-muted-foreground">
              One exhilarating hero shot: the intact product makes one bold,
              identity-safe move while light, particles, and atmosphere build a
              premium burst around it. A sharp tagline lands in the second half.
            </span>
            <span className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-medium text-muted-foreground">
              {[
                "1 scene",
                "5 seconds",
                "No teardown",
                "Product-centered",
                "CTA included",
              ].map((item) => (
                <span
                  className="rounded-full border border-white/10 bg-black/15 px-2 py-1"
                  key={item}
                >
                  {item}
                </span>
              ))}
            </span>
          </span>
        </span>
        <span className="relative mt-1 shrink-0">
          <input
            aria-label="Enable Razzmatazz mode"
            checked={enabled}
            className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0"
            onChange={(event) => onChange(event.target.checked)}
            type="checkbox"
          />
          <span className="pointer-events-none block h-7 w-12 rounded-full bg-muted ring-1 ring-border transition-colors peer-checked:bg-gradient-to-r peer-checked:from-fuchsia-400 peer-checked:to-primary" />
          <span className="pointer-events-none absolute left-1 top-1 size-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5 peer-checked:bg-black" />
        </span>
      </span>
      {enabled ? (
        <span className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
          <span className="text-[10px] font-semibold text-fuchsia-200">
            0:00
          </span>
          <span className="relative h-1.5 overflow-hidden rounded-full bg-white/10">
            <span className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-fuchsia-400 to-primary" />
            <span className="absolute left-1/2 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-4 ring-white/10" />
          </span>
          <span className="text-[10px] font-semibold text-primary">0:05</span>
        </span>
      ) : null}
    </label>
  );
}

function ModeCard({
  active,
  badge,
  description,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  badge?: string;
  description: string;
  icon: typeof Clapperboard;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`relative rounded-2xl border p-4 text-left transition ${
        active
          ? "border-primary/45 bg-primary/[0.07] shadow-[0_0_0_1px_rgba(183,255,60,0.08)]"
          : "border-border bg-background/45 hover:border-border/90 hover:bg-background/70"
      }`}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`flex size-10 items-center justify-center rounded-xl ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        {badge ? (
          <span className="rounded-full bg-primary/12 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
            {badge}
          </span>
        ) : null}
      </div>
      <span className="mt-4 flex items-center gap-2 text-sm font-semibold">
        {label}
        {active ? (
          <Check className="size-3.5 text-primary" aria-hidden="true" />
        ) : null}
      </span>
      <span className="mt-1.5 block text-xs leading-5 text-muted-foreground">
        {description}
      </span>
    </button>
  );
}

function IdentityAssetFields({
  logoFile,
  onLogoChange,
  productFile,
  onProductChange,
  outputMode,
}: {
  logoFile: File | null;
  onLogoChange: (file: File | null) => void;
  productFile: File | null;
  onProductChange: (file: File | null) => void;
  outputMode: OutputMode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-primary/20 bg-[radial-gradient(circle_at_top_right,rgba(183,255,60,0.09),transparent_35%),rgba(13,16,14,0.7)]">
      <div className="flex flex-col gap-3 border-b border-white/[0.06] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <UploadCloud className="size-4 text-primary" aria-hidden="true" />
            Identity assets
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {outputMode === "PRODUCT_SHOWCASE"
              ? "Add one required hero product image and an optional logo for a clean, consistent identity lock."
              : "One optional logo and one optional hero product image keep every generation visually consistent."}
          </p>
        </div>
        <span className="w-fit rounded-full border border-border bg-background/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          One per slot
        </span>
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4">
        <AssetPicker
          accept="image/png,image/jpeg,image/webp"
          description="Shapes the working palette and final brand lock."
          file={logoFile}
          icon={FileImage}
          label="Logo"
          onChange={onLogoChange}
        />
        <AssetPicker
          accept="image/png,image/jpeg,image/webp"
          description={
            outputMode === "PRODUCT_SHOWCASE"
              ? "Required · the visual source of truth for the showcase."
              : "Optional · grounds product details when your reel features one."
          }
          file={productFile}
          icon={Box}
          label="Product image"
          onChange={onProductChange}
          required={outputMode === "PRODUCT_SHOWCASE"}
        />
      </div>
    </section>
  );
}

function AssetPicker({
  accept,
  description,
  file,
  icon: Icon,
  label,
  onChange,
  required = false,
}: {
  accept: string;
  description: string;
  file: File | null;
  icon: LucideIcon;
  label: string;
  onChange: (file: File | null) => void;
  required?: boolean;
}) {
  return (
    <label className="group cursor-pointer rounded-xl border border-border/80 bg-background/55 p-4 transition hover:border-primary/30 hover:bg-primary/[0.035]">
      <span className="flex items-start justify-between gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/[0.09] text-primary">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="rounded-full border border-border bg-background/70 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {required ? "Required" : "Optional"}
        </span>
      </span>
      <span className="mt-3 block text-sm font-semibold">{label}</span>
      <span className="mt-1 block min-h-10 text-xs leading-5 text-muted-foreground">
        {description}
      </span>
      <span className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-primary/25 bg-primary/[0.03] px-3 py-2.5 text-xs font-medium text-primary">
        <ImagePlus className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">
          {file ? file.name : `Choose ${label.toLowerCase()}`}
        </span>
      </span>
      <input
        accept={accept}
        aria-label={label}
        className="sr-only"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        required={required && !file}
        type="file"
      />
    </label>
  );
}

function ProductShowcaseFields({
  product,
  setProduct,
}: {
  product: ProductDraft;
  setProduct: (product: ProductDraft) => void;
}) {
  return (
    <section className="rounded-2xl border border-border/80 bg-background/45 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Box className="size-4 text-primary" aria-hidden="true" />
        Hero product details
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        One product, one unmistakable visual identity, and fewer opportunities
        for generation drift.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input
          aria-label="Product 1 name"
          className="h-11 rounded-lg border border-input bg-background/80 px-3 text-sm outline-none focus:border-primary/60"
          maxLength={80}
          onChange={(event) =>
            setProduct({ ...product, name: event.target.value })
          }
          placeholder="Product name"
          required
          value={product.name}
        />
        <div className="flex h-11 items-center rounded-lg border border-border/70 bg-muted/25 px-3 text-xs text-muted-foreground">
          Uses the single project website above as URL context
        </div>
      </div>
      <textarea
        aria-label="Product 1 details"
        className="mt-3 min-h-20 w-full resize-y rounded-lg border border-input bg-background/80 px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/60"
        maxLength={600}
        onChange={(event) =>
          setProduct({ ...product, details: event.target.value })
        }
        placeholder="Materials, ingredients, standout features, use case, or details the AI should preserve (optional)"
        value={product.details}
      />
    </section>
  );
}

function useHydrationStatus() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

async function uploadInitialAsset({
  projectId,
  file,
  type,
  label,
  productId,
}: {
  projectId: string;
  file: File;
  type: "LOGO" | "PRODUCT_IMAGE";
  label: string;
  productId?: string;
}) {
  const upload = new FormData();
  upload.set("file", file);
  upload.set("type", type);
  upload.set("label", label);
  if (productId) upload.set("productId", productId);
  const response = await fetch(`/api/projects/${projectId}/sources`, {
    method: "POST",
    body: upload,
  });
  if (!response.ok) throw new Error(`${label} upload failed.`);
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        className="h-12 rounded-lg border border-input bg-background/80 px-3 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
    </label>
  );
}

function Select({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: string[][];
  defaultValue?: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select
        className="h-10 rounded-md border border-input bg-background px-3 text-foreground"
        defaultValue={defaultValue}
        name={name}
      >
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}
