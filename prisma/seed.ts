import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Never hardcode this — the repo is public. Pass it at run time:
//   SEED_PASSWORD='…' pnpm db:seed
const TEMP_PASSWORD = process.env.SEED_PASSWORD ?? "";
if (TEMP_PASSWORD.length < 12) {
  console.error("Set SEED_PASSWORD (12+ characters) to the temporary password for these users.");
  process.exit(1);
}

const USERS = [
  { name: "Gowrish H B",   email: "gowrish@gapso.in",    role: "ADMIN" as const },
  { name: "Rakshak Rao",   email: "rakshak@gapso.in",    role: "EMPLOYEE" as const },
  { name: "Vaishnavi S H", email: "vaishnavi@gapso.in",  role: "EMPLOYEE" as const },
  { name: "Armaan Khan",   email: "armaan@gapso.in",     role: "EMPLOYEE" as const },
  { name: "Abhishek",      email: "abhishek@gapso.in",   role: "EMPLOYEE" as const },
  { name: "Mrityunjay",    email: "mrityunjay@gapso.in", role: "EMPLOYEE" as const },
];

async function main() {
  const hashed = await bcrypt.hash(TEMP_PASSWORD, 12);
  for (const u of USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role },
      create: { name: u.name, email: u.email, password: hashed, role: u.role, isActive: true },
    });
    console.log(`  ${u.role.padEnd(8)} ${u.name} <${u.email}>`);
  }
  console.log(`\nSeed done. New users got the SEED_PASSWORD temp password`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
