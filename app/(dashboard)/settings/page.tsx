import { auth } from "@/lib/auth";
import { getUsers } from "@/lib/actions/users";
import { SettingsClient } from "@/components/crm/settings-client";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const role = (session.user as any).role;
  const users = role === "ADMIN" ? await getUsers() : [];

  return <SettingsClient user={session.user as any} users={users as any} />;
}
