import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/*
 * Data Access Layer — the one place that decides who may see or change what.
 *
 * Roles:
 *   ADMIN, FOUNDER — managers: everything (user management stays ADMIN-only).
 *   EMPLOYEE       — only leads and tasks they own, calendar events they
 *                    organise or attend. No B2B contacts, no activity feed,
 *                    no bulk lead operations.
 *
 * Every Server Action and data-reading page must go through here: Server
 * Actions are reachable by direct POST, so a hidden button is not a check.
 * The role is read from the database, not the session token, so a role change
 * or deactivation takes effect immediately.
 */

export type CurrentUser = { id: string; name: string; email: string; role: "ADMIN" | "FOUNDER" | "EMPLOYEE" };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) return null;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) return null;
  const { isActive: _, ...rest } = user;
  return rest;
});

export const isManager = (user: Pick<CurrentUser, "role">) => user.role === "ADMIN" || user.role === "FOUNDER";

/** For Server Actions and API routes: throws when not signed in. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

/** For Server Actions and API routes: throws unless ADMIN or FOUNDER. */
export async function requireManager() {
  const user = await requireUser();
  if (!isManager(user)) throw new Error("Forbidden");
  return user;
}

/** For pages: redirects instead of throwing. */
export async function requireManagerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManager(user)) redirect("/dashboard");
  return user;
}

/* ---- row scopes: spread into a Prisma `where` ---------------------------- */

export const leadScope = (user: CurrentUser) => (isManager(user) ? {} : { ownerId: user.id });
export const taskScope = (user: CurrentUser) => (isManager(user) ? {} : { ownerId: user.id });
export const eventScope = (user: CurrentUser) =>
  isManager(user) ? {} : { OR: [{ organizerId: user.id }, { participantIds: { has: user.id } }] };

/* ---- single-row checks: "not found" rather than "forbidden", so ids of
 *      other people's records can't be probed ------------------------------ */

export async function assertLeadAccess(user: CurrentUser, id: string) {
  const lead = await prisma.lead.findFirst({ where: { id, ...leadScope(user) }, select: { id: true } });
  if (!lead) throw new Error("Lead not found");
}

export async function assertTaskAccess(user: CurrentUser, id: string) {
  const task = await prisma.task.findFirst({ where: { id, ...taskScope(user) }, select: { id: true } });
  if (!task) throw new Error("Task not found");
}

/** Editing or cancelling an event: managers, or the employee who organised it. */
export async function assertEventOwnership(user: CurrentUser, id: string) {
  const where = isManager(user) ? { id } : { id, organizerId: user.id };
  const event = await prisma.calendarEvent.findFirst({ where, select: { id: true } });
  if (!event) throw new Error("Event not found");
}
