import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Never hardcode this — the repo is public. Pass it at run time:
//   SEED_PASSWORD='…' RESET_CONFIRM=wipe-everything node scripts/reset.mjs
const TEMP_PASSWORD = process.env.SEED_PASSWORD ?? "";
if (TEMP_PASSWORD.length < 12) {
  console.error("Set SEED_PASSWORD (12+ characters) to the temporary password for these users.");
  process.exit(1);
}

// This script DELETES every lead, contact, note, task, event and user in the
// database DATABASE_URL points at — including production. Require intent.
if (process.env.RESET_CONFIRM !== "wipe-everything") {
  console.error("Refusing to run: this wipes ALL CRM data. Set RESET_CONFIRM=wipe-everything if you really mean it.");
  process.exit(1);
}

const USERS = [
  { name: "Gowrish H B",   email: "gowrish@gapso.in",    role: "ADMIN" },
  { name: "Rakshak Rao",   email: "rakshak@gapso.in",    role: "EMPLOYEE" },
  { name: "Vaishnavi S H", email: "vaishnavi@gapso.in",  role: "EMPLOYEE" },
  { name: "Armaan Khan",   email: "armaan@gapso.in",     role: "EMPLOYEE" },
  { name: "Abhishek",      email: "abhishek@gapso.in",   role: "EMPLOYEE" },
  { name: "Mrityunjay",    email: "mrityunjay@gapso.in", role: "EMPLOYEE" },
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

  console.log(`\nDone. All users share the SEED_PASSWORD temp password`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
