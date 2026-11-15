import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "./seed-data";

const prisma = new PrismaClient();

async function main() {
  const result = await seedDatabase(prisma);
  console.log(`Seeded CareLoop demo tenant '${result.tenant.slug}' (${result.tenant.id}) successfully.`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
