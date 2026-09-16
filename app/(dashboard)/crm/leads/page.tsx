import { getLeads } from "@/lib/actions/leads";
import { getUsers } from "@/lib/actions/users";
import { LeadsClient } from "@/components/crm/leads-client";

export default async function LeadsPage() {
  const [leads, users] = await Promise.all([getLeads(), getUsers()]);

  return <LeadsClient leads={leads as any} users={users as any} />;
}
