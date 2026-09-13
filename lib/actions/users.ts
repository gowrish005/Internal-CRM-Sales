"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "FOUNDER", "EMPLOYEE"]).default("EMPLOYEE"),
});

export async function getUsers() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  return prisma.user.findMany({
    orderBy: { name: "asc" },
  });
}

export async function createUser(data: unknown) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") throw new Error("Unauthorized");

  const parsed = createUserSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.message);

  const hashed = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: { ...parsed.data, password: hashed },
  });

  revalidatePath("/settings");
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function updateUserRole(id: string, role: string) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") throw new Error("Unauthorized");

  await prisma.user.update({ where: { id }, data: { role: role as any } });
  revalidatePath("/settings");
}

export async function toggleUserActive(id: string) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({ where: { id }, select: { isActive: true } });
  await prisma.user.update({ where: { id }, data: { isActive: !user?.isActive } });
  revalidatePath("/settings");
}

export async function deleteUser(id: string) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") throw new Error("Unauthorized");
  if ((session.user as any).id === id) throw new Error("You cannot delete your own account");

  // Detach owned records so FK relations don't break, then remove the user
  // Detach optional relations, delete required-author records, then remove the user.
  // Account/Session/Notification cascade automatically.
  await prisma.$transaction([
    prisma.lead.updateMany({ where: { ownerId: id }, data: { ownerId: null } }),
    prisma.contact.updateMany({ where: { ownerId: id }, data: { ownerId: null } }),
    prisma.task.updateMany({ where: { ownerId: id }, data: { ownerId: null } }),
    prisma.calendarEvent.updateMany({ where: { organizerId: id }, data: { organizerId: null } }),
    prisma.activity.updateMany({ where: { userId: id }, data: { userId: null } }),
    prisma.note.deleteMany({ where: { authorId: id } }),
    prisma.user.delete({ where: { id } }),
  ]);

  revalidatePath("/settings");
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const userId = (session.user as any).id as string;

  if (!newPassword || newPassword.length < 6) throw new Error("New password must be at least 6 characters");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
  if (!user) throw new Error("User not found");

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) throw new Error("Current password is incorrect");

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
}
