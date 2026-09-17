"use server";

import { prisma } from "@/lib/db";
import { requireUser, requireManager, isManager, leadScope, assertLeadAccess } from "@/lib/dal";
import { createLeadSchema, updateLeadSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import { isLeadStatus } from "@/lib/lead-status";
import { parseISTDateOnly } from "@/lib/date";

export async function getLeads({
  search,
  status,
  ownerId,
  track,
}: {
  search?: string;
  status?: string;
  ownerId?: string;
  track?: number;
} = {}) {
  const user = await requireUser();

  const where: any = { isArchived: false, ...leadScope(user) };
  if (search) where.name = { contains: search, mode: "insensitive" };
  if (status) where.status = status;
  if (ownerId && isManager(user)) where.ownerId = ownerId;
  if (track) where.track = track;

  return prisma.lead.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createLead(data: unknown) {
  const user = await requireUser();

  const parsed = createLeadSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.message);

  const { expectedCloseAt, nextFollowUpAt, estimatedValue, ...rest } = parsed.data;
  // Employees can only create leads for themselves.
  if (!isManager(user)) rest.ownerId = user.id;

  const lead = await prisma.lead.create({
    data: {
      ...rest,
      estimatedValue: estimatedValue ?? undefined,
      expectedCloseAt: expectedCloseAt ? parseISTDateOnly(expectedCloseAt) : undefined,
      nextFollowUpAt: nextFollowUpAt ? parseISTDateOnly(nextFollowUpAt) : undefined,
      lastActivityAt: new Date(),
    },
  });

  await prisma.activity.create({
    data: {
      type: "LEAD_CREATED",
      description: `Created lead: ${lead.name}`,
      userId: user.id,
      leadId: lead.id,
    },
  });

  revalidatePath("/crm/leads");
  return lead;
}

export async function updateLeadStatus(id: string, status: string) {
  const user = await requireUser();
  if (!isLeadStatus(status)) throw new Error("Invalid status");
  await assertLeadAccess(user, id);

  const lead = await prisma.lead.findUnique({ where: { id }, select: { name: true, status: true } });
  if (!lead) throw new Error("Lead not found");

  const updated = await prisma.lead.update({
    where: { id },
    data: { status, lastActivityAt: new Date() },
  });

  await prisma.activity.create({
    data: {
      type: "LEAD_STATUS_CHANGED",
      description: `Moved "${lead.name}" from ${lead.status} to ${status}`,
      userId: user.id,
      leadId: id,
    },
  });

  revalidatePath("/crm/leads");
  return updated;
}

export async function updateLead(id: string, data: unknown) {
  const user = await requireUser();
  await assertLeadAccess(user, id);

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
  if (d.nextFollowUpAt !== undefined) updateData.nextFollowUpAt = d.nextFollowUpAt ? parseISTDateOnly(d.nextFollowUpAt) : null;
  for (const k of ["phone", "email", "college", "branch", "usn"] as const) {
    if (d[k] !== undefined) updateData[k] = d[k]?.trim() || null;
  }
  if (d.passoutYear !== undefined) updateData.passoutYear = d.passoutYear ?? null;
  if (d.tags !== undefined) updateData.tags = d.tags;
  // ObjectId fields — only set if non-empty string (prevents passing "" to Prisma)
  // Reassigning a lead is a manager decision.
  if (d.ownerId !== undefined && isManager(user)) updateData.ownerId = d.ownerId || null;
  if (d.source !== undefined) updateData.source = d.source || null;

  try {
    const lead = await prisma.lead.update({
      where: { id },
      data: updateData,
      include: {
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
  await requireManager();

  await prisma.lead.update({ where: { id }, data: { isArchived: true } });
  revalidatePath("/crm/leads");
}

/**
 * Round-robin assigns `leadIds` across `userIds`. `leadIds` is expected to be
 * the set the UI showed the user (i.e. leads matching whatever filters were
 * active in the leads panel) — but we still re-check eligibility here rather
 * than trusting the client: only leads that are still unassigned and not
 * archived get touched, so a divide never overwrites someone's existing
 * assignment even if the client's view was stale.
 */
export async function divideLeads(leadIds: string[], userIds: string[]) {
  await requireManager();
  if (!userIds.length) throw new Error("No users selected");
  if (!leadIds.length) throw new Error("No leads to divide");

  const eligible = await prisma.lead.findMany({
    where: { id: { in: leadIds }, isArchived: false, ownerId: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  if (!eligible.length) {
    throw new Error("None of the matching leads are unassigned anymore — nothing to divide.");
  }

  // Group round-robin assignments by target owner so we issue one updateMany
  // per user instead of one update per lead (O(users) db round trips, not O(leads)).
  const buckets = new Map<string, string[]>();
  eligible.forEach((lead, i) => {
    const ownerId = userIds[i % userIds.length];
    const bucket = buckets.get(ownerId);
    if (bucket) bucket.push(lead.id);
    else buckets.set(ownerId, [lead.id]);
  });

  const now = new Date();
  await prisma.$transaction(
    [...buckets.entries()].map(([ownerId, ids]) =>
      prisma.lead.updateMany({ where: { id: { in: ids } }, data: { ownerId, lastActivityAt: now } })
    )
  );

  revalidatePath("/crm/leads");
  return {
    assigned: eligible.length,
    skipped: leadIds.length - eligible.length,
    perUser: Math.ceil(eligible.length / userIds.length),
  };
}

export async function importLeadsFromCSV(rows: { name: string; phone?: string; email?: string; college?: string; branch?: string; usn?: string; passoutYear?: number; status?: string; priority?: string; track?: number; estimatedValue?: number; source?: string; ownerId?: string }[]) {
  const user = await requireManager();
  if (!rows.length) throw new Error("No rows to import");

  // CSV "NO REPLY" / "no-reply" -> NO_REPLY
  const toStatus = (s?: string) => {
    const v = s?.trim().toUpperCase().replace(/[\s-]+/g, "_");
    return isLeadStatus(v) ? v : "NEW";
  };
  const VALID_PRIORITY = ["LOW","MEDIUM","HIGH"];
  const VALID_SOURCE = ["REFERRAL","WEBSITE","COLD_OUTREACH","EVENT","SOCIAL_MEDIA","OTHER"];

  const now = new Date();
  // Bulk insert in one round trip instead of N individual creates.
  const { count } = await prisma.lead.createMany({
    data: rows.map((row) => ({
      name: row.name,
      phone: row.phone || undefined,
      email: row.email || undefined,
      college: row.college || undefined,
      branch: row.branch || undefined,
      usn: row.usn || undefined,
      passoutYear: row.passoutYear || undefined,
      status: toStatus(row.status),
      priority: (VALID_PRIORITY.includes(row.priority?.toUpperCase() ?? "") ? row.priority!.toUpperCase() : "MEDIUM") as any,
      track: row.track && row.track >= 1 && row.track <= 3 ? row.track : undefined,
      estimatedValue: row.estimatedValue ?? undefined,
      source: (VALID_SOURCE.includes(row.source?.toUpperCase() ?? "") ? row.source!.toUpperCase() : undefined) as any,
      ownerId: row.ownerId || undefined,
      lastActivityAt: now,
    })),
  });

  await prisma.activity.create({
    data: {
      type: "LEAD_CREATED",
      description: `Imported ${count} leads from CSV`,
      userId: user.id,
    },
  });

  revalidatePath("/crm/leads");
  return { imported: count };
}
