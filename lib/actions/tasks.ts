"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createTaskSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import { notifyTaskCreated } from "@/lib/actions/notifications";

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
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const where: any = { isArchived: false };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);

  if (view === "today") { where.dueAt = { gte: today, lt: tomorrow }; where.status = { not: "COMPLETED" }; }
  else if (view === "overdue") { where.dueAt = { lt: today }; where.status = { not: "COMPLETED" }; }
  else if (view === "upcoming") { where.dueAt = { gte: tomorrow }; where.status = { not: "COMPLETED" }; }
  else if (view === "completed") { where.status = "COMPLETED"; }
  else if (view === "mine") { where.ownerId = (session.user as any).id; where.status = { not: "COMPLETED" }; }

  if (status) where.status = status;
  if (ownerId) where.ownerId = ownerId;
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
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = createTaskSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.message);

  const { dueAt, ...rest } = parsed.data;

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
      userId: (session.user as any).id,
      taskId: task.id,
      contactId: task.contactId ?? undefined,
      leadId: task.leadId ?? undefined,
    },
  });

  // Fire-and-forget — don't block task creation on notification delivery
  notifyTaskCreated({
    taskId: task.id,
    taskTitle: task.title,
    creatorId: (session.user as any).id,
    creatorRole: (session.user as any).role ?? "EMPLOYEE",
    creatorName: session.user.name ?? "Someone",
    assigneeId: task.ownerId ?? null,
  });

  revalidatePath("/tasks");
  return task;
}

export async function updateTask(id: string, data: unknown) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = createTaskSchema.partial().safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.message);

  const { dueAt, ...rest } = parsed.data;
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
        userId: (session.user as any).id,
        taskId: task.id,
      },
    });
  }

  revalidatePath("/tasks");
  return task;
}

export async function archiveTask(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await prisma.task.update({ where: { id }, data: { isArchived: true } });
  revalidatePath("/tasks");
}
