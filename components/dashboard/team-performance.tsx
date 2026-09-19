import Link from "next/link";
import type { TeamPerformanceRow } from "@/lib/actions/analytics";

function pct(n: number | null): string {
  return n === null ? "—" : `${Math.round(n * 100)}%`;
}

export function TeamPerformance({ rows }: { rows: TeamPerformanceRow[] }) {
  const ranked = [...rows].sort((a, b) => {
    // Sort by conversion rate (employees with closed leads first), then by leads owned.
    if (a.conversionRate !== b.conversionRate) {
      if (a.conversionRate === null) return 1;
      if (b.conversionRate === null) return -1;
      return b.conversionRate - a.conversionRate;
    }
    return b.leadsOwned - a.leadsOwned;
  });

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "var(--card)", borderColor: "#1e3322" }}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#1a2e1e" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Team Performance</h2>
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Last 7 days for calls &amp; tasks</span>
      </div>

      {ranked.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No employees yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: "var(--muted-foreground)" }}>
                <th className="text-left font-medium px-4 py-2">Employee</th>
                <th className="text-right font-medium px-3 py-2">Leads</th>
                <th className="text-right font-medium px-3 py-2">Contacted</th>
                <th className="text-right font-medium px-3 py-2">Hot</th>
                <th className="text-right font-medium px-3 py-2">Won</th>
                <th className="text-right font-medium px-3 py-2">Lost</th>
                <th className="text-right font-medium px-3 py-2">Conversion</th>
                <th className="text-right font-medium px-3 py-2">Calls (7d)</th>
                <th className="text-right font-medium px-4 py-2">Overdue</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r, i) => (
                <tr key={r.id} className="border-t" style={{ borderColor: "#1a2e1e" }}>
                  <td className="px-4 py-2.5">
                    <Link href="/crm/leads" className="font-medium hover:underline" style={{ color: "var(--foreground)" }}>
                      {r.name}
                    </Link>
                    {i === 0 && r.conversionRate !== null && (
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#1a3020", color: "#22c55e" }}>
                        top
                      </span>
                    )}
                  </td>
                  <td className="text-right px-3 py-2.5 tabular-nums" style={{ color: "var(--foreground)" }}>{r.leadsOwned}</td>
                  <td className="text-right px-3 py-2.5 tabular-nums" style={{ color: "var(--muted-foreground)" }}>
                    {r.contacted} <span className="text-[10px]">({pct(r.contactedRate)})</span>
                  </td>
                  <td className="text-right px-3 py-2.5 tabular-nums" style={{ color: "#f97316" }}>{r.hot}</td>
                  <td className="text-right px-3 py-2.5 tabular-nums" style={{ color: "#059669" }}>{r.won}</td>
                  <td className="text-right px-3 py-2.5 tabular-nums" style={{ color: "#dc2626" }}>{r.lost}</td>
                  <td className="text-right px-3 py-2.5 tabular-nums font-medium" style={{ color: "var(--foreground)" }}>{pct(r.conversionRate)}</td>
                  <td className="text-right px-3 py-2.5 tabular-nums" style={{ color: "var(--muted-foreground)" }}>{r.callsLast7d}</td>
                  <td
                    className="text-right px-4 py-2.5 tabular-nums font-medium"
                    style={{ color: r.overdueFollowUps > 0 ? "#dc2626" : "var(--muted-foreground)" }}
                  >
                    {r.overdueFollowUps}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
