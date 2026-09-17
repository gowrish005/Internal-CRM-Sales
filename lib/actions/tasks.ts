"use server";

import { prisma } from "@/lib/db";
import { createTaskSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import { notifyTaskCreated } from "@/lib/notify";
import {
  type CurrentUser, requireUser, isManager, taskScope, leadScope, eventScope, assertTaskAccess,
} from "@/lib/dal";

/**
 * Employees work only on their own tasks: force the owner to themselves, and
 * refuse links to B2B contacts or to leads/events that aren't theirs.
 */
async function scopeTaskInput<T extends { ownerId?: string; contactId?: string; leadId?: string; meetingId?: string }>(user: CurrentUser, input: T): Promise<T> {
  if (isManager(user)) return input;
  const scoped = { ...input };
  if ("ownerId" in scoped) scoped.ownerId = user.id;
  if (scoped.contactId) throw new Error("Contact not found");
  if (scoped.leadId && !(await prisma.lead.findFirst({ where: { id: scoped.leadId, ...leadScope(user) }, select: { id: true } }))) {
    throw new Error("Lead not found");
  }
  if (scoped.meetingId && !(await prisma.calendarEvent.findFirst({ where: { id: scoped.meetingId, ...eventScope(user) }, select: { id: true } }))) {
    throw new Error("Event not found");
  }
  return scoped;
}

export async function getTasks({
  status,
  ownerId,
  priority,
  view,
}: {
  status?: string;
  ownerId?: string;
  priority?: string;
  view?: "today" | "overdue" | "upcoming" | "completed" | "mine";
} = {}) {
  const user = await requireUser();

  const where: any = { isArchived: false, ...taskScope(user) };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);

  if (view === "today") { where.dueAt = { gte: today, lt: tomorrow }; where.status = { not: "COMPLETED" }; }
  else if (view === "overdue") { where.dueAt = { lt: today }; where.status = { not: "COMPLETED" }; }
  else if (view === "upcoming") { where.dueAt = { gte: tomorrow }; where.status = { not: "COMPLETED" }; }
  else if (view === "completed") { where.status = "COMPLETED"; }
  else if (view === "mine") { where.ownerId = user.id; where.status = { not: "COMPLETED" }; }

  if (status) where.status = status;
  if (ownerId && isManager(user)) where.ownerId = ownerId;
  if (priority) where.priority = priority;

  return prisma.task.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      lead: { select: { id: true, name: true } },
    },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }, { priority: "desc" }],
  });
}

export async function createTask(data: unknown) {
  const user = await requireUser();

  const parsed = createTaskSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.message);

  const { dueAt, ...input } = parsed.data;
  const rest = await scopeTaskInput(user, { ...input, ownerId: input.ownerId });

  const task = await prisma.task.create({
    data: {
      ...rest,
      dueAt: dueAt ? new Date(dueAt) : undefined,
    },
  });

  await prisma.activity.create({
    data: {
      type: "TASK_CREATED",
      description: `Created task: ${task.title}`,
      userId: user.id,
      taskId: task.id,
      contactId: task.contactId ?? undefined,
      leadId: task.leadId ?? undefined,
    },
  });

  // Fire-and-forget — don't block task creation on notification delivery
  notifyTaskCreated({
    taskId: task.id,
    taskTitle: task.title,
    creatorId: user.id,
    creatorRole: user.role,
    creatorName: user.name,
    assigneeId: task.ownerId ?? null,
  });

  revalidatePath("/tasks");
  return task;
}

export async function updateTask(id: string, data: unknown) {
  const user = await requireUser();
  await assertTaskAccess(user, id);

  const parsed = createTaskSchema.partial().safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.message);

  const { dueAt, ...input } = parsed.data;
  const rest = await scopeTaskInput(user, input);
  const prev = await prisma.task.findUnique({ where: { id }, select: { status: true, title: true } });

  const task = await prisma.task.update({
    where: { id },
    data: { ...rest, dueAt: dueAt ? new Date(dueAt) : undefined },
  });

  if (prev?.status !== "COMPLETED" && task.status === "COMPLETED") {
    await prisma.activity.create({
      data: {
        type: "TASK_COMPLETED",
        description: `Completed task: ${task.title}`,
        userId: user.id,
        taskId: task.id,
      },
    });
  }

  revalidatePath("/tasks");
  return task;
}

export async function archiveTask(id: string) {
  const user = await requireUser();
  await assertTaskAccess(user, id);

  await prisma.task.update({ where: { id }, data: { isArchived: true } });
  revalidatePath("/tasks");
}
