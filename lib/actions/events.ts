"use server";

import { prisma } from "@/lib/db";
import { requireUser, isManager, eventScope, leadScope, assertEventOwnership } from "@/lib/dal";
import { createEventSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";

export async function getEvents({
  from,
  to,
  userId,
}: {
  from?: Date;
  to?: Date;
  userId?: string;
} = {}) {
  const user = await requireUser();

  const where: any = { isCancelled: false, ...eventScope(user) };
  if (from || to) {
    where.startAt = {};
    if (from) where.startAt.gte = from;
    if (to) where.startAt.lte = to;
  }
  if (userId && isManager(user)) {
    where.OR = [{ organizerId: userId }, { participantIds: { has: userId } }];
  }

  return prisma.calendarEvent.findMany({
    where,
    include: {
      organizer: { select: { id: true, name: true } },
      participants: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      lead: { select: { id: true, name: true } },
    },
    orderBy: { startAt: "asc" },
  });
}

export async function createEvent(data: unknown) {
  const user = await requireUser();

  const parsed = createEventSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.message);

  const { startAt, endAt, reminderAt, participantIds, ...rest } = parsed.data;
  if (!isManager(user)) {
    // Employees schedule on their own calendar, against their own leads only.
    rest.organizerId = user.id;
    if (rest.contactId) throw new Error("Contact not found");
    if (rest.leadId && !(await prisma.lead.findFirst({ where: { id: rest.leadId, ...leadScope(user) }, select: { id: true } }))) {
      throw new Error("Lead not found");
    }
  }

  const event = await prisma.calendarEvent.create({
    data: {
      ...rest,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      reminderAt: reminderAt ? new Date(reminderAt) : undefined,
      participants: { connect: participantIds.map((id) => ({ id })) },
    },
    include: {
      organizer: { select: { id: true, name: true } },
      participants: { select: { id: true, name: true } },
    },
  });

  await prisma.activity.create({
    data: {
      type: "MEETING_CREATED",
      description: `Scheduled: ${event.title}`,
      userId: user.id,
      meetingId: event.id,
      contactId: event.contactId ?? undefined,
    },
  });

  revalidatePath("/calendar");
  return event;
}

export async function updateEvent(id: string, data: unknown) {
  const user = await requireUser();
  await assertEventOwnership(user, id);

  const parsed = createEventSchema.partial().safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.message);

  const { startAt, endAt, reminderAt, participantIds, ...rest } = parsed.data;
  if (!isManager(user)) {
    delete rest.organizerId;
    if (rest.contactId) throw new Error("Contact not found");
    if (rest.leadId && !(await prisma.lead.findFirst({ where: { id: rest.leadId, ...leadScope(user) }, select: { id: true } }))) {
      throw new Error("Lead not found");
    }
  }

  const event = await prisma.calendarEvent.update({
    where: { id },
    data: {
      ...rest,
      startAt: startAt ? new Date(startAt) : undefined,
      endAt: endAt ? new Date(endAt) : undefined,
      reminderAt: reminderAt ? new Date(reminderAt) : undefined,
      participants: participantIds ? { set: participantIds.map((pid) => ({ id: pid })) } : undefined,
    },
  });

  await prisma.activity.create({
    data: {
      type: "MEETING_RESCHEDULED",
      description: `Updated: ${event.title}`,
      userId: user.id,
      meetingId: event.id,
    },
  });

  revalidatePath("/calendar");
  return event;
}

export async function cancelEvent(id: string) {
  const user = await requireUser();
  await assertEventOwnership(user, id);

  await prisma.calendarEvent.update({ where: { id }, data: { isCancelled: true } });
  revalidatePath("/calendar");
}
