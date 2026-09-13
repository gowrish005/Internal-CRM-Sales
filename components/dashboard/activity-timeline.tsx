"use client";

import { format, formatDistanceToNow } from "date-fns";
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

export function ActivityTimeline({ activities }: { activities: any[] }) {
  if (!activities.length) {
    return (
      <div className="text-center py-16 rounded-lg border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No activity yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
      {activities.map((a) => {
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
              title={format(new Date(a.createdAt), "MMM d, yyyy HH:mm")}
            >
              {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
            </span>
          </div>
        );
      })}
    </div>
  );
}
