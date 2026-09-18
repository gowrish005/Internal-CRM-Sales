"use server";

import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/dal";
import { createContactSchema, createNoteSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import { parseISTDateOnly } from "@/lib/date";

export async function getContacts({
  search,
  status,
  ownerId,
  page = 1,
  limit = 50,
}: {
  search?: string;
  status?: string;
  ownerId?: string;
  page?: number;
  limit?: number;
} = {}) {
  const user = await requireManager();

  const where: any = { isArchived: false };
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { designation: { contains: search, mode: "insensitive" } },
    ];
  }
  if (status) where.leadStatus = status;
  if (ownerId) where.ownerId = ownerId;

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.contact.count({ where }),
  ]);

  return { contacts, total, page, limit };
}

export async function getContact(id: string) {
  const user = await requireManager();

  return prisma.contact.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true } },
      leads: {
        select: { id: true, name: true, status: true, estimatedValue: true },
        where: { isArchived: false },
      },
      tasks: {
        where: { isArchived: false },
        orderBy: { dueAt: "asc" },
      },
      notes: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
      activities: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      meetings: {
        where: { isCancelled: false },
        orderBy: { startAt: "desc" },
        take: 10,
        include: { organizer: { select: { id: true, name: true } } },
      },
      callLogs: {
        include: { loggedBy: { select: { id: true, name: true } } },
        orderBy: { calledAt: "desc" },
      },
    },
  });
}

export async function createContact(data: unknown) {
  const user = await requireManager();

  const parsed = createContactSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.message);

  const { nextFollowUpAt, ...rest } = parsed.data;

  const contact = await prisma.contact.create({
    data: {
      ...rest,
      email: rest.email || undefined,
      nextFollowUpAt: nextFollowUpAt ? parseISTDateOnly(nextFollowUpAt) : undefined,
    },
  });

  await prisma.activity.create({
    data: {
      type: "CONTACT_CREATED",
      description: `Created contact ${contact.firstName} ${contact.lastName}`,
      userId: user.id,
      contactId: contact.id,
    },
  });

  revalidatePath("/crm/contacts");
  return contact;
}

export async function updateContact(id: string, data: unknown) {
  const user = await requireManager();

  const parsed = createContactSchema.partial().safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.message);

  const { nextFollowUpAt, ...rest } = parsed.data;

  const contact = await prisma.contact.update({
    where: { id },
    data: {
      ...rest,
      email: rest.email || undefined,
      nextFollowUpAt: nextFollowUpAt ? parseISTDateOnly(nextFollowUpAt) : undefined,
    },
  });

  await prisma.activity.create({
    data: {
      type: "CONTACT_UPDATED",
      description: `Updated contact ${contact.firstName} ${contact.lastName}`,
      userId: user.id,
      contactId: contact.id,
    },
  });

  revalidatePath("/crm/contacts");
  revalidatePath(`/crm/contacts/${id}`);
  return contact;
}

export async function addContactNote(data: unknown) {
  const user = await requireManager();

  const parsed = createNoteSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.message);

  const note = await prisma.note.create({
    data: {
      ...parsed.data,
      authorId: user.id,
    },
    include: { author: { select: { id: true, name: true } } },
  });

  if (parsed.data.contactId) {
    await prisma.activity.create({
      data: {
        type: "NOTE_ADDED",
        description: "Added a note",
        userId: user.id,
        contactId: parsed.data.contactId,
      },
    });
    revalidatePath(`/crm/contacts/${parsed.data.contactId}`);
  }

  return note;
}

export async function archiveContact(id: string) {
  const user = await requireManager();

  await prisma.contact.update({ where: { id }, data: { isArchived: true } });
  revalidatePath("/crm/contacts");
}
