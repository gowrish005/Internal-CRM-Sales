import { prisma } from "@/lib/db";
import { requireManagerPage } from "@/lib/dal";
import { ActivityTimeline } from "@/components/dashboard/activity-timeline";

export default async function ActivityPage() {
  await requireManagerPage();

  const [activities, users] = await Promise.all([
    prisma.activity.findMany({
      include: {
        user: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        lead: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>Activity</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          What&apos;s happened across the team, most recent first
        </p>
      </div>
      <ActivityTimeline activities={activities as any} users={users} />
    </div>
  );
}
