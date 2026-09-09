"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function getDashboardData() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const userId = (session.user as any).id;
  const role = (session.user as any).role;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);
  const weekEnd = new Date(today.getTime() + 7 * 86400000);

  const userFilter = role === "ADMIN" ? {} : { ownerId: userId };
  const eventUserFilter = role === "ADMIN" ? {} : {
    OR: [{ organizerId: userId }, { participantIds: { has: userId } }],
  };

  const [
    totalContacts,
    activeLeads,
    meetingsToday,
    pendingFollowUps,
    todayMeetings,
    upcomingMeetings,
    tasksDueToday,
    recentActivity,
  ] = await Promise.all([
    prisma.contact.count({ where: { isArchived: false, ...userFilter } }),
    prisma.lead.count({ where: { isArchived: false, status: { notIn: ["WON", "LOST"] }, ...userFilter } }),
    prisma.calendarEvent.count({
      where: { isCancelled: false, startAt: { gte: today, lt: tomorrow }, ...eventUserFilter },
    }),
    prisma.contact.count({
      where: { isArchived: false, nextFollowUpAt: { lte: tomorrow }, ...userFilter },
    }),
    prisma.calendarEvent.findMany({
      where: { isCancelled: false, startAt: { gte: today, lt: tomorrow }, ...eventUserFilter },
      include: { organizer: { select: { id: true, name: true } }, contact: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { startAt: "asc" },
    }),
    prisma.calendarEvent.findMany({
      where: { isCancelled: false, startAt: { gte: tomorrow, lte: weekEnd }, ...eventUserFilter },
      include: { organizer: { select: { id: true, name: true } } },
      orderBy: { startAt: "asc" },
      take: 5,
    }),
    prisma.task.findMany({
      where: { isArchived: false, status: { not: "COMPLETED" }, dueAt: { gte: today, lt: tomorrow }, ...userFilter },
      include: { owner: { select: { id: true, name: true } } },
      orderBy: { priority: "desc" },
    }),
    prisma.activity.findMany({
      where: role !== "ADMIN" ? { userId } : {},
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  return {
    stats: { totalContacts, activeLeads, meetingsToday, pendingFollowUps },
    todayMeetings,
    upcomingMeetings,
    tasksDueToday,
    recentActivity,
  };
}
