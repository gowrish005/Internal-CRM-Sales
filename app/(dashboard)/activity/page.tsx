import { prisma } from "@/lib/db";
import { requireManagerPage } from "@/lib/dal";
import { format } from "date-fns";
import { ActivityTimeline } from "@/components/dashboard/activity-timeline";

export default async function ActivityPage() {
  await requireManagerPage();

  const activities = await prisma.activity.findMany({
    include: {
      user: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      lead: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>Activity</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>Recent system activity</p>
      </div>
      <ActivityTimeline activities={activities as any} />
    </div>
  );
}
