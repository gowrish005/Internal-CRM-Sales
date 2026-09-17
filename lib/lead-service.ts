import "server-only";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { updateLeadSchema } from "@/lib/validations";
import { type CurrentUser, isManager, leadScope } from "@/lib/dal";
import { parseISTDateOnly } from "@/lib/date";

export class LeadUpdateError extends Error {
  constructor(message: string, readonly status: 400 | 404) { super(message); }
}

/**
 * Apply an edit to one lead on behalf of `user`. Shared by the updateLead /
 * updateLeadStatus Server Actions and PATCH /api/leads/[id] (which the lead
 * page uses so saves aren't tied to client-side navigation).
 *
 * Only fields present in `data` change. A status change is also written to
 * the activity feed, whichever way it was made.
 */
export async function applyLeadUpdate(user: CurrentUser, id: string, data: unknown) {
  const parsed = updateLeadSchema.safeParse(data);
  if (!parsed.success) throw new LeadUpdateError(parsed.error.message, 400);
  const d = parsed.data;

  const current = /^[0-9a-f]{24}$/i.test(id)
    ? await prisma.lead.findFirst({ where: { id, ...leadScope(user) }, select: { name: true, status: true } })
    : null;
  if (!current) throw new LeadUpdateError("Lead not found", 404);
  if (d.name !== undefined && !d.name.trim()) throw new LeadUpdateError("Lead name can't be empty", 400);

  const updateData: Record<string, any> = { lastActivityAt: new Date() };
  if (d.name !== undefined) updateData.name = d.name.trim();
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
  // Reassigning a lead is a manager decision; ObjectId fields must be null, not "".
  if (d.ownerId !== undefined && isManager(user)) updateData.ownerId = d.ownerId || null;
  if (d.source !== undefined) updateData.source = d.source || null;

  const lead = await prisma.lead.update({
    where: { id },
    data: updateData,
    include: { owner: { select: { id: true, name: true } } },
  });

  if (d.status !== undefined && d.status !== current.status) {
    await prisma.activity.create({
      data: {
        type: "LEAD_STATUS_CHANGED",
        description: `Moved "${lead.name}" from ${current.status} to ${d.status}`,
        userId: user.id,
        leadId: id,
      },
    });
  }

  revalidatePath("/crm/leads");
  revalidatePath(`/crm/leads/${id}`);
  return lead;
}
