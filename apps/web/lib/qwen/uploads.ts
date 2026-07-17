import "server-only";

import crypto from "node:crypto";

import type { Artifact } from "@prisma/client";

import { readLocalObject } from "@/lib/oss";
import { qwenEndpoint } from "@/lib/qwen/endpoints";

const QWEN_NATIVE_BASE_URL = qwenEndpoint(
  process.env.QWEN_IMAGE_BASE_URL ?? process.env.QWEN_VIDEO_BASE_URL,
  "https://dashscope-intl.aliyuncs.com/api/v1",
);

type UploadPolicy = {
  upload_dir: string;
  upload_host: string;
  oss_access_key_id: string;
  signature: string;
  policy: string;
  x_oss_object_acl: string;
  x_oss_forbid_overwrite: string;
};

/**
 * Returns a provider-readable image URL for both OSS-backed and local-dev
 * artifacts. Local files are copied to DashScope's temporary OSS storage so
 * reference-based generation does not silently degrade to text-to-image.
 */
export async function resolveArtifactForQwen(
  artifact: Pick<Artifact, "id" | "ossKey" | "publicUrl" | "mimeType">,
  model: string,
) {
  if (
    artifact.publicUrl?.startsWith("http://") ||
    artifact.publicUrl?.startsWith("https://")
  ) {
    return artifact.publicUrl;
  }

  const body = await readLocalObject(artifact.ossKey);
  return uploadBufferToQwen({
    body,
    fileName: `${artifact.id}.${extensionForMimeType(artifact.mimeType)}`,
    mimeType: artifact.mimeType,
    model,
  });
}

export async function uploadBufferToQwen({
  body,
  fileName,
  mimeType,
  model,
}: {
  body: Buffer;
  fileName: string;
  mimeType: string;
  model: string;
}) {
  const apiKey = getQwenApiKey();
  const policyResponse = await fetch(
    `${QWEN_NATIVE_BASE_URL}/uploads?action=getPolicy&model=${encodeURIComponent(model)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!policyResponse.ok) {
    throw new Error("QwenCloud could not prepare a local reference image.");
  }

  const payload = (await policyResponse.json()) as { data?: UploadPolicy };
  const policy = payload.data;
  if (!policy) {
    throw new Error("QwenCloud returned an invalid reference upload policy.");
  }

  const safeName = `${crypto.randomUUID()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  const objectKey = `${policy.upload_dir}/${safeName}`;
  const form = new FormData();
  form.set("OSSAccessKeyId", policy.oss_access_key_id);
  form.set("Signature", policy.signature);
  form.set("policy", policy.policy);
  form.set("x-oss-object-acl", policy.x_oss_object_acl);
  form.set("x-oss-forbid-overwrite", policy.x_oss_forbid_overwrite);
  form.set("key", objectKey);
  form.set("success_action_status", "200");
  form.set(
    "file",
    new Blob([new Uint8Array(body)], { type: mimeType }),
    safeName,
  );

  const uploadResponse = await fetch(policy.upload_host, {
    method: "POST",
    body: form,
  });
  if (!uploadResponse.ok) {
    throw new Error("QwenCloud could not upload a local reference image.");
  }

  return `oss://${objectKey}`;
}

export function hasQwenManagedUrl(value: unknown): boolean {
  if (typeof value === "string") return value.startsWith("oss://");
  if (Array.isArray(value)) return value.some(hasQwenManagedUrl);
  if (value && typeof value === "object") {
    return Object.values(value).some(hasQwenManagedUrl);
  }
  return false;
}

function extensionForMimeType(mimeType: string) {
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("svg")) return "svg";
  return "png";
}

function getQwenApiKey() {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey || apiKey.toLowerCase().includes("placeholder")) {
    throw new Error("QwenCloud API key is not configured on the server.");
  }
  return apiKey;
}
