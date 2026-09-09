import { getBranch } from "@/lib/actions/branches";
import { notFound } from "next/navigation";
import { BranchDetail } from "@/components/crm/branch-detail";

export default async function BranchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const branch = await getBranch(id);
  if (!branch) notFound();
  return <BranchDetail branch={branch as any} />;
}
