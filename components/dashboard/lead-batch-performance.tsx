"use client";

import { useState } from "react";
import type { LeadBatchDimension, LeadBatchPerformance, LeadBatchRow } from "@/lib/actions/analytics";

const TABS: { key: LeadBatchDimension; label: string }[] = [
  { key: "source", label: "Source" },
  { key: "college", label: "College" },
  { key: "track", label: "Track" },
  { key: "passoutYear", label: "Passout Year" },
];

function pct(n: number | null): string {
  return n === null ? "—" : `${Math.round(n * 100)}%`;
}

export function LeadBatchPerformanceCard({ data }: { data: LeadBatchPerformance }) {
  const [dimension, setDimension] = useState<LeadBatchDimension>("source");
  const rows = data[dimension].slice(0, 12);
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "var(--card)", borderColor: "#1e3322" }}>
      <div className="flex items-center justify-between px-4 py-3 border-b flex-wrap gap-2" style={{ borderColor: "#1a2e1e" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Lead Batch Performance</h2>
        <div className="flex gap-1 rounded-lg p-0.5" style={{ background: "var(--secondary)" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setDimension(t.key)}
              className="text-xs px-2 py-1 rounded-md transition-colors"
              style={{
                background: dimension === t.key ? "var(--card)" : "transparent",
                color: dimension === t.key ? "var(--foreground)" : "var(--muted-foreground)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No leads yet</p>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: "#1a2e1e" }}>
          {rows.map((r) => (
            <BatchRow key={r.key} row={r} maxTotal={maxTotal} />
          ))}
        </div>
      )}
    </div>
  );
}

function BatchRow({ row, maxTotal }: { row: LeadBatchRow; maxTotal: number }) {
  const closed = row.won + row.lost;
  const conversionColor = row.conversionRate === null ? "var(--muted-foreground)" : row.conversionRate >= 0.5 ? "#059669" : row.conversionRate >= 0.2 ? "#f59e0b" : "#dc2626";

  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <span className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{row.label}</span>
        <div className="flex items-center gap-3 shrink-0 text-xs tabular-nums">
          <span style={{ color: "var(--muted-foreground)" }}>{row.total} leads</span>
          <span style={{ color: "#059669" }}>{row.won} won</span>
          <span style={{ color: "#dc2626" }}>{row.lost} lost</span>
          <span className="font-medium w-10 text-right" style={{ color: conversionColor }}>
            {closed ? pct(row.conversionRate) : "—"}
          </span>
        </div>
      </div>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--secondary)" }}>
        <div style={{ width: `${(row.total / maxTotal) * 100}%`, background: "var(--secondary)" }} className="relative h-full">
          <div className="flex h-full w-full overflow-hidden rounded-full">
            {row.won > 0 && <div style={{ width: `${(row.won / row.total) * 100}%`, background: "#059669" }} />}
            {row.lost > 0 && <div style={{ width: `${(row.lost / row.total) * 100}%`, background: "#dc2626" }} />}
            {row.hot > 0 && <div style={{ width: `${(row.hot / row.total) * 100}%`, background: "#f97316" }} />}
          </div>
        </div>
      </div>
    </div>
  );
}
