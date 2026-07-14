import { prisma } from "../apps/web/lib/prisma.ts";

async function main() {
  const project = await prisma.project.upsert({
    where: { id: "demo-reelai-project" },
    update: {
      name: "Demo Launch Reel",
      businessName: "Northstar Coffee",
      websiteUrl: "https://example.com",
      targetAudience: "Busy founders and creative teams",
      offer: "Small-batch cold brew subscription",
      videoLengthSec: 30,
      style: "REALISTIC",
      status: "STORYBOARDING",
    },
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

  await prisma.brandKit.upsert({
    where: { projectId: project.id },
    update: {},
    create: {
      projectId: project.id,
      summary:
        "Northstar Coffee sells small-batch cold brew subscriptions to busy creative teams that want better office coffee without extra prep.",
      valueProps: [
        "Ready-to-drink cold brew for high-output teams",
        "Small-batch roast profile with a clean finish",
        "Flexible weekly subscription for offices and studios",
      ],
      audience: "Founders, studio operators, and small team office managers",
      tone: "Crisp, warm, energetic, and practical",
      palette: [
        { hex: "#111111", label: "Roasted black" },
        { hex: "#D8A657", label: "Cold brew amber" },
        { hex: "#F4F1E8", label: "Oat foam" },
      ],
      visualMotifs: [
        "condensation on glass bottles",
        "morning desk rituals",
        "team planning tables",
      ],
      claims: [
        {
          claim: "Small-batch cold brew subscription",
          evidence: "Demo seed source",
          source: "https://example.com",
          risk: "low",
        },
      ],
      policyRisks: [
        {
          category: "Food and beverage",
          reason: "Avoid unsupported health or productivity claims.",
          severity: "info",
        },
      ],
      sourceCitations: [{ label: "Demo website", url: "https://example.com" }],
      lockedStyle:
        "Realistic vertical lifestyle footage, warm morning light, sharp product closeups, black/amber/oat palette, practical founder energy.",
    },
  });

  await prisma.creativeConcept.deleteMany({
    where: { projectId: project.id },
  });

  await prisma.creativeConcept.createMany({
    data: [
      {
        id: "demo-concept-desk-ritual",
        projectId: project.id,
        title: "The Desk Ritual",
        hook: "Your morning standup deserves better coffee.",
        strategy:
          "Show a hectic team morning becoming calmer and sharper through a simple cold brew ritual.",
        narrativeArc:
          "Messy desk energy, product reveal, team reset, subscription payoff.",
        visualStyle:
          "Realistic closeups, warm desk light, crisp product shots, quick editorial cuts.",
        estimatedScenes: 3,
        estimatedDuration: 24,
        previewPrompt:
          "Vertical realistic ad frame: condensation on a cold brew bottle beside a laptop, warm office light, amber highlights.",
        rationale:
          "Makes the offer tangible and ties the brand to a repeatable workday habit.",
        selected: true,
      },
      {
        id: "demo-concept-fridge-restock",
        projectId: project.id,
        title: "The Friday Fridge Restock",
        hook: "Stop making coffee runs part of the sprint.",
        strategy:
          "Position the subscription as an operations fix for small teams.",
        narrativeArc:
          "Empty fridge, delivery moment, stocked shelf, team grabs bottles before a launch push.",
        visualStyle:
          "Clean office utility shots with satisfying restock motion.",
        estimatedScenes: 3,
        estimatedDuration: 21,
        previewPrompt:
          "Vertical product ad frame: office fridge stocked with amber cold brew bottles, clean label-forward composition.",
        rationale:
          "Speaks to the buyer who owns office logistics and team experience.",
        selected: false,
      },
      {
        id: "demo-concept-founder-note",
        projectId: project.id,
        title: "Founder's First Pour",
        hook: "Built for the teams building before breakfast.",
        strategy:
          "Use a founder-story angle to make the product feel crafted and personal.",
        narrativeArc:
          "Roast origin, first pour, founder packing bottles, team enjoying the product.",
        visualStyle:
          "Documentary-style handheld shots with intimate product details.",
        estimatedScenes: 4,
        estimatedDuration: 30,
        previewPrompt:
          "Vertical documentary frame: founder pouring cold brew into a glass, soft morning light, product label visible.",
        rationale:
          "Adds emotion and craft while preserving a business-use call to action.",
        selected: false,
      },
    ],
  });

  await prisma.storyboard.deleteMany({ where: { projectId: project.id } });

  await prisma.storyboard.create({
    data: {
      id: "demo-storyboard-northstar",
      projectId: project.id,
      conceptId: "demo-concept-desk-ritual",
      title: "Northstar Desk Ritual",
      script:
        "A fast, warm vertical reel that turns an ordinary team morning into a repeatable cold brew ritual.",
      productContinuity:
        "Use the same clear glass cold-brew bottle, black label geometry, amber liquid level, and condensation treatment in every product appearance.",
      characterContinuity:
        "Keep the same three-person creative team, their neutral workwear, hair, and accessories consistent across the office scenes.",
      visualContinuity:
        "Warm morning light from camera left, black/amber/oat palette, realistic 35mm lifestyle photography, and shallow depth of field throughout.",
      bgmEnabled: true,
      bgmPrompt: "light percussive indie beat, optimistic but not cheesy",
      status: "DRAFT",
      scenes: {
        create: [
          {
            id: "demo-scene-1",
            index: 1,
            durationSec: 7,
            captionText: "Better mornings start before the meeting.",
            voiceoverText:
              "Before the first standup, Northstar cold brew is already ready.",
            shotPrompt:
              "Eager anticipation: one hand places the chilled bottle beside the laptop as the camera slowly pushes in.",
            continuityNotes:
              "Keep amber highlights and black label styling consistent.",
            continuityMode: "CONTINUOUS",
            lockedStyleLanguage:
              "Realistic vertical lifestyle footage, warm morning light, sharp product closeups.",
            status: "APPROVED",
          },
          {
            id: "demo-scene-2",
            index: 2,
            durationSec: 8,
            captionText: "Small-batch cold brew, no coffee run.",
            voiceoverText:
              "Small-batch flavor shows up on your schedule, without another coffee run.",
            shotPrompt:
              "Refreshing relief: one teammate pours the cold brew over ice as the camera gently orbits the glass.",
            continuityNotes:
              "Use the same bottle shape and amber/oat palette from scene one.",
            continuityMode: "MATCH_CUT",
            lockedStyleLanguage:
              "Realistic vertical lifestyle footage, warm morning light, sharp product closeups.",
            status: "APPROVED",
          },
          {
            id: "demo-scene-3",
            index: 3,
            durationSec: 7,
            captionText: "Subscribe once. Keep the team stocked.",
            voiceoverText:
              "Subscribe once, keep the fridge stocked, and get back to the work.",
            shotPrompt:
              "Warm confidence: one teammate raises the bottle toward camera while a handheld follow keeps the product centered.",
            continuityNotes:
              "End with readable label space and safe caption zone.",
            continuityMode: "CONTINUOUS",
            lockedStyleLanguage:
              "Realistic vertical lifestyle footage, warm morning light, sharp product closeups.",
            status: "APPROVED",
          },
        ],
      },
    },
  });

  await prisma.generationJob.deleteMany({ where: { projectId: project.id } });
  await prisma.generationJob.createMany({
    data: [
      {
        projectId: project.id,
        type: "BRAND_KIT",
        status: "COMPLETE",
        model: "qwen3.6-plus",
        input: { seed: true },
        output: { fixture: "public-demo-brand-kit" },
        completedAt: new Date(),
      },
      {
        projectId: project.id,
        type: "CONCEPTS",
        status: "COMPLETE",
        model: "qwen3.6-plus + wan2.7-image-pro",
        input: { seed: true },
        output: { fixture: "public-demo-concepts" },
        completedAt: new Date(),
      },
      {
        projectId: project.id,
        type: "STORYBOARD",
        status: "COMPLETE",
        model: "qwen3.6-plus",
        input: { seed: true },
        output: { fixture: "public-demo-storyboard" },
        completedAt: new Date(),
      },
    ],
  });

  const secondProject = await prisma.project.upsert({
    where: { id: "demo-second-brand-project" },
    update: {
      name: "Reusable Second Brand",
      businessName: "Orbit Yoga",
      websiteUrl: "https://example.org",
      targetAudience: "Beginners returning to movement",
      offer: "Seven-day intro pass",
      videoLengthSec: 15,
      style: "REALISTIC",
    },
    create: {
      id: "demo-second-brand-project",
      name: "Reusable Second Brand",
      businessName: "Orbit Yoga",
      websiteUrl: "https://example.org",
      targetAudience: "Beginners returning to movement",
      offer: "Seven-day intro pass",
      videoLengthSec: 15,
      style: "REALISTIC",
      sources: {
        create: {
          type: "WEBSITE",
          url: "https://example.org",
          extractedText:
            "Second demo seed source that proves Reel AI can start a different brand without code changes.",
          metadata: {
            label: "Second brand seed website",
            storageMode: "metadata-only",
          },
        },
      },
    },
  });

  console.log(
    `Seeded public demo projects: ${project.id}, ${secondProject.id}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
