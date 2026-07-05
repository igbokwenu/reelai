import { prisma } from "../apps/web/lib/prisma.ts";

async function main() {
  const project = await prisma.project.upsert({
    where: { id: "demo-reelai-project" },
    update: {},
    create: {
      id: "demo-reelai-project",
      name: "Demo Launch Reel",
      businessName: "Northstar Coffee",
      websiteUrl: "https://example.com",
      targetAudience: "Busy founders and creative teams",
      offer: "Small-batch cold brew subscription",
      videoLengthSec: 30,
      style: "REALISTIC",
      sources: {
        create: {
          type: "WEBSITE",
          url: "https://example.com",
          extractedText:
            "Demo seed website source for a specialty coffee subscription brand.",
          metadata: {
            label: "Seed website",
            storageMode: "metadata-only",
          },
        },
      },
    },
  });

  console.log(`Seeded demo project: ${project.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
