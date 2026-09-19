import { LEAD_STATUSES, LEAD_STATUS_COLORS, LEAD_STATUS_LABELS } from "@/lib/lead-status";
import type { PipelineFunnel } from "@/lib/actions/analytics";

export function PipelineFunnelBar({ funnel }: { funnel: PipelineFunnel }) {
  const total = LEAD_STATUSES.reduce((sum, s) => sum + funnel[s], 0);

  return (
    <div className="rounded-xl border p-4" style={{ background: "var(--card)", borderColor: "#1e3322" }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Lead Pipeline</h2>
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{total} active leads</span>
      </div>

      {total === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No leads yet</p>
      ) : (
        <>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: "var(--secondary)" }}>
            {LEAD_STATUSES.map((s) => {
              const count = funnel[s];
              if (!count) return null;
              return (
                <div
                  key={s}
                  title={`${LEAD_STATUS_LABELS[s]}: ${count}`}
                  style={{ width: `${(count / total) * 100}%`, background: LEAD_STATUS_COLORS[s] }}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
            {LEAD_STATUSES.map((s) => (
              <div key={s} className="flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: LEAD_STATUS_COLORS[s] }} />
                <span style={{ color: "var(--muted-foreground)" }}>{LEAD_STATUS_LABELS[s]}</span>
                <span className="font-medium tabular-nums" style={{ color: "var(--foreground)" }}>{funnel[s]}</span>
                <span style={{ color: "var(--muted-foreground)" }}>
                  ({total ? Math.round((funnel[s] / total) * 100) : 0}%)
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
