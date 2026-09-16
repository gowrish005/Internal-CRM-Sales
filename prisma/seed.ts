import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TEMP_PASSWORD = "gapso@123";

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
  console.log(`\nSeed done. Temp password for new users: ${TEMP_PASSWORD}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
