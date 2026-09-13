"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createContactSchema, createNoteSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";

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
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

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
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

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
    },
  });
}

export async function createContact(data: unknown) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = createContactSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.message);

  const { nextFollowUpAt, ...rest } = parsed.data;

  const contact = await prisma.contact.create({
    data: {
      ...rest,
      email: rest.email || undefined,
      nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : undefined,
    },
  });

  await prisma.activity.create({
    data: {
      type: "CONTACT_CREATED",
      description: `Created contact ${contact.firstName} ${contact.lastName}`,
      userId: (session.user as any).id,
      contactId: contact.id,
    },
  });

  revalidatePath("/crm/contacts");
  return contact;
}

export async function updateContact(id: string, data: unknown) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = createContactSchema.partial().safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.message);

  const { nextFollowUpAt, ...rest } = parsed.data;

  const contact = await prisma.contact.update({
    where: { id },
    data: {
      ...rest,
      email: rest.email || undefined,
      nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : undefined,
    },
  });

  await prisma.activity.create({
    data: {
      type: "CONTACT_UPDATED",
      description: `Updated contact ${contact.firstName} ${contact.lastName}`,
      userId: (session.user as any).id,
      contactId: contact.id,
    },
  });

  revalidatePath("/crm/contacts");
  revalidatePath(`/crm/contacts/${id}`);
  return contact;
}

export async function addContactNote(data: unknown) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = createNoteSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.message);

  const note = await prisma.note.create({
    data: {
      ...parsed.data,
      authorId: (session.user as any).id,
    },
    include: { author: { select: { id: true, name: true } } },
  });

  if (parsed.data.contactId) {
    await prisma.activity.create({
      data: {
        type: "NOTE_ADDED",
        description: "Added a note",
        userId: (session.user as any).id,
        contactId: parsed.data.contactId,
      },
    });
    revalidatePath(`/crm/contacts/${parsed.data.contactId}`);
  }

  return note;
}

export async function archiveContact(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await prisma.contact.update({ where: { id }, data: { isArchived: true } });
  revalidatePath("/crm/contacts");
}
