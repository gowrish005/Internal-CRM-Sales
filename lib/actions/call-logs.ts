"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { revalidatePath } from "next/cache";

export async function addCallLog({
  contactId,
  leadId,
  calledAt,
  durationMinutes,
  remarks,
}: {
  contactId?: string;
  leadId?: string;
  calledAt: string;
  durationMinutes?: number;
  remarks: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  if (!remarks.trim()) throw new Error("Remarks required");
  if (!contactId && !leadId) throw new Error("contactId or leadId required");

  await prisma.callLog.create({
    data: {
      contactId: contactId || null,
      leadId: leadId || null,
      loggedById: user.id,
      calledAt: new Date(calledAt),
      durationMinutes: durationMinutes ?? null,
      remarks: remarks.trim(),
    },
  });

  if (contactId) revalidatePath(`/crm/contacts/${contactId}`);
  if (leadId) revalidatePath(`/crm/leads/${leadId}`);
}

export async function deleteCallLog(id: string, contactId?: string, leadId?: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  await prisma.callLog.delete({ where: { id } });

  if (contactId) revalidatePath(`/crm/contacts/${contactId}`);
  if (leadId) revalidatePath(`/crm/leads/${leadId}`);
}
