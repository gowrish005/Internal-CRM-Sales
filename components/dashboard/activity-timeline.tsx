"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { formatIST, isTodayIST } from "@/lib/date";
import {
  UserPlus,
  UserCheck,
  Building2,
  TrendingUp,
  RefreshCw,
  CalendarPlus,
  CalendarClock,
  CheckSquare,
  CheckCircle2,
  FileText,
  Clock,
  Search,
  type LucideIcon,
} from "lucide-react";

const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  CONTACT_CREATED: UserPlus,
  CONTACT_UPDATED: UserCheck,
  BRANCH_CREATED: Building2,
  LEAD_CREATED: TrendingUp,
  LEAD_STATUS_CHANGED: RefreshCw,
  MEETING_CREATED: CalendarPlus,
  MEETING_RESCHEDULED: CalendarClock,
  TASK_CREATED: CheckSquare,
  TASK_COMPLETED: CheckCircle2,
  NOTE_ADDED: FileText,
  FOLLOW_UP_CREATED: Clock,
  FOLLOW_UP_COMPLETED: CheckCircle2,
};

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  CONTACT_CREATED: "Contact created",
  CONTACT_UPDATED: "Contact updated",
  BRANCH_CREATED: "Branch created",
  LEAD_CREATED: "Lead created",
  LEAD_STATUS_CHANGED: "Lead status changed",
  MEETING_CREATED: "Meeting scheduled",
  MEETING_RESCHEDULED: "Meeting rescheduled",
  TASK_CREATED: "Task created",
  TASK_COMPLETED: "Task completed",
  NOTE_ADDED: "Note added",
  FOLLOW_UP_CREATED: "Follow-up created",
  FOLLOW_UP_COMPLETED: "Follow-up completed",
};

function typeLabel(type: string): string {
  return ACTIVITY_TYPE_LABELS[type] ?? type;
}

interface ActivityUser {
  id: string;
  name: string;
}

function dayBucket(date: Date): string {
  const now = new Date();
  const dayMs = 86400000;
  const diffDays = Math.floor((now.getTime() - date.getTime()) / dayMs);
  if (isTodayIST(date)) return "Today";
  if (diffDays >= 1 && diffDays < 2) return "Yesterday";
  if (diffDays < 7) return "This week";
  return formatIST(date, "monthDayYear");
}

export function ActivityTimeline({ activities, users = [] }: { activities: any[]; users?: ActivityUser[] }) {
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState("");
  const [type, setType] = useState("");
  // Read once on mount rather than in the memo body below, which must stay pure.
  const [now] = useState(() => Date.now());

  const availableTypes = useMemo(
    () => Array.from(new Set(activities.map((a) => a.type))).sort(),
    [activities]
  );

  const todayCount = useMemo(() => activities.filter((a) => isTodayIST(new Date(a.createdAt))).length, [activities]);
  const weekCount = useMemo(
    () => activities.filter((a) => now - new Date(a.createdAt).getTime() < 7 * 86400000).length,
    [activities, now]
  );
  const busiestUser = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of activities) if (a.user) counts.set(a.user.name, (counts.get(a.user.name) ?? 0) + 1);
    let best: [string, number] | null = null;
    for (const entry of counts) if (!best || entry[1] > best[1]) best = entry;
    return best;
  }, [activities]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activities.filter((a) => {
      if (userId && a.user?.id !== userId) return false;
      if (type && a.type !== type) return false;
      if (q) {
        const haystack = [
          a.description,
          a.user?.name,
          a.contact ? `${a.contact.firstName} ${a.contact.lastName}` : "",
          a.lead?.name,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [activities, search, userId, type]);

  const groups = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const a of filtered) {
      const bucket = dayBucket(new Date(a.createdAt));
      const arr = map.get(bucket) ?? [];
      arr.push(a);
      map.set(bucket, arr);
    }
    return map;
  }, [filtered]);

  const hasFilters = Boolean(search || userId || type);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Today" value={String(todayCount)} />
        <SummaryCard label="This week" value={String(weekCount)} />
        <SummaryCard label="Most active" value={busiestUser ? `${busiestUser[0]}` : "—"} sub={busiestUser ? `${busiestUser[1]} actions` : undefined} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search activity…"
            className="w-full rounded-md border pl-8 pr-2.5 py-1.5 text-xs outline-none"
            style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--foreground)" }}
          />
        </div>
        {users.length > 0 && (
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="rounded-md border px-2.5 py-1.5 text-xs outline-none"
            style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--foreground)" }}
          >
            <option value="">All employees</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        )}
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-md border px-2.5 py-1.5 text-xs outline-none"
          style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--foreground)" }}
        >
          <option value="">All activity types</option>
          {availableTypes.map((t) => (
            <option key={t} value={t}>{typeLabel(t)}</option>
          ))}
        </select>
        {hasFilters && (
          <button
            onClick={() => { setSearch(""); setUserId(""); setType(""); }}
            className="text-xs px-2 py-1.5"
            style={{ color: "var(--muted-foreground)" }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Feed */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-lg border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            {activities.length === 0 ? "No activity yet" : "No activity matches these filters"}
          </p>
        </div>
      ) : (
        Array.from(groups.entries()).map(([bucket, items]) => (
          <div key={bucket}>
            <h3 className="text-xs font-semibold uppercase tracking-wide mb-1.5 px-0.5" style={{ color: "var(--muted-foreground)" }}>
              {bucket}
            </h3>
            <div className="rounded-lg border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              {items.map((a) => {
                const Icon = ACTIVITY_ICONS[a.type] ?? Clock;
                return (
                  <div
                    key={a.id}
                    className="flex items-start gap-3.5 px-4 py-3 border-b last:border-b-0"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div
                      className="flex items-center justify-center w-6 h-6 rounded shrink-0 mt-0.5"
                      style={{ background: "var(--secondary)" }}
                    >
                      <Icon size={12} style={{ color: "var(--muted-foreground)" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm" style={{ color: "var(--foreground)" }}>{a.description}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}
                        >
                          {typeLabel(a.type)}
                        </span>
                        {a.user && (
                          <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>{a.user.name}</span>
                        )}
                        {a.contact && (
                          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>· {a.contact.firstName} {a.contact.lastName}</span>
                        )}
                        {a.lead && (
                          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>· {a.lead.name}</span>
                        )}
                      </div>
                    </div>
                    <span
                      className="text-xs shrink-0 tabular-nums"
                      style={{ color: "var(--muted-foreground)" }}
                      title={formatIST(a.createdAt, "monthDayYearTime")}
                    >
                      {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border p-3" style={{ background: "var(--card)", borderColor: "#1e3322" }}>
      <p className="text-[11px] font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>{label}</p>
      <p className="text-lg font-semibold truncate" style={{ color: "var(--foreground)" }}>{value}</p>
      {sub && <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>{sub}</p>}
    </div>
  );
}
