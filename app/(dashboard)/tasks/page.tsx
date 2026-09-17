import { getTasks } from "@/lib/actions/tasks";
import { getUsers } from "@/lib/actions/users";
import { getContacts } from "@/lib/actions/contacts";
import { getLeads } from "@/lib/actions/leads";
import { TasksClient } from "@/components/crm/tasks-client";
import { getCurrentUser, isManager } from "@/lib/dal";
import { redirect } from "next/navigation";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const view = (params.view as any) || undefined;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const canManage = isManager(user);

  const [tasks, users, contacts, leads] = await Promise.all([
    getTasks({ view }),
    getUsers(),
    canManage ? getContacts({ limit: 200 }).then((r) => r.contacts) : [],
    getLeads(),
  ]);

  return <TasksClient tasks={tasks as any} users={users as any} contacts={contacts as any} leads={leads as any} currentUserId={user.id} canManage={canManage} />;
}
