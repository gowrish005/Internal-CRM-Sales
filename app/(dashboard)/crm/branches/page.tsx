import { getBranches } from "@/lib/actions/branches";
import { getUsers } from "@/lib/actions/users";
import { BranchesClient } from "@/components/crm/branches-client";

export default async function BranchesPage() {
  const [branches, users] = await Promise.all([getBranches(), getUsers()]);
  return <BranchesClient branches={branches as any} users={users as any} />;
}
