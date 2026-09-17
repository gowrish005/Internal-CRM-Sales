"use server";

import { prisma } from "@/lib/db";
import { requireUser, isManager, leadScope, taskScope, eventScope } from "@/lib/dal";
import { startOfDayIST, addDaysIST } from "@/lib/date";

export async function getDashboardData() {
  const user = await requireUser();
  const manager = isManager(user);
  const today = startOfDayIST();
  const tomorrow = addDaysIST(today, 1);
  const weekEnd = addDaysIST(today, 7);

  const eventUserFilter = eventScope(user);

  const [
    contactsOrOpenTasks,
    activeLeads,
    unassignedLeads,
    meetingsToday,
    pendingFollowUps,
    todayMeetings,
    upcomingMeetings,
    tasksDueToday,
    // Managers get the org-wide feed (mirrors the manager-only /activity page);
    // employees get their own leads that need a follow-up call instead — that's
    // the job, not a feed of what already happened.
    recentActivity,
    leadsNeedingFollowUp,
  ] = await Promise.all([
    // B2B contacts are a manager-only list; employees get their open tasks instead.
    manager
      ? prisma.contact.count({ where: { isArchived: false } })
      : prisma.task.count({ where: { isArchived: false, status: { not: "COMPLETED" }, ...taskScope(user) } }),
    prisma.lead.count({ where: { isArchived: false, status: { notIn: ["WON", "LOST"] }, ...leadScope(user) } }),
    // Only a manager can divide/assign leads, so only they need to know how many are waiting.
    manager ? prisma.lead.count({ where: { isArchived: false, ownerId: null } }) : Promise.resolve(0),
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
    manager
      ? prisma.activity.findMany({
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
          take: 15,
        })
      : Promise.resolve([]),
    !manager
      ? prisma.lead.findMany({
          where: { isArchived: false, status: { notIn: ["WON", "LOST"] }, nextFollowUpAt: { lte: tomorrow }, ...leadScope(user) },
          select: { id: true, name: true, status: true, phone: true, nextFollowUpAt: true },
          orderBy: { nextFollowUpAt: "asc" },
          take: 8,
        })
      : Promise.resolve([]),
  ]);

  return {
    isManager: manager,
    stats: {
      totalContacts: manager ? contactsOrOpenTasks : 0,
      openTasks: manager ? 0 : contactsOrOpenTasks,
      activeLeads,
      unassignedLeads,
      meetingsToday,
      pendingFollowUps,
    },
    todayMeetings,
    upcomingMeetings,
    tasksDueToday,
    recentActivity,
    leadsNeedingFollowUp,
  };
}
