import { getContacts } from "@/lib/actions/contacts";
import { getBranches } from "@/lib/actions/branches";
import { getUsers } from "@/lib/actions/users";
import { ContactsClient } from "@/components/crm/contacts-client";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const [{ contacts, total }, branches, users] = await Promise.all([
    getContacts({
      search: params.search,
      status: params.status,
      branchId: params.branch,
    }),
    getBranches(),
    getUsers(),
  ]);

  return (
    <ContactsClient
      initialContacts={contacts as any}
      branches={branches as any}
      users={users as any}
      total={total}
    />
  );
}
