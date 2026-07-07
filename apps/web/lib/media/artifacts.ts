import "server-only";

import type { ArtifactType, Prisma } from "@prisma/client";

import { storeObject } from "@/lib/oss";
import { prisma } from "@/lib/prisma";

export async function createStoredArtifact({
  projectId,
  fileName,
  mimeType,
  type,
  body,
  metadata,
  durationSec,
  width,
  height,
}: {
  projectId: string;
  fileName: string;
  mimeType: string;
  type: ArtifactType;
  body: Buffer;
  metadata: Prisma.InputJsonValue;
  durationSec?: number;
  width?: number;
  height?: number;
}) {
  const stored = await storeObject({
    projectId,
    fileName,
    mimeType,
    body,
  });

  return prisma.artifact.create({
    data: {
      projectId,
      type,
      ossKey: stored.key,
      publicUrl: stored.publicUrl,
      mimeType,
      width,
      height,
      durationSec,
      metadata: {
        ...(metadata as Record<string, unknown>),
        sourceCopiedToDurableStorage: true,
        storageMode: stored.storageMode,
        size: stored.size,
      },
    },
  });
}

export async function createArtifactFromUrl({
  projectId,
  fileName,
  mimeType,
  type,
  url,
  metadata,
  durationSec,
  width,
  height,
}: {
  projectId: string;
  fileName: string;
  mimeType: string;
  type: ArtifactType;
  url: string;
  metadata: Prisma.InputJsonValue;
  durationSec?: number;
  width?: number;
  height?: number;
}) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Provider output could not be copied into durable storage.");
  }

  const body = Buffer.from(await response.arrayBuffer());

  return createStoredArtifact({
    projectId,
    fileName,
    mimeType: response.headers.get("content-type") ?? mimeType,
    type,
    body,
    metadata,
    durationSec,
    width,
    height,
  });
}
