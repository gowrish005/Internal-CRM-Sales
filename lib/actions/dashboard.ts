"use server";

import { prisma } from "@/lib/db";
import { requireUser, isManager, leadScope, taskScope, eventScope } from "@/lib/dal";

export async function getDashboardData() {
  const user = await requireUser();
  const manager = isManager(user);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);
  const weekEnd = new Date(today.getTime() + 7 * 86400000);

  const eventUserFilter = eventScope(user);

  const [
    contactsOrOpenTasks,
    activeLeads,
    meetingsToday,
    pendingFollowUps,
    todayMeetings,
    upcomingMeetings,
    tasksDueToday,
    recentActivity,
  ] = await Promise.all([
    // B2B contacts are a manager-only list; employees get their open tasks instead.
    manager
      ? prisma.contact.count({ where: { isArchived: false } })
      : prisma.task.count({ where: { isArchived: false, status: { not: "COMPLETED" }, ...taskScope(user) } }),
    prisma.lead.count({ where: { isArchived: false, status: { notIn: ["WON", "LOST"] }, ...leadScope(user) } }),
    prisma.calendarEvent.count({
      where: { isCancelled: false, startAt: { gte: today, lt: tomorrow }, ...eventUserFilter },
    }),
    manager
      ? prisma.contact.count({ where: { isArchived: false, nextFollowUpAt: { lte: tomorrow } } })
      : prisma.lead.count({ where: { isArchived: false, nextFollowUpAt: { lte: tomorrow }, ...leadScope(user) } }),
    prisma.calendarEvent.findMany({
      where: { isCancelled: false, startAt: { gte: today, lt: tomorrow }, ...eventUserFilter },
      include: {
        organizer: { select: { id: true, name: true } },
        ...(manager ? { contact: { select: { id: true, firstName: true, lastName: true } } } : {}),
      },
      orderBy: { startAt: "asc" },
    }),
    prisma.calendarEvent.findMany({
      where: { isCancelled: false, startAt: { gte: tomorrow, lte: weekEnd }, ...eventUserFilter },
      include: { organizer: { select: { id: true, name: true } } },
      orderBy: { startAt: "asc" },
      take: 5,
    }),
    prisma.task.findMany({
      where: { isArchived: false, status: { not: "COMPLETED" }, dueAt: { gte: today, lt: tomorrow }, ...taskScope(user) },
      include: { owner: { select: { id: true, name: true } } },
      orderBy: { priority: "desc" },
    }),
    prisma.activity.findMany({
      where: manager ? {} : { userId: user.id },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  return {
    isManager: manager,
    stats: {
      totalContacts: manager ? contactsOrOpenTasks : 0,
      openTasks: manager ? 0 : contactsOrOpenTasks,
      activeLeads,
      meetingsToday,
      pendingFollowUps,
    },
    todayMeetings,
    upcomingMeetings,
    tasksDueToday,
    recentActivity,
  };
}
