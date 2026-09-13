import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TEMP_PASSWORD = "hellcraft@123";

const USERS = [
  { name: "Gowrish H B",   email: "gowrish@hellcraft.in",    role: "ADMIN" },
  { name: "Rakshak Rao",   email: "rakshak@hellcraft.in",    role: "EMPLOYEE" },
  { name: "Vaishnavi S H", email: "vaishnavi@hellcraft.in",  role: "EMPLOYEE" },
  { name: "Armaan Khan",   email: "armaan@hellcraft.in",     role: "EMPLOYEE" },
  { name: "Abhishek",      email: "abhishek@hellcraft.in",   role: "EMPLOYEE" },
  { name: "Mrityunjay",    email: "mrityunjay@hellcraft.in", role: "EMPLOYEE" },
];

async function main() {
  console.log("Wiping demo data...");
  // Child/dependent records first
  await prisma.notification.deleteMany({});
  await prisma.activity.deleteMany({});
  await prisma.note.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.calendarEvent.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.contact.deleteMany({});
  // Auth records tied to users
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  // Users reference branch (required relation) — delete users first, then branches
  await prisma.user.deleteMany({});
  await prisma.branch.deleteMany({});

  console.log("Creating real users...");
  const hashed = await bcrypt.hash(TEMP_PASSWORD, 12);
  for (const u of USERS) {
    await prisma.user.create({
      data: { name: u.name, email: u.email, password: hashed, role: u.role, isActive: true },
    });
    console.log(`  + ${u.role.padEnd(8)} ${u.name} <${u.email}>`);
  }

  console.log(`\nDone. All users share temp password: ${TEMP_PASSWORD}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
