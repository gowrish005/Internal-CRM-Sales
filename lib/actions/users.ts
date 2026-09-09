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
  branchId: z.string().optional(),
});

export async function getUsers() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  return prisma.user.findMany({
    include: { branch: { select: { id: true, name: true } } },
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
