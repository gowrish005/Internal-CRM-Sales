import { getContact } from "@/lib/actions/contacts";
import { notFound } from "next/navigation";
import { ContactDetail } from "@/components/crm/contact-detail";
import { getBranches } from "@/lib/actions/branches";
import { getUsers } from "@/lib/actions/users";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [contact, branches, users] = await Promise.all([
    getContact(id),
    getBranches(),
    getUsers(),
  ]);

  if (!contact) notFound();

  return <ContactDetail contact={contact as any} branches={branches as any} users={users as any} />;
}
