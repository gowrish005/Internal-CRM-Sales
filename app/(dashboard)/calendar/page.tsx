import { auth } from "@/lib/auth";
import { getEvents } from "@/lib/actions/events";
import { getUsers } from "@/lib/actions/users";
import { getContacts } from "@/lib/actions/contacts";
import { CalendarClient } from "@/components/calendar/calendar-client";
import { startOfMonth, endOfMonth, addMonths } from "date-fns";

export default async function CalendarPage() {
  const session = await auth();
  const now = new Date();
  const from = startOfMonth(addMonths(now, -1));
  const to = endOfMonth(addMonths(now, 2));

  const [events, users, { contacts }] = await Promise.all([
    getEvents({ from, to }),
    getUsers(),
    getContacts({ limit: 200 }),
  ]);

  return (
    <CalendarClient
      events={events as any}
      users={users as any}
      contacts={contacts as any}
      currentUserId={(session?.user as any)?.id}
      currentUserRole={(session?.user as any)?.role}
    />
  );
}
