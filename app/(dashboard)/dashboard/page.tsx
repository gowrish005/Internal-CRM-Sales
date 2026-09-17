import { getDashboardData } from "@/lib/actions/dashboard";
import { format, isToday, isTomorrow } from "date-fns";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { LEAD_STATUS_COLORS, LEAD_STATUS_LABELS } from "@/lib/lead-status";

export default async function DashboardPage() {
  const data = await getDashboardData();
  const { isManager, stats, todayMeetings, upcomingMeetings, tasksDueToday, recentActivity, leadsNeedingFollowUp } = data;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>Dashboard</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          {format(new Date(), "EEEE, MMMM d")}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isManager ? (
          <StatCard label="Total Contacts" value={stats.totalContacts} href="/crm/contacts" />
        ) : (
          <StatCard label="My Open Tasks" value={stats.openTasks} href="/tasks" />
        )}
        <StatCard label={isManager ? "Active Leads" : "My Active Leads"} value={stats.activeLeads} href="/crm/leads" />
        {isManager && (
          <StatCard label="Unassigned Leads" value={stats.unassignedLeads} href="/crm/leads" />
        )}
        <StatCard label="Meetings Today" value={stats.meetingsToday} href="/calendar" />
        <StatCard
          label={isManager ? "Pending Follow-ups" : "Lead Follow-ups Due"}
          value={stats.pendingFollowUps}
          href={isManager ? "/crm/contacts?filter=followup" : "/crm/leads"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Today */}
        <div className="lg:col-span-2 space-y-4">
          {/* Today's meetings */}
          <Section title="Today's Meetings" href="/calendar" count={todayMeetings.length}>
            {todayMeetings.length === 0 ? (
              <Empty text="No meetings today" />
            ) : (
              todayMeetings.map((m: any) => (
                <MeetingRow key={m.id} meeting={m} />
              ))
            )}
          </Section>

          {/* Tasks due today */}
          <Section title="Tasks Due Today" href="/tasks?view=today" count={tasksDueToday.length}>
            {tasksDueToday.length === 0 ? (
              <Empty text="No tasks due today" />
            ) : (
              tasksDueToday.map((t: any) => (
                <TaskRow key={t.id} task={t} />
              ))
            )}
          </Section>

          {/* Upcoming meetings */}
          {upcomingMeetings.length > 0 && (
            <Section title="Upcoming" href="/calendar" count={upcomingMeetings.length}>
              {upcomingMeetings.map((m: any) => (
                <MeetingRow key={m.id} meeting={m} compact />
              ))}
            </Section>
          )}
        </div>

        {/* Recent activity (managers) / follow-ups due (employees) */}
        <div>
          {isManager ? (
            <Section title="Recent Activity" href="/activity">
              {recentActivity.length === 0 ? (
                <Empty text="No recent activity" />
              ) : (
                recentActivity.slice(0, 8).map((a: any) => (
                  <ActivityRow key={a.id} activity={a} />
                ))
              )}
            </Section>
          ) : (
            <Section title="Leads Needing Follow-up" href="/crm/leads" count={leadsNeedingFollowUp.length}>
              {leadsNeedingFollowUp.length === 0 ? (
                <Empty text="No follow-ups due" />
              ) : (
                leadsNeedingFollowUp.map((l: any) => (
                  <LeadFollowUpRow key={l.id} lead={l} />
                ))
              )}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="stat-card-gradient rounded-xl border p-5 transition-all hover:brightness-110 group"
      style={{ borderColor: "#1e3a24" }}
    >
      <p className="text-xs font-medium mb-3" style={{ color: "#7a7a7a" }}>{label}</p>
      <p className="text-3xl font-bold tracking-tight" style={{ color: "#ebebeb" }}>{value}</p>
    </Link>
  );
}

function Section({ title, href, count, children }: { title: string; href?: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border" style={{ background: "var(--card)", borderColor: "#1e3322" }}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#1a2e1e" }}>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{title}</h2>
          {count !== undefined && (
            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "#1a3020", color: "#22c55e" }}>
              {count}
            </span>
          )}
        </div>
        {href && (
          <Link
            href={href}
            className="section-view-all flex items-center gap-1 text-xs rounded-md px-2 py-1"
          >
            View all <ArrowRight size={12} className="ml-0.5" />
          </Link>
        )}
      </div>
      <div className="divide-y" style={{ borderColor: "#1a2e1e" }}>{children}</div>
    </div>
  );
}

function MeetingRow({ meeting, compact }: { meeting: any; compact?: boolean }) {
  return (
    <div className="px-4 py-2.5 flex items-start gap-3">
      <div className="shrink-0 text-center w-10">
        <p className="text-xs font-medium" style={{ color: "#22c55e" }}>
          {format(new Date(meeting.startAt), "HH:mm")}
        </p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{meeting.title}</p>
        {!compact && (
          <p className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
            {meeting.organizer?.name}
            {meeting.contact && ` · ${meeting.contact.firstName} ${meeting.contact.lastName}`}
          </p>
        )}
        {!compact && (
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {format(new Date(meeting.startAt), "HH:mm")} – {format(new Date(meeting.endAt), "HH:mm")}
          </p>
        )}
        {compact && (
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {isTomorrow(new Date(meeting.startAt)) ? "Tomorrow" : format(new Date(meeting.startAt), "EEE, MMM d")} · {format(new Date(meeting.startAt), "HH:mm")}
          </p>
        )}
      </div>
    </div>
  );
}

function TaskRow({ task }: { task: any }) {
  const priorityColor = task.priority === "HIGH" ? "#dc2626" : task.priority === "MEDIUM" ? "#d97706" : "#6b7280";
  return (
    <div className="px-4 py-2.5 flex items-center gap-3">
      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: priorityColor }} />
      <p className="text-sm flex-1 truncate" style={{ color: "var(--foreground)" }}>{task.title}</p>
      <span className="text-xs shrink-0" style={{ color: "var(--muted-foreground)" }}>{task.owner?.name}</span>
    </div>
  );
}

function LeadFollowUpRow({ lead }: { lead: any }) {
  const overdue = lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) < new Date(new Date().setHours(0, 0, 0, 0));
  return (
    <div className="px-4 py-2.5 flex items-center gap-3">
      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: LEAD_STATUS_COLORS[lead.status as keyof typeof LEAD_STATUS_COLORS] }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate" style={{ color: "var(--foreground)" }}>{lead.name}</p>
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{LEAD_STATUS_LABELS[lead.status as keyof typeof LEAD_STATUS_LABELS]}</p>
      </div>
      <span className="text-xs shrink-0" style={{ color: overdue ? "#dc2626" : "var(--muted-foreground)" }}>
        {lead.nextFollowUpAt ? format(new Date(lead.nextFollowUpAt), "MMM d") : "—"}
      </span>
    </div>
  );
}

function ActivityRow({ activity }: { activity: any }) {
  return (
    <div className="px-4 py-2.5">
      <p className="text-xs" style={{ color: "var(--foreground)" }}>{activity.description}</p>
      <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
        {activity.user?.name} · {format(new Date(activity.createdAt), "MMM d, HH:mm")}
      </p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="px-4 py-6 text-center">
      <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{text}</p>
    </div>
  );
}
