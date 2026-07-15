import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findActiveRun: vi.fn(),
  findTake: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    autoGenerationRun: { findFirst: mocks.findActiveRun },
    take: { findUnique: mocks.findTake },
  },
}));

import {
  assertManualControlAvailable,
  assertManualTakeControlAvailable,
  AUTO_CONTROL_MESSAGE,
} from "@/lib/jobs/manual-control";

describe("manual controls during Auto mode", () => {
  beforeEach(() => {
    mocks.findActiveRun.mockReset();
    mocks.findTake.mockReset();
  });

  it("allows manual work when no active coordinator owns the project", async () => {
    mocks.findActiveRun.mockResolvedValue(null);

    await expect(
      assertManualControlAvailable("project-1"),
    ).resolves.toBeUndefined();
  });

  it("blocks stale manual requests while Auto mode is active", async () => {
    mocks.findActiveRun.mockResolvedValue({ id: "auto-1" });

    await expect(
      assertManualControlAvailable("project-1"),
    ).rejects.toMatchObject({
      message: AUTO_CONTROL_MESSAGE,
      status: 409,
    });
  });

  it("resolves take ownership before applying the same project lock", async () => {
    mocks.findTake.mockResolvedValue({
      scene: { storyboard: { projectId: "project-1" } },
    });
    mocks.findActiveRun.mockResolvedValue({ id: "auto-1" });

    await expect(
      assertManualTakeControlAvailable("take-1"),
    ).rejects.toMatchObject({
      status: 409,
    });
    expect(mocks.findActiveRun).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ projectId: "project-1" }),
      }),
    );
  });
});
