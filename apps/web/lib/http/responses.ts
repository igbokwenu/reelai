import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { PublicError } from "@/lib/errors";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function created<T>(data: T) {
  return ok(data, { status: 201 });
}

export function badRequest(message: string, details?: unknown) {
  return ok({ error: message, details }, { status: 400 });
}

export function notFound(message = "Resource not found") {
  return ok({ error: message }, { status: 404 });
}

export function serverError(message = "Something went wrong") {
  return ok({ error: message }, { status: 500 });
}

export function zodError(error: ZodError) {
  return badRequest(
    "Invalid request",
    error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  );
}

export async function handleRoute<T>(handler: () => Promise<T>) {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof ZodError) {
      return zodError(error);
    }

    if (error instanceof PublicError) {
      return ok({ error: error.message }, { status: error.status });
    }

    console.error("Route failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return serverError();
  }
}
