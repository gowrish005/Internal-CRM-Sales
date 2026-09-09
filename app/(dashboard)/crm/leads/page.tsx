import { getLeads } from "@/lib/actions/leads";
import { getBranches } from "@/lib/actions/branches";
import { getUsers } from "@/lib/actions/users";
import { getContacts } from "@/lib/actions/contacts";
import { LeadsClient } from "@/components/crm/leads-client";

export default async function LeadsPage() {
  const [leads, branches, users, { contacts }] = await Promise.all([
    getLeads(),
    getBranches(),
    getUsers(),
    getContacts({ limit: 200 }),
  ]);

  return <LeadsClient leads={leads as any} branches={branches as any} users={users as any} contacts={contacts as any} />;
}
