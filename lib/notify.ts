import "server-only";

// Not a Server Action: anything exported from a "use server" file can be
// called by direct POST, and this sends push notifications on behalf of
// whoever is named in the payload. Only call it from trusted server code.

import { prisma } from "@/lib/db";
import { sendPushNotification } from "@/lib/firebase-admin";

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
