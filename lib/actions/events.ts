"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createEventSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";

export async function getEvents({
  from,
  to,
  userId,
  branchId,
}: {
  from?: Date;
  to?: Date;
  userId?: string;
  branchId?: string;
} = {}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const where: any = { isCancelled: false };
  if (from || to) {
    where.startAt = {};
    if (from) where.startAt.gte = from;
    if (to) where.startAt.lte = to;
  }
  if (userId) {
    where.OR = [{ organizerId: userId }, { participantIds: { has: userId } }];
  }
  if (branchId) where.branchId = branchId;

  return prisma.calendarEvent.findMany({
    where,
    include: {
      organizer: { select: { id: true, name: true } },
      participants: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      lead: { select: { id: true, name: true } },
    },
    orderBy: { startAt: "asc" },
  });
}

export async function createEvent(data: unknown) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = createEventSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.message);

  const { startAt, endAt, reminderAt, participantIds, ...rest } = parsed.data;

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
      userId: (session.user as any).id,
      meetingId: event.id,
      contactId: event.contactId ?? undefined,
      branchId: event.branchId ?? undefined,
    },
  });

  revalidatePath("/calendar");
  return event;
}

export async function updateEvent(id: string, data: unknown) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = createEventSchema.partial().safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.message);

  const { startAt, endAt, reminderAt, participantIds, ...rest } = parsed.data;

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
      userId: (session.user as any).id,
      meetingId: event.id,
    },
  });

  revalidatePath("/calendar");
  return event;
}

export async function cancelEvent(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await prisma.calendarEvent.update({ where: { id }, data: { isCancelled: true } });
  revalidatePath("/calendar");
}
