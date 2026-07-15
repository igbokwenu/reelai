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
const productImageMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

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
      include: {
        products: { select: { id: true } },
        sources: {
          where: { type: "PRODUCT_IMAGE", artifactId: { not: null } },
          select: { id: true, productId: true },
        },
      },
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
      const productIdValue = formData.get("productId");
      const productId = productIdValue ? String(productIdValue) : null;
      const labelValue = formData.get("label");

      if (!(file instanceof File)) {
        return badRequest("A file is required");
      }

      if (!uploadMimeTypes.has(file.type)) {
        return badRequest("Unsupported file type");
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        return badRequest("Files must be 10 MB or smaller");
      }
      if (type === "PRODUCT_IMAGE") {
        if (!productImageMimeTypes.has(file.type)) {
          return badRequest("Product images must be PNG, JPG, or WebP");
        }
        if (
          productId &&
          !project.products.some((product) => product.id === productId)
        ) {
          return badRequest("Choose a product in this project");
        }
        if (project.outputMode === "PRODUCT_SHOWCASE" && !productId) {
          return badRequest(
            "Choose a product in this showcase for every product image",
          );
        }
        if (
          project.outputMode === "PRODUCT_SHOWCASE" &&
          project.sources.length >= 3
        ) {
          return badRequest(
            "Product Showcase supports up to three product images total",
          );
        }
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
          productId,
          metadata: {
            originalName: file.name,
            mimeType: file.type,
            label: labelValue ? String(labelValue).slice(0, 80) : undefined,
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
