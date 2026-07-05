import {
  badRequest,
  created,
  handleRoute,
  notFound,
} from "@/lib/http/responses";
import { storeObject } from "@/lib/oss";
import { prisma } from "@/lib/prisma";
import { registerSourceSchema, sourceTypeSchema } from "@/lib/schemas/project";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

const uploadMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function artifactTypeForMimeType(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return "IMAGE";
  }

  return "DOCUMENT";
}

export async function POST(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { projectId } = await context.params;
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return notFound("Project not found");
    }

    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      const rawType = formData.get("type") ?? "UPLOAD";
      const type = sourceTypeSchema.parse(String(rawType));

      if (!(file instanceof File)) {
        return badRequest("A file is required");
      }

      if (!uploadMimeTypes.has(file.type)) {
        return badRequest("Unsupported file type");
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const stored = await storeObject({
        projectId,
        fileName: file.name,
        mimeType: file.type,
        body: buffer,
      });

      const artifact = await prisma.artifact.create({
        data: {
          projectId,
          type: artifactTypeForMimeType(file.type),
          ossKey: stored.key,
          publicUrl: stored.publicUrl,
          mimeType: file.type,
          metadata: {
            originalName: file.name,
            size: stored.size,
            storageMode: stored.storageMode,
          },
        },
      });

      const source = await prisma.brandSource.create({
        data: {
          projectId,
          type,
          artifactId: artifact.id,
          metadata: {
            originalName: file.name,
            mimeType: file.type,
          },
        },
      });

      return created({ source, artifact });
    }

    const input = registerSourceSchema.parse(await request.json());
    const source = await prisma.brandSource.create({
      data: {
        projectId,
        type: input.type,
        url: input.url,
        extractedText: input.extractedText,
        metadata: {
          label: input.label,
          source: "manual-registration",
        },
      },
    });

    return created({ source });
  });
}
