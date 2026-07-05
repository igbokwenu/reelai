import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

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

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `OSS ${accessKeyId}:${signature}`,
      "Content-Type": mimeType,
      Date: date,
    },
    body: new Uint8Array(body),
  });

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
