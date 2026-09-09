"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createLeadSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";

export async function getLeads({
  search,
  status,
  branchId,
  ownerId,
}: {
  search?: string;
  status?: string;
  branchId?: string;
  ownerId?: string;
} = {}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const where: any = { isArchived: false };
  if (search) where.name = { contains: search, mode: "insensitive" };
  if (status) where.status = status;
  if (branchId) where.branchId = branchId;
  if (ownerId) where.ownerId = ownerId;

  return prisma.lead.findMany({
    where,
    include: {
      branch: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      owner: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createLead(data: unknown) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = createLeadSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.message);

  const { expectedCloseAt, nextFollowUpAt, estimatedValue, ...rest } = parsed.data;

  const lead = await prisma.lead.create({
    data: {
      ...rest,
      estimatedValue: estimatedValue ?? undefined,
      expectedCloseAt: expectedCloseAt ? new Date(expectedCloseAt) : undefined,
      nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : undefined,
      lastActivityAt: new Date(),
    },
  });

  await prisma.activity.create({
    data: {
      type: "LEAD_CREATED",
      description: `Created lead: ${lead.name}`,
      userId: (session.user as any).id,
      leadId: lead.id,
    },
  });

  revalidatePath("/crm/leads");
  return lead;
}

export async function updateLeadStatus(id: string, status: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const lead = await prisma.lead.findUnique({ where: { id }, select: { name: true, status: true } });
  if (!lead) throw new Error("Lead not found");

  const updated = await prisma.lead.update({
    where: { id },
    data: { status: status as any, lastActivityAt: new Date() },
  });

  await prisma.activity.create({
    data: {
      type: "LEAD_STATUS_CHANGED",
      description: `Moved "${lead.name}" from ${lead.status} to ${status}`,
      userId: (session.user as any).id,
      leadId: id,
    },
  });

  revalidatePath("/crm/leads");
  return updated;
}

export async function updateLead(id: string, data: unknown) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = createLeadSchema.partial().safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.message);

  const { expectedCloseAt, nextFollowUpAt, estimatedValue, ...rest } = parsed.data;

  const lead = await prisma.lead.update({
    where: { id },
    data: {
      ...rest,
      estimatedValue: estimatedValue ?? undefined,
      expectedCloseAt: expectedCloseAt ? new Date(expectedCloseAt) : undefined,
      nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : undefined,
      lastActivityAt: new Date(),
    },
  });

  revalidatePath("/crm/leads");
  return lead;
}

export async function archiveLead(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await prisma.lead.update({ where: { id }, data: { isArchived: true } });
  revalidatePath("/crm/leads");
}
