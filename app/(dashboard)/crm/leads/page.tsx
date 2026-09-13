import { getLeads } from "@/lib/actions/leads";
import { getUsers } from "@/lib/actions/users";
import { getContacts } from "@/lib/actions/contacts";
import { LeadsClient } from "@/components/crm/leads-client";

export default async function LeadsPage() {
  const [leads, users, { contacts }] = await Promise.all([
    getLeads(),
    getUsers(),
    getContacts({ limit: 200 }),
  ]);

  return <LeadsClient leads={leads as any} users={users as any} contacts={contacts as any} />;
}
