import { getContact } from "@/lib/actions/contacts";
import { notFound } from "next/navigation";
import { ContactDetail } from "@/components/crm/contact-detail";
import { getUsers } from "@/lib/actions/users";
import { requireManagerPage } from "@/lib/dal";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  await requireManagerPage();
  const { id } = await params;
  const [contact, users] = await Promise.all([
    getContact(id),
    getUsers(),
  ]);

  if (!contact) notFound();

  return <ContactDetail contact={contact as any} users={users as any} />;
}
