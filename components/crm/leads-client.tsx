"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, LayoutGrid, List } from "lucide-react";
import { createLead, updateLeadStatus, archiveLead } from "@/lib/actions/leads";
import { formatCurrency } from "@/lib/utils";

const STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"] as const;
type Status = typeof STATUSES[number];

const STATUS_COLORS: Record<Status, string> = {
  NEW: "#6b7280", CONTACTED: "#3b82f6", QUALIFIED: "#10b981",
  PROPOSAL: "#8b5cf6", NEGOTIATION: "#f59e0b", WON: "#059669", LOST: "#dc2626",
};

const PRIORITY_COLORS: Record<string, string> = { LOW: "#6b7280", MEDIUM: "#f59e0b", HIGH: "#dc2626" };

interface Props {
  leads: any[];
  branches: any[];
  users: any[];
  contacts: any[];
}

export function LeadsClient({ leads: initial, branches, users, contacts }: Props) {
  const [leads, setLeads] = useState(initial);
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Status | null>(null);
  const router = useRouter();

  const byStatus = STATUSES.reduce((acc, s) => {
    acc[s] = leads.filter((l) => l.status === s);
    return acc;
  }, {} as Record<Status, any[]>);

  async function handleCreate(data: any) {
    startTransition(async () => {
      try {
        await createLead(data);
        router.refresh();
        setShowForm(false);
      } catch (err: any) {
        alert("Error: " + err.message);
      }
    });
  }

  async function handleDrop(status: Status) {
    if (!dragging || dragOver === null) return;
    const lead = leads.find((l) => l.id === dragging);
    if (!lead || lead.status === status) { setDragging(null); setDragOver(null); return; }
    setLeads((prev) => prev.map((l) => l.id === dragging ? { ...l, status } : l));
    startTransition(async () => {
      try {
        await updateLeadStatus(dragging, status);
      } catch {
        setLeads(initial);
      }
    });
    setDragging(null);
    setDragOver(null);
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>Leads</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>{leads.length} leads</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <button
              onClick={() => setView("kanban")}
              className="px-2.5 py-1.5"
              style={{ background: view === "kanban" ? "var(--secondary)" : "var(--card)", color: view === "kanban" ? "var(--foreground)" : "var(--muted-foreground)" }}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setView("table")}
              className="px-2.5 py-1.5 border-l"
              style={{ borderColor: "var(--border)", background: view === "table" ? "var(--secondary)" : "var(--card)", color: view === "table" ? "var(--foreground)" : "var(--muted-foreground)" }}
            >
              <List size={14} />
            </button>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            <Plus size={14} /> Add Lead
          </button>
        </div>
      </div>

      {view === "kanban" ? (
        <div className="flex gap-3 overflow-x-auto pb-4 flex-1">
          {STATUSES.map((status) => (
            <div
              key={status}
              className="flex flex-col rounded-lg border shrink-0 w-64"
              style={{
                borderColor: dragOver === status ? STATUS_COLORS[status] : "var(--border)",
                background: "var(--muted)",
                transition: "border-color 0.15s",
              }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(status); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(status)}
            >
              <div className="flex items-center justify-between px-3 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[status] }} />
                  <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>{status}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "var(--card)", color: "var(--muted-foreground)" }}>
                    {byStatus[status].length}
                  </span>
                </div>
              </div>
              <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px]">
                {byStatus[status].map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={() => setDragging(lead.id)}
                    onDragEnd={() => { setDragging(null); setDragOver(null); }}
                    className="rounded-md border p-3 cursor-grab active:cursor-grabbing"
                    style={{
                      background: "var(--card)",
                      borderColor: "var(--border)",
                      opacity: dragging === lead.id ? 0.5 : 1,
                    }}
                  >
                    <p className="text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>{lead.name}</p>
                    {lead.branch && <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{lead.branch.name}</p>}
                    {lead.contact && <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{lead.contact.firstName} {lead.contact.lastName}</p>}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-medium" style={{ color: PRIORITY_COLORS[lead.priority] }}>{lead.priority}</span>
                      {lead.estimatedValue && <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>{formatCurrency(lead.estimatedValue)}</span>}
                    </div>
                    {lead.owner && <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{lead.owner.name}</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
                  {["Name", "Branch", "Contact", "Owner", "Status", "Priority", "Value", "Follow-up"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ background: "var(--card)" }}>
                {leads.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>No leads yet</td></tr>
                ) : leads.map((l) => (
                  <tr key={l.id} className="border-b hover:bg-[var(--muted)]" style={{ borderColor: "var(--border)" }}>
                    <td className="px-4 py-2.5 font-medium" style={{ color: "var(--foreground)" }}>{l.name}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{l.branch?.name || "—"}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{l.contact ? `${l.contact.firstName} ${l.contact.lastName}` : "—"}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{l.owner?.name || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${STATUS_COLORS[l.status as Status]}15`, color: STATUS_COLORS[l.status as Status] }}>
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium" style={{ color: PRIORITY_COLORS[l.priority] }}>{l.priority}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--foreground)" }}>{l.estimatedValue ? formatCurrency(l.estimatedValue) : "—"}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{l.nextFollowUpAt ? new Date(l.nextFollowUpAt).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <LeadForm branches={branches} users={users} contacts={contacts} onSubmit={handleCreate} onClose={() => setShowForm(false)} loading={isPending} />
      )}
    </div>
  );
}

function LeadForm({ branches, users, contacts, onSubmit, onClose, loading }: any) {
  const [form, setForm] = useState({
    name: "", branchId: "", contactId: "", ownerId: "", source: "", status: "NEW",
    priority: "MEDIUM", estimatedValue: "", expectedCloseAt: "", nextFollowUpAt: "",
  });
  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="w-full max-w-md rounded-xl border shadow-xl" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Add Lead</h2>
          <button onClick={onClose} style={{ color: "var(--muted-foreground)", fontSize: 20 }}>×</button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...form, estimatedValue: form.estimatedValue ? parseFloat(form.estimatedValue) : undefined, branchId: form.branchId || undefined, contactId: form.contactId || undefined, ownerId: form.ownerId || undefined, source: form.source || undefined, expectedCloseAt: form.expectedCloseAt || undefined, nextFollowUpAt: form.nextFollowUpAt || undefined }); }} className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          <F label="Lead Name" required><input value={form.name} onChange={(e) => set("name", e.target.value)} required className="fi" /></F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Branch"><select value={form.branchId} onChange={(e) => set("branchId", e.target.value)} className="fi"><option value="">None</option>{branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></F>
            <F label="Contact"><select value={form.contactId} onChange={(e) => set("contactId", e.target.value)} className="fi"><option value="">None</option>{contacts.map((c: any) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}</select></F>
            <F label="Owner"><select value={form.ownerId} onChange={(e) => set("ownerId", e.target.value)} className="fi"><option value="">None</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></F>
            <F label="Source"><select value={form.source} onChange={(e) => set("source", e.target.value)} className="fi"><option value="">None</option>{["REFERRAL","WEBSITE","COLD_OUTREACH","EVENT","SOCIAL_MEDIA","OTHER"].map((s) => <option key={s} value={s}>{s.replace("_"," ")}</option>)}</select></F>
            <F label="Status"><select value={form.status} onChange={(e) => set("status", e.target.value)} className="fi">{["NEW","CONTACTED","QUALIFIED","PROPOSAL","NEGOTIATION","WON","LOST"].map((s) => <option key={s} value={s}>{s}</option>)}</select></F>
            <F label="Priority"><select value={form.priority} onChange={(e) => set("priority", e.target.value)} className="fi">{["LOW","MEDIUM","HIGH"].map((p) => <option key={p} value={p}>{p}</option>)}</select></F>
            <F label="Est. Value (₹)"><input type="number" value={form.estimatedValue} onChange={(e) => set("estimatedValue", e.target.value)} className="fi" placeholder="0" /></F>
            <F label="Expected Close"><input type="date" value={form.expectedCloseAt} onChange={(e) => set("expectedCloseAt", e.target.value)} className="fi" /></F>
          </div>
          <F label="Next Follow-up"><input type="date" value={form.nextFollowUpAt} onChange={(e) => set("nextFollowUpAt", e.target.value)} className="fi" /></F>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-md text-sm" style={{ color: "var(--muted-foreground)", background: "var(--secondary)" }}>Cancel</button>
            <button type="submit" disabled={loading} className="px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-60" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
              {loading ? "Creating..." : "Create Lead"}
            </button>
          </div>
        </form>
        <style>{`.fi{width:100%;border:1px solid var(--border);border-radius:var(--radius);padding:6px 10px;font-size:13px;background:var(--background);color:var(--foreground);outline:none}`}</style>
      </div>
    </div>
  );
}

function F({ label, children, required }: any) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>{label}{required && " *"}</label>
      {children}
    </div>
  );
}
