"use client";

import { FileUp, Globe2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

export function SourceUploader({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  async function uploadFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError(null);
    setIsUploading(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch(`/api/projects/${projectId}/sources`, {
      method: "POST",
      body: formData,
    });

    setIsUploading(false);

    if (!response.ok) {
      setUploadError(
        "Upload failed. Use PNG, JPG, WebP, SVG, PDF, text, or DOCX.",
      );
      return;
    }

    event.currentTarget.reset();
    router.refresh();
  }

  async function registerUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUrlError(null);
    setIsRegistering(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch(`/api/projects/${projectId}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });

    setIsRegistering(false);

    if (!response.ok) {
      setUrlError("Could not register that source URL.");
      return;
    }

    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form
        className="rounded-md border border-border p-3"
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
            defaultValue="LOGO"
          >
            <option value="LOGO">Logo</option>
            <option value="PRODUCT_IMAGE">Product image</option>
            <option value="DOCUMENT">Document</option>
            <option value="REFERENCE_AD">Reference ad</option>
            <option value="UPLOAD">Other upload</option>
          </select>
          <input
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            name="file"
            required
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf,text/plain,.docx"
          />
        </div>
        {uploadError ? (
          <p className="mt-2 text-sm text-destructive">{uploadError}</p>
        ) : null}
        <Button className="mt-3" disabled={isUploading} size="sm" type="submit">
          {isUploading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <FileUp className="size-4" aria-hidden="true" />
          )}
          Store source
        </Button>
      </form>

      <form
        className="rounded-md border border-border p-3"
        onSubmit={registerUrl}
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <Globe2 className="size-4 text-primary" aria-hidden="true" />
          Register source URL
        </div>
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
        {urlError ? (
          <p className="mt-2 text-sm text-destructive">{urlError}</p>
        ) : null}
        <Button
          className="mt-3"
          disabled={isRegistering}
          size="sm"
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
  );
}
