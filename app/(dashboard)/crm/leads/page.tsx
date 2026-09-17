import { getLeads } from "@/lib/actions/leads";
import { getUsers } from "@/lib/actions/users";
import { LeadsClient } from "@/components/crm/leads-client";
import { getCurrentUser, isManager } from "@/lib/dal";
import { redirect } from "next/navigation";

export default async function LeadsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [leads, users] = await Promise.all([getLeads(), getUsers()]);

  return <LeadsClient leads={leads as any} users={users as any} canManage={isManager(user)} />;
}
