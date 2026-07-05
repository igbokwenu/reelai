import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

loadMissingRootEnv();

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://placeholder:placeholder@localhost:5432/reelai",
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

function loadMissingRootEnv() {
  const envPaths = [
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), "..", "..", ".env"),
  ];

  for (const envPath of envPaths) {
    if (!existsSync(envPath)) {
      continue;
    }

    const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const equalsAt = trimmed.indexOf("=");

      if (equalsAt === -1) {
        continue;
      }

      const name = trimmed.slice(0, equalsAt).trim();

      if (process.env[name]) {
        continue;
      }

      process.env[name] = trimmed
        .slice(equalsAt + 1)
        .trim()
        .replace(/^['"]|['"]$/g, "");
    }
  }
}
