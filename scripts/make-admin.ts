import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error("Usage: npx tsx scripts/make-admin.ts <email>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  await prisma.user.update({
    where: { email },
    data: { role: "ADMIN", tier: "PRO" },
  });

  console.log(`User ${email} is now ADMIN with PRO tier.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
