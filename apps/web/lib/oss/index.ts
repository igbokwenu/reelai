import crypto from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { fetchWithRetry } from "@/lib/http/fetch-with-retry";

const localArtifactRoot = path.join(process.cwd(), ".data", "artifacts");

export type StoredObject = {
  key: string;
  publicUrl: string | null;
  storageMode: "oss" | "local";
  size: number;
};

export type StoreObjectInput = {
  projectId: string;
  fileName: string;
  mimeType: string;
  body: Buffer;
};

function safeFileName(fileName: string) {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function hasOssConfig() {
  const values = [
    process.env.OSS_REGION,
    process.env.OSS_BUCKET,
    process.env.OSS_ACCESS_KEY_ID,
    process.env.OSS_ACCESS_KEY_SECRET,
  ];

  return values.every(
    (value) => value && !value.toLowerCase().includes("placeholder"),
  );
}

function buildObjectKey(projectId: string, fileName: string) {
  const id = crypto.randomUUID();
  return `projects/${projectId}/sources/${id}-${safeFileName(fileName)}`;
}

export async function storeObject(
  input: StoreObjectInput,
): Promise<StoredObject> {
  const key = buildObjectKey(input.projectId, input.fileName);

  if (hasOssConfig()) {
    return uploadToOss({
      key,
      body: input.body,
      mimeType: input.mimeType,
    });
  }

  const filePath = path.join(localArtifactRoot, key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, input.body);

  return {
    key,
    publicUrl: `/api/artifacts/by-key/${encodeURIComponent(key)}`,
    storageMode: "local",
    size: input.body.byteLength,
  };
}

export async function readLocalObject(key: string) {
  if (key.includes("..")) {
    throw new Error("Invalid artifact key");
  }

  return readFile(path.join(localArtifactRoot, key));
}

export async function deleteStoredObject(key: string) {
  if (key.includes("..") || !key.startsWith("projects/")) {
    throw new Error("Invalid artifact key");
  }

  if (hasOssConfig()) {
    await deleteFromOss(key);
    return;
  }

  try {
    await unlink(path.join(localArtifactRoot, key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function deleteFromOss(key: string) {
  const region = process.env.OSS_REGION;
  const bucket = process.env.OSS_BUCKET;
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
  if (!region || !bucket || !accessKeyId || !accessKeySecret) {
    throw new Error("OSS configuration is incomplete");
  }

  const date = new Date().toUTCString();
  const canonicalResource = `/${bucket}/${key}`;
  const signature = crypto.createHmac("sha1", accessKeySecret).update(["DELETE", "", "", date, canonicalResource].join("\n")).digest("base64");
  const response = await fetch(`https://${bucket}.${region}.aliyuncs.com/${key}`, {
    method: "DELETE",
    headers: { Authorization: `OSS ${accessKeyId}:${signature}`, Date: date },
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`OSS delete failed with status ${response.status}`);
  }
}

async function uploadToOss({
  key,
  body,
  mimeType,
}: {
  key: string;
  body: Buffer;
  mimeType: string;
}): Promise<StoredObject> {
  const region = process.env.OSS_REGION;
  const bucket = process.env.OSS_BUCKET;
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;

  if (!region || !bucket || !accessKeyId || !accessKeySecret) {
    throw new Error("OSS configuration is incomplete");
  }

  const date = new Date().toUTCString();
  const canonicalResource = `/${bucket}/${key}`;
  const stringToSign = ["PUT", "", mimeType, date, canonicalResource].join(
    "\n",
  );
  const signature = crypto
    .createHmac("sha1", accessKeySecret)
    .update(stringToSign)
    .digest("base64");
  const url = `https://${bucket}.${region}.aliyuncs.com/${key}`;

  let response: Response;

  try {
    response = await fetchWithRetry(
      url,
      {
        method: "PUT",
        headers: {
          Authorization: `OSS ${accessKeyId}:${signature}`,
          "Content-Type": mimeType,
          Date: date,
        },
        body: new Uint8Array(body),
      },
      { attempts: 3, baseDelayMs: 750 },
    );
  } catch {
    throw new Error("OSS upload failed after three network attempts.");
  }

  if (!response.ok) {
    throw new Error(`OSS upload failed with status ${response.status}`);
  }

  return {
    key,
    publicUrl: url,
    storageMode: "oss",
    size: body.byteLength,
  };
}
