import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { PageTransition } from "@/components/layout/page-transition";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={session.user as any} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6" style={{ background: "var(--background)" }}>
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
