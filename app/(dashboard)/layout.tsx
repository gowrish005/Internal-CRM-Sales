import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LayoutShell } from "@/components/layout/layout-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <LayoutShell user={session.user as any}>
      {children}
    </LayoutShell>
  );
}
