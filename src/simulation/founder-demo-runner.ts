/**
 * ============================================================================
 * FOUNDER DEMO RUNNER CLI
 * ============================================================================
 * Run via terminal:
 *   npx tsx src/simulation/founder-demo-runner.ts
 * ============================================================================
 */

import { runFounderDemo } from "./founder-demo";

export function executeFounderDemoCli() {
  const demo = runFounderDemo();

  console.log("\n" + "=".repeat(80));
  console.log(`🎤  ${demo.overview.title.toUpperCase()}`);
  console.log(`    ${demo.overview.subtitle}`);
  console.log(`    Narrator: ${demo.overview.narratorRole}`);
  console.log(`    Audience: ${demo.overview.targetAudience}`);
  console.log("=".repeat(80) + "\n");

  for (const scene of demo.scenes) {
    console.log(`\n>>> [SCENE ${scene.sceneNumber}/7]: ${scene.title.toUpperCase()}`);
    console.log(`Headline: ${scene.headline}`);
    console.log("-".repeat(80));
    console.log(`🗣️  FOUNDER SPOKEN NARRATION:\n"${scene.founderNarration}"\n`);
    console.log("📊 LIVE SYSTEM DATA:");
    console.log(JSON.stringify(scene.liveData, null, 2));
    console.log(`\n💡 KEY TAKEAWAY: ${scene.keyTakeaway}`);
    console.log("=".repeat(80));
  }

  console.log("\n📈 FOUNDER DEMO SUMMARY KPIS:");
  console.table(demo.summaryKpis);
  console.log("\n✨ Demo successfully concluded.\n");
}

if (require.main === module) {
  executeFounderDemoCli();
}
