import { getTasks } from "@/lib/actions/tasks";
import { getUsers } from "@/lib/actions/users";
import { getBranches } from "@/lib/actions/branches";
import { getContacts } from "@/lib/actions/contacts";
import { getLeads } from "@/lib/actions/leads";
import { TasksClient } from "@/components/crm/tasks-client";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const view = (params.view as any) || undefined;

  const [tasks, users, branches, { contacts }, leads] = await Promise.all([
    getTasks({ view }),
    getUsers(),
    getBranches(),
    getContacts({ limit: 200 }),
    getLeads(),
  ]);

  return <TasksClient tasks={tasks as any} users={users as any} branches={branches as any} contacts={contacts as any} leads={leads as any} />;
}
