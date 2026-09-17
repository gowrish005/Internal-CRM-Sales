import { notFound, redirect } from "next/navigation";
import { getLead } from "@/lib/actions/leads";
import { getUsers } from "@/lib/actions/users";
import { getCurrentUser, isManager } from "@/lib/dal";
import { LeadDetail } from "@/components/crm/lead-detail";

export default async function LeadPage({ params }: PageProps<"/crm/leads/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;

  const [lead, users] = await Promise.all([getLead(id), getUsers()]);
  if (!lead) notFound();

  // key: a fresh component per lead, so the form never carries over the previous lead's edits.
  return <LeadDetail key={lead.id} lead={lead as any} users={users as any} canManage={isManager(user)} />;
}
