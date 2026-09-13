"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sendPushNotification } from "@/lib/firebase-admin";
import { revalidatePath } from "next/cache";

export interface NotifyTaskPayload {
  taskId: string;
  taskTitle: string;
  creatorId: string;
  creatorRole: string;
  creatorName: string;
  assigneeId?: string | null;
}

export async function notifyTaskCreated({
  taskId,
  taskTitle,
  creatorId,
  creatorName,
  assigneeId,
}: NotifyTaskPayload) {
  try {
    // Notify only the assigned user (the selected person) — never broadcast.
    if (!assigneeId || assigneeId === creatorId) return;

    const title = `New task from ${creatorName}`;
    const body = taskTitle;

    const recipients = await prisma.user.findMany({
      where: { id: assigneeId },
      select: { id: true, fcmToken: true },
    });
    if (recipients.length === 0) return;

    await Promise.all([
      // DB notifications
      prisma.notification.createMany({
        data: recipients.map((u) => ({
          userId: u.id,
          title,
          body,
          type: "TASK_CREATED",
          taskId,
        })),
      }),
      // Push notifications
      ...recipients
        .filter((u) => !!u.fcmToken)
        .map((u) =>
          sendPushNotification({
            token: u.fcmToken!,
            title,
            body,
            data: { taskId, link: "/tasks" },
          })
        ),
    ]);
  } catch (err) {
    console.error("[notifyTaskCreated]", err);
  }
}

export async function getNotifications() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const userId = (session.user as any).id as string;

  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function markNotificationRead(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const userId = (session.user as any).id as string;

  await prisma.notification.updateMany({
    where: { id, userId },
    data: { isRead: true },
  });
  revalidatePath("/");
}

export async function markAllNotificationsRead() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const userId = (session.user as any).id as string;

  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  revalidatePath("/");
}

export async function saveFcmToken(token: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const userId = (session.user as any).id as string;

  await prisma.user.update({ where: { id: userId }, data: { fcmToken: token } });
}
