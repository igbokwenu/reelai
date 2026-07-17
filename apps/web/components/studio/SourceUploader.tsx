"use client";

import {
  CheckCircle2,
  FileUp,
  Globe2,
  Loader2,
  LockKeyhole,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

export function SourceUploader({
  projectId,
  products = [],
  sources = [],
}: {
  projectId: string;
  products?: Array<{ id: string; name: string }>;
  sources?: Array<{
    type: string;
    url: string | null;
    artifactId: string | null;
  }>;
}) {
  const router = useRouter();
  const hasLogo = sources.some(
    (source) => source.type === "LOGO" && source.artifactId,
  );
  const hasProductImage = sources.some(
    (source) => source.type === "PRODUCT_IMAGE" && source.artifactId,
  );
  const websiteSource = sources.find((source) => source.url);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const isHydrated = useHydrationStatus();
  const [isUploading, setIsUploading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [uploadType, setUploadType] = useState(
    !hasLogo ? "LOGO" : !hasProductImage ? "PRODUCT_IMAGE" : "DOCUMENT",
  );
  const effectiveUploadType =
    uploadType === "LOGO" && hasLogo
      ? hasProductImage
        ? "DOCUMENT"
        : "PRODUCT_IMAGE"
      : uploadType === "PRODUCT_IMAGE" && hasProductImage
        ? hasLogo
          ? "DOCUMENT"
          : "LOGO"
        : uploadType;

  async function uploadFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setUploadError(null);
    setIsUploading(true);

    const formData = new FormData(form);
    const response = await fetch(`/api/projects/${projectId}/sources`, {
      method: "POST",
      body: formData,
    });

    setIsUploading(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setUploadError(
        body?.error ?? "Upload failed. Check the file and try again.",
      );
      return;
    }

    form.reset();
    router.refresh();
  }

  async function registerUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setUrlError(null);
    setIsRegistering(true);

    const formData = new FormData(form);
    const response = await fetch(`/api/projects/${projectId}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });

    setIsRegistering(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setUrlError(body?.error ?? "Could not register that source URL.");
      return;
    }

    form.reset();
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <SourceSlot label="Logo" filled={hasLogo} />
        <SourceSlot label="Product image" filled={hasProductImage} />
        <SourceSlot label="Website" filled={Boolean(websiteSource)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <form
          className="rounded-xl border border-border bg-background/40 p-4"
          onSubmit={uploadFile}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileUp className="size-4 text-primary" aria-hidden="true" />
            Upload brand material
          </div>
          <div className="mt-3 grid gap-2">
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              name="type"
              value={effectiveUploadType}
              onChange={(event) => setUploadType(event.target.value)}
            >
              <option disabled={hasLogo} value="LOGO">
                Logo{hasLogo ? " · slot filled" : ""}
              </option>
              <option disabled={hasProductImage} value="PRODUCT_IMAGE">
                Product image{hasProductImage ? " · slot filled" : ""}
              </option>
              <option value="DOCUMENT">Document</option>
              <option value="REFERENCE_AD">Reference ad</option>
              <option value="UPLOAD">Other upload</option>
            </select>
            {effectiveUploadType === "PRODUCT_IMAGE" && products.length > 0 ? (
              <select
                aria-label="Product for this image"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                name="productId"
                required
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            ) : null}
            <input
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              name="file"
              required
              type="file"
              accept={
                effectiveUploadType === "PRODUCT_IMAGE"
                  ? "image/png,image/jpeg,image/webp"
                  : effectiveUploadType === "LOGO"
                    ? "image/png,image/jpeg,image/webp"
                    : "image/png,image/jpeg,image/webp,image/svg+xml,application/pdf,text/plain,.docx"
              }
            />
          </div>
          {uploadError ? (
            <p className="mt-2 text-sm text-destructive">{uploadError}</p>
          ) : null}
          <Button
            disabled={!isHydrated || isUploading}
            size="sm"
            tooltip="Uploads this file into the project so future AI generations can use it as source material."
            tooltipClassName="mt-3"
            tooltipSide="bottom"
            type="submit"
          >
            {isUploading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileUp className="size-4" aria-hidden="true" />
            )}
            Store source
          </Button>
        </form>

        <form
          className="rounded-xl border border-border bg-background/40 p-4"
          onSubmit={registerUrl}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <Globe2 className="size-4 text-primary" aria-hidden="true" />
            Register source URL
          </div>
          {websiteSource ? (
            <div className="mt-3 rounded-lg border border-primary/20 bg-primary/[0.05] px-3 py-3">
              <div className="flex items-center gap-2 text-xs font-medium text-primary">
                <LockKeyhole className="size-3.5" aria-hidden="true" />
                Website slot filled
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {websiteSource.url}
              </p>
            </div>
          ) : (
            <div className="mt-3 grid gap-2">
              <input
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                name="url"
                placeholder="https://brand.example/about"
                required
                type="url"
              />
              <input
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                name="label"
                placeholder="About page, press kit, product page"
              />
              <input name="type" type="hidden" value="WEBSITE" />
            </div>
          )}
          {urlError ? (
            <p className="mt-2 text-sm text-destructive">{urlError}</p>
          ) : null}
          <Button
            disabled={!isHydrated || isRegistering || Boolean(websiteSource)}
            size="sm"
            tooltip="Adds this webpage as source material for future Brand Kit and creative generation."
            tooltipClassName="mt-3"
            tooltipSide="bottom"
            type="submit"
          >
            {isRegistering ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Globe2 className="size-4" aria-hidden="true" />
            )}
            Add URL
          </Button>
        </form>
      </div>
    </div>
  );
}

function SourceSlot({ label, filled }: { label: string; filled: boolean }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${filled ? "border-primary/20 bg-primary/[0.05]" : "border-border bg-background/35"}`}
    >
      <div className="flex items-center gap-2 text-xs font-medium">
        {filled ? (
          <CheckCircle2 className="size-3.5 text-primary" aria-hidden="true" />
        ) : (
          <span className="size-3.5 rounded-full border border-border" />
        )}
        {label}
      </div>
      <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        {filled ? "1 of 1 stored" : "0 of 1 stored"}
      </p>
    </div>
  );
}

function useHydrationStatus() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
