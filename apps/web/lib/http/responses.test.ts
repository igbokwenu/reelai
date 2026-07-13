import { describe, expect, it, vi } from "vitest";

import { PublicError } from "@/lib/errors";

import { handleRoute } from "./responses";

describe("handleRoute", () => {
  it("returns explicitly public production errors to the client", async () => {
    const response = await handleRoute(async () => {
      throw new PublicError("Approve every storyboard scene first.", 409);
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Approve every storyboard scene first.",
    });
  });

  it("keeps unexpected internal errors private", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const response = await handleRoute(async () => {
      throw new Error("private database detail");
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Something went wrong",
    });
    consoleError.mockRestore();
  });
});
