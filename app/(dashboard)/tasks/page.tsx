import { getTasks } from "@/lib/actions/tasks";
import { getUsers } from "@/lib/actions/users";
import { getContacts } from "@/lib/actions/contacts";
import { getLeads } from "@/lib/actions/leads";
import { TasksClient } from "@/components/crm/tasks-client";
import { auth } from "@/lib/auth";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const view = (params.view as any) || undefined;
  const session = await auth();

  const [tasks, users, { contacts }, leads] = await Promise.all([
    getTasks({ view }),
    getUsers(),
    getContacts({ limit: 200 }),
    getLeads(),
  ]);

  return <TasksClient tasks={tasks as any} users={users as any} contacts={contacts as any} leads={leads as any} currentUserId={(session?.user as any)?.id} />;
}
