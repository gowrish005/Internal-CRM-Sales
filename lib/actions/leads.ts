"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createLeadSchema, updateLeadSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";

export async function getLeads({
  search,
  status,
  branchId,
  ownerId,
  track,
}: {
  search?: string;
  status?: string;
  branchId?: string;
  ownerId?: string;
  track?: number;
} = {}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const where: any = { isArchived: false };
  if (search) where.name = { contains: search, mode: "insensitive" };
  if (status) where.status = status;
  if (branchId) where.branchId = branchId;
  if (ownerId) where.ownerId = ownerId;
  if (track) where.track = track;

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

  const parsed = updateLeadSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.message);

  const d = parsed.data;

  // Build update payload — only include fields that were actually provided
  const updateData: Record<string, any> = { lastActivityAt: new Date() };
  if (d.name !== undefined) updateData.name = d.name;
  if (d.status !== undefined) updateData.status = d.status;
  if (d.priority !== undefined) updateData.priority = d.priority;
  if (d.track !== undefined) updateData.track = d.track === null ? null : Number(d.track);
  if (d.estimatedValue !== undefined) updateData.estimatedValue = d.estimatedValue === null ? null : Number(d.estimatedValue);
  if (d.nextFollowUpAt !== undefined) updateData.nextFollowUpAt = d.nextFollowUpAt ? new Date(d.nextFollowUpAt) : null;
  // ObjectId fields — only set if non-empty string (prevents passing "" to Prisma)
  if (d.contactId !== undefined) updateData.contactId = d.contactId || null;
  if (d.ownerId !== undefined) updateData.ownerId = d.ownerId || null;
  if (d.source !== undefined) updateData.source = d.source || null;

  try {
    const lead = await prisma.lead.update({
      where: { id },
      data: updateData,
      include: {
        branch: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        owner: { select: { id: true, name: true } },
      },
    });
    revalidatePath("/crm/leads");
    return lead;
  } catch (err: any) {
    console.error("[updateLead] Prisma error:", JSON.stringify(updateData, null, 2), "\n", err?.message);
    throw new Error(err?.message ?? "Failed to update lead");
  }
}

export async function archiveLead(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await prisma.lead.update({ where: { id }, data: { isArchived: true } });
  revalidatePath("/crm/leads");
}

export async function divideLeads(userIds: string[]) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!userIds.length) throw new Error("No users selected");

  const leads = await prisma.lead.findMany({
    where: { isArchived: false },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  const updates = leads.map((lead, i) => ({
    id: lead.id,
    ownerId: userIds[i % userIds.length],
  }));

  await Promise.all(
    updates.map(({ id, ownerId }) =>
      prisma.lead.update({ where: { id }, data: { ownerId } })
    )
  );

  revalidatePath("/crm/leads");
  return { assigned: leads.length, perUser: Math.ceil(leads.length / userIds.length) };
}

export async function importLeadsFromCSV(rows: { name: string; status?: string; priority?: string; track?: number; estimatedValue?: number; source?: string; ownerId?: string }[]) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!rows.length) throw new Error("No rows to import");

  const VALID_STATUS = ["NEW","CONTACTED","QUALIFIED","PROPOSAL","NEGOTIATION","WON","LOST"];
  const VALID_PRIORITY = ["LOW","MEDIUM","HIGH"];
  const VALID_SOURCE = ["REFERRAL","WEBSITE","COLD_OUTREACH","EVENT","SOCIAL_MEDIA","OTHER"];

  const created = await Promise.all(
    rows.map((row) =>
      prisma.lead.create({
        data: {
          name: row.name,
          status: (VALID_STATUS.includes(row.status?.toUpperCase() ?? "") ? row.status!.toUpperCase() : "NEW") as any,
          priority: (VALID_PRIORITY.includes(row.priority?.toUpperCase() ?? "") ? row.priority!.toUpperCase() : "MEDIUM") as any,
          track: row.track && row.track >= 1 && row.track <= 3 ? row.track : undefined,
          estimatedValue: row.estimatedValue ?? undefined,
          source: (VALID_SOURCE.includes(row.source?.toUpperCase() ?? "") ? row.source!.toUpperCase() : undefined) as any,
          ownerId: row.ownerId || undefined,
          lastActivityAt: new Date(),
        },
      })
    )
  );

  await prisma.activity.create({
    data: {
      type: "LEAD_CREATED",
      description: `Imported ${created.length} leads from CSV`,
      userId: (session.user as any).id,
    },
  });

  revalidatePath("/crm/leads");
  return { imported: created.length };
}
