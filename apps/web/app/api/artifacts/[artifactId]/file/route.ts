import { handleRoute, notFound } from "@/lib/http/responses";
import { fetchWithRetry } from "@/lib/http/fetch-with-retry";
import { parseByteRange } from "@/lib/media/http-range";
import { readLocalObject } from "@/lib/oss";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ artifactId: string }>;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Headers": "Content-Type, Range",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Expose-Headers":
    "Accept-Ranges, Content-Length, Content-Range, Content-Type",
};

export async function GET(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { artifactId } = await context.params;
    const artifact = await prisma.artifact.findUnique({
      where: { id: artifactId },
    });

    if (!artifact) {
      return notFound("Artifact not found");
    }

    if (artifact.publicUrl?.startsWith("http")) {
      const upstream = await fetchWithRetry(artifact.publicUrl, {
        headers: request.headers.get("range")
          ? { Range: request.headers.get("range")! }
          : undefined,
      });

      if (!upstream.ok) {
        throw new Error(
          `Stored artifact could not be streamed (status ${upstream.status}).`,
        );
      }

      return new Response(upstream.body, {
        status: upstream.status,
        headers: mediaHeaders({
          artifactId: artifact.id,
          contentLength: upstream.headers.get("content-length"),
          contentRange: upstream.headers.get("content-range"),
          mimeType: upstream.headers.get("content-type") ?? artifact.mimeType,
        }),
      });
    }

    const body = await readLocalObject(artifact.ossKey);
    const range = parseByteRange(request.headers.get("range"), body.length);
    const responseBody = range
      ? body.subarray(range.start, range.end + 1)
      : body;

    return new Response(responseBody, {
      status: range ? 206 : 200,
      headers: mediaHeaders({
        artifactId: artifact.id,
        contentLength: String(responseBody.length),
        contentRange: range
          ? `bytes ${range.start}-${range.end}/${body.length}`
          : null,
        mimeType: artifact.mimeType,
      }),
    });
  });
}

export async function HEAD(_request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { artifactId } = await context.params;
    const artifact = await prisma.artifact.findUnique({
      where: { id: artifactId },
    });

    if (!artifact) return notFound("Artifact not found");

    if (artifact.publicUrl?.startsWith("http")) {
      const upstream = await fetchWithRetry(artifact.publicUrl, {
        method: "HEAD",
      });
      if (!upstream.ok) {
        throw new Error(
          `Stored artifact could not be inspected (status ${upstream.status}).`,
        );
      }

      return new Response(null, {
        headers: mediaHeaders({
          artifactId: artifact.id,
          contentLength: upstream.headers.get("content-length"),
          contentRange: null,
          mimeType: upstream.headers.get("content-type") ?? artifact.mimeType,
        }),
      });
    }

    const body = await readLocalObject(artifact.ossKey);
    return new Response(null, {
      headers: mediaHeaders({
        artifactId: artifact.id,
        contentLength: String(body.length),
        contentRange: null,
        mimeType: artifact.mimeType,
      }),
    });
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function mediaHeaders({
  artifactId,
  contentLength,
  contentRange,
  mimeType,
}: {
  artifactId: string;
  contentLength: string | null;
  contentRange: string | null;
  mimeType: string;
}) {
  const headers = new Headers({
    ...CORS_HEADERS,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Disposition": `inline; filename="${artifactId}"`,
    "Content-Type": mimeType,
  });

  if (contentLength) headers.set("Content-Length", contentLength);
  if (contentRange) headers.set("Content-Range", contentRange);
  return headers;
}
