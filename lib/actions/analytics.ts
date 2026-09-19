"use server";

import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/dal";
import { addDaysIST } from "@/lib/date";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/lead-status";

/* ---- pipeline funnel: leads by status, org-wide -------------------------- */

export type PipelineFunnel = Record<LeadStatus, number>;

export async function getPipelineFunnel(): Promise<PipelineFunnel> {
  await requireManager();
  const leads = await prisma.lead.findMany({ where: { isArchived: false }, select: { status: true } });
  const funnel = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as PipelineFunnel;
  for (const l of leads) funnel[l.status]++;
  return funnel;
}

/* ---- team performance: one row per active user --------------------------- */

export type TeamPerformanceRow = {
  id: string;
  name: string;
  role: string;
  leadsOwned: number;
  contacted: number;
  contactedRate: number | null;
  hot: number;
  callback: number;
  won: number;
  lost: number;
  conversionRate: number | null; // won / (won + lost)
  callsLast7d: number;
  overdueFollowUps: number;
  tasksCompletedLast7d: number;
};

export async function getTeamPerformance(): Promise<TeamPerformanceRow[]> {
  await requireManager();
  const now = new Date();
  const sevenDaysAgo = addDaysIST(now, -7);

  const [users, leads, callLogs, completedTasks] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, role: "EMPLOYEE" },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.lead.findMany({
      where: { isArchived: false, ownerId: { not: null } },
      select: { ownerId: true, status: true, nextFollowUpAt: true },
    }),
    prisma.callLog.findMany({
      where: { calledAt: { gte: sevenDaysAgo } },
      select: { loggedById: true },
    }),
    prisma.task.findMany({
      where: { isArchived: false, status: "COMPLETED", updatedAt: { gte: sevenDaysAgo } },
      select: { ownerId: true },
    }),
  ]);

  const callCounts = new Map<string, number>();
  for (const c of callLogs) callCounts.set(c.loggedById, (callCounts.get(c.loggedById) ?? 0) + 1);

  const taskCounts = new Map<string, number>();
  for (const t of completedTasks) {
    if (!t.ownerId) continue;
    taskCounts.set(t.ownerId, (taskCounts.get(t.ownerId) ?? 0) + 1);
  }

  const leadsByOwner = new Map<string, typeof leads>();
  for (const l of leads) {
    if (!l.ownerId) continue;
    const arr = leadsByOwner.get(l.ownerId) ?? [];
    arr.push(l);
    leadsByOwner.set(l.ownerId, arr);
  }

  return users.map((u) => {
    const owned = leadsByOwner.get(u.id) ?? [];
    const contacted = owned.filter((l) => l.status !== "NEW").length;
    const hot = owned.filter((l) => l.status === "HOT").length;
    const callback = owned.filter((l) => l.status === "CALLBACK").length;
    const won = owned.filter((l) => l.status === "WON").length;
    const lost = owned.filter((l) => l.status === "LOST").length;
    const closed = won + lost;
    const overdueFollowUps = owned.filter(
      (l) => l.nextFollowUpAt && l.nextFollowUpAt < now && l.status !== "WON" && l.status !== "LOST"
    ).length;

    return {
      id: u.id,
      name: u.name,
      role: u.role,
      leadsOwned: owned.length,
      contacted,
      contactedRate: owned.length ? contacted / owned.length : null,
      hot,
      callback,
      won,
      lost,
      conversionRate: closed ? won / closed : null,
      callsLast7d: callCounts.get(u.id) ?? 0,
      overdueFollowUps,
      tasksCompletedLast7d: taskCounts.get(u.id) ?? 0,
    };
  });
}

/* ---- lead batch performance: leads grouped by source / college / track /
        passout year — the "which batch of leads is doing well" view -------- */

export type LeadBatchRow = {
  key: string;
  label: string;
  total: number;
  won: number;
  lost: number;
  hot: number;
  open: number;
  conversionRate: number | null; // won / (won + lost)
};

export type LeadBatchDimension = "source" | "college" | "track" | "passoutYear";

const NO_VALUE = "__none__";

function dimensionLabel(dimension: LeadBatchDimension, key: string): string {
  if (key === NO_VALUE) {
    return dimension === "source" ? "No source" : dimension === "college" ? "No college" : dimension === "track" ? "No track" : "No passout year";
  }
  if (dimension === "source") return key.replace(/_/g, " ");
  if (dimension === "track") return `Track ${key}`;
  return key;
}

function groupLeads(
  leads: { status: LeadStatus; source: string | null; college: string | null; track: number | null; passoutYear: number | null }[],
  dimension: LeadBatchDimension
): LeadBatchRow[] {
  const keyOf = (l: (typeof leads)[number]) => {
    const raw =
      dimension === "source" ? l.source : dimension === "college" ? l.college : dimension === "track" ? l.track : l.passoutYear;
    return raw === null || raw === undefined || raw === "" ? NO_VALUE : String(raw);
  };

  const groups = new Map<string, { total: number; won: number; lost: number; hot: number; open: number }>();
  for (const l of leads) {
    const key = keyOf(l);
    const g = groups.get(key) ?? { total: 0, won: 0, lost: 0, hot: 0, open: 0 };
    g.total++;
    if (l.status === "WON") g.won++;
    else if (l.status === "LOST") g.lost++;
    else {
      g.open++;
      if (l.status === "HOT") g.hot++;
    }
    groups.set(key, g);
  }

  return Array.from(groups.entries())
    .map(([key, g]) => ({
      key,
      label: dimensionLabel(dimension, key),
      total: g.total,
      won: g.won,
      lost: g.lost,
      hot: g.hot,
      open: g.open,
      conversionRate: g.won + g.lost ? g.won / (g.won + g.lost) : null,
    }))
    .sort((a, b) => b.total - a.total);
}

export type LeadBatchPerformance = Record<LeadBatchDimension, LeadBatchRow[]>;

export async function getLeadBatchPerformance(): Promise<LeadBatchPerformance> {
  await requireManager();
  const leads = await prisma.lead.findMany({
    where: { isArchived: false },
    select: { status: true, source: true, college: true, track: true, passoutYear: true },
  });

  return {
    source: groupLeads(leads, "source"),
    college: groupLeads(leads, "college"),
    track: groupLeads(leads, "track"),
    passoutYear: groupLeads(leads, "passoutYear"),
  };
}
