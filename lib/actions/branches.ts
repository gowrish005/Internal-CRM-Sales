"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createBranchSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";

export async function getBranches({ search }: { search?: string } = {}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const where: any = { isArchived: false };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
      { location: { contains: search, mode: "insensitive" } },
    ];
  }

  return prisma.branch.findMany({
    where,
    include: {
      manager: { select: { id: true, name: true } },
      _count: { select: { contacts: true, leads: true, users: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function getBranch(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  return prisma.branch.findUnique({
    where: { id },
    include: {
      manager: { select: { id: true, name: true } },
      users: { select: { id: true, name: true, role: true } },
      contacts: {
        where: { isArchived: false },
        select: { id: true, firstName: true, lastName: true, designation: true, email: true, phone: true, leadStatus: true },
        take: 20,
      },
      leads: {
        where: { isArchived: false },
        select: { id: true, name: true, status: true, estimatedValue: true, priority: true },
        take: 20,
      },
      meetings: {
        where: { isCancelled: false },
        select: { id: true, title: true, startAt: true, endAt: true, type: true },
        orderBy: { startAt: "desc" },
        take: 10,
      },
      tasks: {
        where: { isArchived: false },
        select: { id: true, title: true, status: true, priority: true, dueAt: true },
        orderBy: { dueAt: "asc" },
        take: 10,
      },
      branchNotes: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });
}

export async function createBranch(data: unknown) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = createBranchSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.message);

  const branch = await prisma.branch.create({ data: parsed.data });

  await prisma.activity.create({
    data: {
      type: "BRANCH_CREATED",
      description: `Created branch ${branch.name}`,
      userId: (session.user as any).id,
      branchId: branch.id,
    },
  });

  revalidatePath("/crm/branches");
  return branch;
}

export async function updateBranch(id: string, data: unknown) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = createBranchSchema.partial().safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.message);

  const branch = await prisma.branch.update({ where: { id }, data: parsed.data });
  revalidatePath("/crm/branches");
  revalidatePath(`/crm/branches/${id}`);
  return branch;
}

export async function archiveBranch(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await prisma.branch.update({ where: { id }, data: { isArchived: true } });
  revalidatePath("/crm/branches");
}
