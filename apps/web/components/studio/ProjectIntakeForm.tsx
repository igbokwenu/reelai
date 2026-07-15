"use client";

import {
  Box,
  Check,
  ChevronDown,
  Clapperboard,
  ImagePlus,
  Loader2,
  PackageOpen,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

type OutputMode = "STANDARD" | "PRODUCT_SHOWCASE";
type ProductDraft = {
  key: number;
  name: string;
  details: string;
  websiteUrl: string;
  files: File[];
};

export function ProjectIntakeForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [outputMode, setOutputMode] = useState<OutputMode>("STANDARD");
  const [products, setProducts] = useState<ProductDraft[]>([
    { key: 1, name: "", details: "", websiteUrl: "", files: [] },
  ]);
  const [progress, setProgress] = useState<string | null>(null);
  const isHydrated = useHydrationStatus();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const showcaseReady =
    outputMode !== "PRODUCT_SHOWCASE" ||
    (products.every(
      (product) => product.name.trim() && product.files.length > 0,
    ) &&
      products.reduce((total, product) => total + product.files.length, 0) <=
        3);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const basePayload = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );

    const imageCount = products.reduce(
      (total, product) => total + product.files.length,
      0,
    );
    if (
      outputMode === "PRODUCT_SHOWCASE" &&
      (products.some(
        (product) => !product.name.trim() || product.files.length < 1,
      ) ||
        imageCount > 3)
    ) {
      setError(
        "Add a name and at least one image for every product. Use no more than three images total.",
      );
      setIsSubmitting(false);
      return;
    }

    const payload = {
      ...basePayload,
      outputMode,
      videoLengthSec:
        outputMode === "PRODUCT_SHOWCASE"
          ? basePayload.showcaseLengthSec
          : basePayload.videoLengthSec,
      products:
        outputMode === "PRODUCT_SHOWCASE"
          ? products.map((product) => ({
              name: product.name,
              details: product.details,
              websiteUrl: product.websiteUrl,
              imageCount: product.files.length,
            }))
          : [],
      generateBrandKit: outputMode === "STANDARD",
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

      if (outputMode === "PRODUCT_SHOWCASE") {
        const createdProducts = body.project.products ?? [];
        setProgress("Uploading product references…");
        try {
          for (const [productIndex, product] of products.entries()) {
            const createdProduct = createdProducts[productIndex];
            if (!createdProduct)
              throw new Error("Product setup was incomplete.");
            for (const file of product.files) {
              const upload = new FormData();
              upload.set("file", file);
              upload.set("type", "PRODUCT_IMAGE");
              upload.set("productId", createdProduct.id);
              upload.set("label", product.name);
              const uploadResponse = await fetch(
                `/api/projects/${body.project.id}/sources`,
                { method: "POST", body: upload },
              );
              if (!uploadResponse.ok)
                throw new Error("Product image upload failed.");
            }
          }
          setProgress("Starting product analysis…");
          const brandKitResponse = await fetch(
            `/api/projects/${body.project.id}/brand-kit`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ background: true }),
            },
          );
          if (!brandKitResponse.ok)
            throw new Error("Product analysis could not start.");
        } catch {
          await fetch(`/api/projects/${body.project.id}`, {
            method: "DELETE",
          }).catch(() => undefined);
          setError(
            "We couldn't securely store the product images. The incomplete project was removed; please try again.",
          );
          return;
        }
      }

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
            onClick={() => setOutputMode("STANDARD")}
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

      {outputMode === "PRODUCT_SHOWCASE" ? (
        <ProductShowcaseFields products={products} setProducts={setProducts} />
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
            {outputMode === "PRODUCT_SHOWCASE" ? (
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
            ) : (
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

function ProductShowcaseFields({
  products,
  setProducts,
}: {
  products: ProductDraft[];
  setProducts: (products: ProductDraft[]) => void;
}) {
  const totalImages = products.reduce(
    (sum, product) => sum + product.files.length,
    0,
  );
  return (
    <section className="overflow-hidden rounded-2xl border border-primary/20 bg-[radial-gradient(circle_at_top_right,rgba(183,255,60,0.09),transparent_35%),rgba(13,16,14,0.7)]">
      <div className="flex flex-col gap-3 border-b border-white/[0.06] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Box className="size-4 text-primary" aria-hidden="true" />
            Product references
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Up to 3 products and 3 images total. Clean angles and consistent
            lighting give the strongest identity lock.
          </p>
        </div>
        <span className="w-fit rounded-full border border-border bg-background/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {totalImages}/3 images
        </span>
      </div>
      <div className="grid gap-3 p-3 sm:p-4">
        {products.map((product, index) => (
          <div
            className="rounded-xl border border-border/80 bg-background/55 p-3 sm:p-4"
            key={product.key}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Product {index + 1}
                {index === 0 ? " · Hero" : ""}
              </p>
              {products.length > 1 ? (
                <button
                  aria-label={`Remove product ${index + 1}`}
                  className="text-muted-foreground transition hover:text-destructive"
                  onClick={() =>
                    setProducts(
                      products.filter((item) => item.key !== product.key),
                    )
                  }
                  type="button"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                aria-label={`Product ${index + 1} name`}
                className="h-11 rounded-lg border border-input bg-background/80 px-3 text-sm outline-none focus:border-primary/60"
                maxLength={80}
                onChange={(event) =>
                  setProducts(
                    products.map((item) =>
                      item.key === product.key
                        ? { ...item, name: event.target.value }
                        : item,
                    ),
                  )
                }
                placeholder="Product name"
                required
                value={product.name}
              />
              <input
                aria-label={`Product ${index + 1} website`}
                className="h-11 rounded-lg border border-input bg-background/80 px-3 text-sm outline-none focus:border-primary/60"
                onChange={(event) =>
                  setProducts(
                    products.map((item) =>
                      item.key === product.key
                        ? { ...item, websiteUrl: event.target.value }
                        : item,
                    ),
                  )
                }
                placeholder="Product page (optional)"
                type="url"
                value={product.websiteUrl}
              />
            </div>
            <textarea
              aria-label={`Product ${index + 1} details`}
              className="mt-3 min-h-20 w-full resize-y rounded-lg border border-input bg-background/80 px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/60"
              maxLength={600}
              onChange={(event) =>
                setProducts(
                  products.map((item) =>
                    item.key === product.key
                      ? { ...item, details: event.target.value }
                      : item,
                  ),
                )
              }
              placeholder="Materials, ingredients, standout features, use case, or details the AI should preserve (optional)"
              value={product.details}
            />
            <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-primary/30 bg-primary/[0.035] px-3 py-3 text-xs font-medium text-primary transition hover:bg-primary/[0.07]">
              <ImagePlus className="size-4" aria-hidden="true" />
              {product.files.length
                ? `${product.files.length} image${product.files.length === 1 ? "" : "s"} selected`
                : "Add product image"}
              <input
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                multiple
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  const otherCount = totalImages - product.files.length;
                  setProducts(
                    products.map((item) =>
                      item.key === product.key
                        ? {
                            ...item,
                            files: files.slice(0, Math.max(0, 3 - otherCount)),
                          }
                        : item,
                    ),
                  );
                }}
                required={product.files.length === 0}
                type="file"
              />
            </label>
            {product.files.length > 0 ? (
              <p className="mt-2 truncate text-[11px] text-muted-foreground">
                {product.files.map((file) => file.name).join(" · ")}
              </p>
            ) : null}
          </div>
        ))}
        {products.length < 3 && totalImages < 3 ? (
          <button
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border px-3 py-3 text-xs font-medium text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
            onClick={() =>
              setProducts([
                ...products,
                {
                  key: Date.now(),
                  name: "",
                  details: "",
                  websiteUrl: "",
                  files: [],
                },
              ])
            }
            type="button"
          >
            <Plus className="size-4" aria-hidden="true" /> Add another product
          </button>
        ) : null}
      </div>
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
