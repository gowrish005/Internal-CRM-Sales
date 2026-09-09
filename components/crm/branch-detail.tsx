"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Users, TrendingUp, Calendar, CheckSquare, GitBranch } from "lucide-react";

const tabs = ["overview", "contacts", "leads", "meetings", "tasks", "notes"] as const;

export function BranchDetail({ branch }: { branch: any }) {
  const [active, setActive] = useState<(typeof tabs)[number]>("overview");

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <Link href="/crm/branches" className="flex items-center gap-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
        <ArrowLeft size={14} /> Back to Branches
      </Link>

      <div className="rounded-lg border p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--accent)" }}>
            <GitBranch size={18} style={{ color: "var(--primary)" }} />
          </div>
          <div>
            <h1 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>{branch.name}</h1>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{branch.code}{branch.location ? ` · ${branch.location}` : ""}</p>
          </div>
        </div>
        <div className="flex gap-6 mt-4 text-sm">
          <Stat icon={Users} label="Contacts" value={branch.contacts?.length || 0} />
          <Stat icon={TrendingUp} label="Leads" value={branch.leads?.length || 0} />
          <Stat icon={Calendar} label="Meetings" value={branch.meetings?.length || 0} />
          <Stat icon={CheckSquare} label="Tasks" value={branch.tasks?.length || 0} />
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex border-b overflow-x-auto" style={{ borderColor: "var(--border)" }}>
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setActive(t)}
              className="px-4 py-2.5 text-sm capitalize whitespace-nowrap"
              style={active === t ? { color: "var(--primary)", borderBottom: "2px solid var(--primary)", fontWeight: 500 } : { color: "var(--muted-foreground)" }}
            >
              {t}
            </button>
          ))}
        </div>

        <div>
          {active === "overview" && (
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <dl className="space-y-2">
                <Row label="Manager" value={branch.manager?.name} />
                <Row label="Location" value={branch.location} />
                <Row label="Address" value={branch.address} />
                <Row label="Team members" value={String(branch.users?.length || 0)} />
              </dl>
              {branch.notes && (
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Notes</p>
                  <p style={{ color: "var(--foreground)" }}>{branch.notes}</p>
                </div>
              )}
            </div>
          )}

          {active === "contacts" && (
            <TableList
              headers={["Name", "Designation", "Email", "Status"]}
              rows={branch.contacts?.map((c: any) => [
                <Link key="n" href={`/crm/contacts/${c.id}`} style={{ color: "var(--primary)" }}>{c.firstName} {c.lastName}</Link>,
                c.designation || "—",
                c.email || "—",
                c.leadStatus,
              ])}
              empty="No contacts in this branch"
            />
          )}

          {active === "leads" && (
            <TableList
              headers={["Name", "Status", "Priority", "Value"]}
              rows={branch.leads?.map((l: any) => [
                l.name,
                l.status,
                l.priority,
                l.estimatedValue ? `₹${l.estimatedValue.toLocaleString()}` : "—",
              ])}
              empty="No leads in this branch"
            />
          )}

          {active === "meetings" && (
            <TableList
              headers={["Title", "Type", "Date"]}
              rows={branch.meetings?.map((m: any) => [
                m.title,
                m.type,
                format(new Date(m.startAt), "MMM d, HH:mm"),
              ])}
              empty="No meetings for this branch"
            />
          )}

          {active === "tasks" && (
            <TableList
              headers={["Title", "Status", "Priority", "Due"]}
              rows={branch.tasks?.map((t: any) => [
                t.title,
                t.status,
                t.priority,
                t.dueAt ? format(new Date(t.dueAt), "MMM d") : "—",
              ])}
              empty="No tasks for this branch"
            />
          )}

          {active === "notes" && (
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {!branch.branchNotes?.length ? (
                <div className="py-8 text-center"><p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No notes yet</p></div>
              ) : branch.branchNotes.map((n: any) => (
                <div key={n.id} className="p-4">
                  <p className="text-sm" style={{ color: "var(--foreground)" }}>{n.content}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{n.author?.name} · {format(new Date(n.createdAt), "MMM d, yyyy")}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5" style={{ color: "var(--muted-foreground)" }}>
      <Icon size={14} />
      <span className="font-medium" style={{ color: "var(--foreground)" }}>{value}</span>
      <span>{label}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between">
      <dt style={{ color: "var(--muted-foreground)" }}>{label}</dt>
      <dd style={{ color: "var(--foreground)" }}>{value}</dd>
    </div>
  );
}

function TableList({ headers, rows, empty }: { headers: string[]; rows?: any[][]; empty: string }) {
  if (!rows?.length) {
    return <div className="py-8 text-center"><p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{empty}</p></div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
            {headers.map((h) => <th key={h} className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b" style={{ borderColor: "var(--border)" }}>
              {row.map((cell, j) => <td key={j} className="px-4 py-2.5 text-xs" style={{ color: "var(--foreground)" }}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
