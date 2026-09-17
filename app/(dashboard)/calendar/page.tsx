import { getCurrentUser, isManager } from "@/lib/dal";
import { redirect } from "next/navigation";
import { getEvents } from "@/lib/actions/events";
import { getUsers } from "@/lib/actions/users";
import { getContacts } from "@/lib/actions/contacts";
import { CalendarClient } from "@/components/calendar/calendar-client";
import { startOfMonth, endOfMonth, addMonths } from "date-fns";

export default async function CalendarPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const canManage = isManager(user);
  const now = new Date();
  const from = startOfMonth(addMonths(now, -1));
  const to = endOfMonth(addMonths(now, 2));

  const [events, users, contacts] = await Promise.all([
    getEvents({ from, to }),
    getUsers(),
    canManage ? getContacts({ limit: 200 }).then((r) => r.contacts) : [],
  ]);

  return (
    <CalendarClient
      events={events as any}
      users={users as any}
      contacts={contacts as any}
      currentUserId={user.id}
      currentUserRole={user.role}
    />
  );
}
