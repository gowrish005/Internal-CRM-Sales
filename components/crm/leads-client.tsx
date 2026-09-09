"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, LayoutGrid, List, Upload, Divide, X, Edit2 } from "lucide-react";
import { createLead, updateLeadStatus, updateLead, archiveLead, divideLeads, importLeadsFromCSV } from "@/lib/actions/leads";
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
  const [editingLead, setEditingLead] = useState<any>(null);
  const [showDivide, setShowDivide] = useState(false);
  const [showCSV, setShowCSV] = useState(false);
  const [trackFilter, setTrackFilter] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Status | null>(null);
  const router = useRouter();

  const displayed = trackFilter ? leads.filter((l) => l.track === trackFilter) : leads;
  const byStatus = STATUSES.reduce((acc, s) => {
    acc[s] = displayed.filter((l) => l.status === s);
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

  async function handleUpdate(id: string, data: any) {
    startTransition(async () => {
      try {
        const updated = await updateLead(id, data);
        setLeads((prev) => prev.map((l) => l.id === id ? { ...l, ...updated } : l));
        setEditingLead(null);
        router.refresh();
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

  async function handleDivide(userIds: string[]) {
    startTransition(async () => {
      try {
        const result = await divideLeads(userIds);
        alert(`Done. ${result.assigned} leads divided — ~${result.perUser} per user.`);
        router.refresh();
        setShowDivide(false);
      } catch (err: any) {
        alert("Error: " + err.message);
      }
    });
  }

  async function handleCSVImport(rows: any[]) {
    startTransition(async () => {
      try {
        const result = await importLeadsFromCSV(rows);
        alert(`Imported ${result.imported} leads.`);
        router.refresh();
        setShowCSV(false);
      } catch (err: any) {
        alert("Error: " + err.message);
      }
    });
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>Leads</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>{displayed.length} leads{trackFilter ? ` · Track ${trackFilter}` : ""}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Track filter */}
          <div className="flex rounded-md border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <button
              onClick={() => setTrackFilter(null)}
              className="px-2.5 py-1.5 text-xs"
              style={{ background: !trackFilter ? "var(--secondary)" : "var(--card)", color: !trackFilter ? "var(--foreground)" : "var(--muted-foreground)" }}
            >All</button>
            {[1, 2, 3].map((t) => (
              <button
                key={t}
                onClick={() => setTrackFilter(trackFilter === t ? null : t)}
                className="px-2.5 py-1.5 text-xs border-l"
                style={{ borderColor: "var(--border)", background: trackFilter === t ? "var(--secondary)" : "var(--card)", color: trackFilter === t ? "var(--foreground)" : "var(--muted-foreground)" }}
              >
                T{t}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex rounded-md border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <button onClick={() => setView("kanban")} className="px-2.5 py-1.5" style={{ background: view === "kanban" ? "var(--secondary)" : "var(--card)", color: view === "kanban" ? "var(--foreground)" : "var(--muted-foreground)" }}>
              <LayoutGrid size={14} />
            </button>
            <button onClick={() => setView("table")} className="px-2.5 py-1.5 border-l" style={{ borderColor: "var(--border)", background: view === "table" ? "var(--secondary)" : "var(--card)", color: view === "table" ? "var(--foreground)" : "var(--muted-foreground)" }}>
              <List size={14} />
            </button>
          </div>

          <button onClick={() => setShowCSV(true)} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs border" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)", background: "var(--card)" }}>
            <Upload size={13} /> Import CSV
          </button>
          <button onClick={() => setShowDivide(true)} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs border" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)", background: "var(--card)" }}>
            <Divide size={13} /> Divide
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
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
              style={{ borderColor: dragOver === status ? STATUS_COLORS[status] : "var(--border)", background: "var(--muted)", transition: "border-color 0.15s" }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(status); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(status)}
            >
              <div className="flex items-center justify-between px-3 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[status] }} />
                  <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>{status}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "var(--card)", color: "var(--muted-foreground)" }}>{byStatus[status].length}</span>
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
                    style={{ background: "var(--card)", borderColor: "var(--border)", opacity: dragging === lead.id ? 0.5 : 1 }}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-sm font-medium mb-1 flex-1" style={{ color: "var(--foreground)" }}>{lead.name}</p>
                      <button
                        onClick={() => setEditingLead(lead)}
                        className="shrink-0 p-0.5 rounded hover:bg-[var(--secondary)]"
                        style={{ color: "var(--muted-foreground)" }}
                        title="Edit"
                      >
                        <Edit2 size={11} />
                      </button>
                    </div>
                    {lead.contact && <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{lead.contact.firstName} {lead.contact.lastName}</p>}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium" style={{ color: PRIORITY_COLORS[lead.priority] }}>{lead.priority}</span>
                        {lead.track && <span className="text-xs px-1 py-0.5 rounded" style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>T{lead.track}</span>}
                      </div>
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
                  {["Name", "Contact", "Owner", "Track", "Status", "Priority", "Value", "Follow-up", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ background: "var(--card)" }}>
                {displayed.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>No leads yet</td></tr>
                ) : displayed.map((l) => (
                  <tr key={l.id} className="border-b hover:bg-[var(--muted)]" style={{ borderColor: "var(--border)" }}>
                    <td className="px-4 py-2.5 font-medium" style={{ color: "var(--foreground)" }}>{l.name}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{l.contact ? `${l.contact.firstName} ${l.contact.lastName}` : "—"}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{l.owner?.name || "—"}</td>
                    <td className="px-4 py-2.5 text-xs">
                      {l.track ? <span className="px-1.5 py-0.5 rounded" style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>T{l.track}</span> : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${STATUS_COLORS[l.status as Status]}15`, color: STATUS_COLORS[l.status as Status] }}>
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium" style={{ color: PRIORITY_COLORS[l.priority] }}>{l.priority}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--foreground)" }}>{l.estimatedValue ? formatCurrency(l.estimatedValue) : "—"}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{l.nextFollowUpAt ? new Date(l.nextFollowUpAt).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => setEditingLead(l)} className="p-1 rounded hover:bg-[var(--secondary)]" style={{ color: "var(--muted-foreground)" }} title="Edit">
                        <Edit2 size={13} />
                      </button>
                    </td>
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

      {editingLead && (
        <LeadEditModal lead={editingLead} users={users} contacts={contacts} onSubmit={(data: any) => handleUpdate(editingLead.id, data)} onClose={() => setEditingLead(null)} loading={isPending} />
      )}

      {showDivide && (
        <DivideModal users={users} totalLeads={leads.length} onSubmit={handleDivide} onClose={() => setShowDivide(false)} loading={isPending} />
      )}

      {showCSV && (
        <CSVImportModal users={users} onSubmit={handleCSVImport} onClose={() => setShowCSV(false)} loading={isPending} />
      )}
    </div>
  );
}

function LeadForm({ branches, users, contacts, onSubmit, onClose, loading }: any) {
  const [form, setForm] = useState({
    name: "", contactId: "", ownerId: "", source: "", status: "NEW",
    priority: "MEDIUM", track: "", estimatedValue: "", expectedCloseAt: "", nextFollowUpAt: "",
  });
  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <Modal title="Add Lead" onClose={onClose}>
      <form onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          ...form,
          estimatedValue: form.estimatedValue ? parseFloat(form.estimatedValue) : undefined,
          track: form.track ? parseInt(form.track) : undefined,
          contactId: form.contactId || undefined,
          ownerId: form.ownerId || undefined,
          source: form.source || undefined,
          expectedCloseAt: form.expectedCloseAt || undefined,
          nextFollowUpAt: form.nextFollowUpAt || undefined,
        });
      }} className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
        <F label="Lead Name" required><input value={form.name} onChange={(e) => set("name", e.target.value)} required className="fi" /></F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Contact"><select value={form.contactId} onChange={(e) => set("contactId", e.target.value)} className="fi"><option value="">None</option>{contacts.map((c: any) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}</select></F>
          <F label="Owner"><select value={form.ownerId} onChange={(e) => set("ownerId", e.target.value)} className="fi"><option value="">None</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></F>
          <F label="Source"><select value={form.source} onChange={(e) => set("source", e.target.value)} className="fi"><option value="">None</option>{["REFERRAL","WEBSITE","COLD_OUTREACH","EVENT","SOCIAL_MEDIA","OTHER"].map((s) => <option key={s} value={s}>{s.replace("_"," ")}</option>)}</select></F>
          <F label="Track"><select value={form.track} onChange={(e) => set("track", e.target.value)} className="fi"><option value="">None</option><option value="1">Track 1</option><option value="2">Track 2</option><option value="3">Track 3</option></select></F>
          <F label="Status"><select value={form.status} onChange={(e) => set("status", e.target.value)} className="fi">{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></F>
          <F label="Priority"><select value={form.priority} onChange={(e) => set("priority", e.target.value)} className="fi">{["LOW","MEDIUM","HIGH"].map((p) => <option key={p} value={p}>{p}</option>)}</select></F>
          <F label="Est. Value (₹)"><input type="number" value={form.estimatedValue} onChange={(e) => set("estimatedValue", e.target.value)} className="fi" placeholder="0" /></F>
          <F label="Expected Close"><input type="date" value={form.expectedCloseAt} onChange={(e) => set("expectedCloseAt", e.target.value)} className="fi" /></F>
        </div>
        <F label="Next Follow-up"><input type="date" value={form.nextFollowUpAt} onChange={(e) => set("nextFollowUpAt", e.target.value)} className="fi" /></F>
        <ModalActions onClose={onClose} loading={loading} submitLabel="Create Lead" />
      </form>
      <FiStyle />
    </Modal>
  );
}

function LeadEditModal({ lead, users, contacts, onSubmit, onClose, loading }: any) {
  const [form, setForm] = useState({
    name: lead.name || "",
    contactId: lead.contactId || "",
    ownerId: lead.ownerId || "",
    source: lead.source || "",
    status: lead.status || "NEW",
    priority: lead.priority || "MEDIUM",
    track: lead.track ? String(lead.track) : "",
    estimatedValue: lead.estimatedValue ? String(lead.estimatedValue) : "",
    nextFollowUpAt: lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toISOString().slice(0,10) : "",
  });
  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <Modal title="Edit Lead" onClose={onClose}>
      <form onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name: form.name,
          ownerId: form.ownerId || undefined,
          contactId: form.contactId || undefined,
          source: form.source || undefined,
          status: form.status,
          priority: form.priority,
          track: form.track ? parseInt(form.track) : undefined,
          estimatedValue: form.estimatedValue ? parseFloat(form.estimatedValue) : undefined,
          nextFollowUpAt: form.nextFollowUpAt || undefined,
        });
      }} className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
        <F label="Lead Name" required><input value={form.name} onChange={(e) => set("name", e.target.value)} required className="fi" /></F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Contact"><select value={form.contactId} onChange={(e) => set("contactId", e.target.value)} className="fi"><option value="">None</option>{contacts.map((c: any) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}</select></F>
          <F label="Owner (Assigned To)"><select value={form.ownerId} onChange={(e) => set("ownerId", e.target.value)} className="fi"><option value="">None</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></F>
          <F label="Status"><select value={form.status} onChange={(e) => set("status", e.target.value)} className="fi">{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></F>
          <F label="Priority"><select value={form.priority} onChange={(e) => set("priority", e.target.value)} className="fi">{["LOW","MEDIUM","HIGH"].map((p) => <option key={p} value={p}>{p}</option>)}</select></F>
          <F label="Track"><select value={form.track} onChange={(e) => set("track", e.target.value)} className="fi"><option value="">None</option><option value="1">Track 1</option><option value="2">Track 2</option><option value="3">Track 3</option></select></F>
          <F label="Est. Value (₹)"><input type="number" value={form.estimatedValue} onChange={(e) => set("estimatedValue", e.target.value)} className="fi" placeholder="0" /></F>
        </div>
        <F label="Next Follow-up"><input type="date" value={form.nextFollowUpAt} onChange={(e) => set("nextFollowUpAt", e.target.value)} className="fi" /></F>
        <ModalActions onClose={onClose} loading={loading} submitLabel="Save Changes" />
      </form>
      <FiStyle />
    </Modal>
  );
}

function DivideModal({ users, totalLeads, onSubmit, onClose, loading }: any) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const perUser = selectedUsers.length > 0 ? Math.ceil(totalLeads / selectedUsers.length) : 0;

  function toggle(id: string) {
    setSelectedUsers((prev) => prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]);
  }

  return (
    <Modal title="Divide Leads" onClose={onClose}>
      <div className="p-5 space-y-4">
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          {totalLeads} total leads. Select users to divide them evenly.
        </p>
        <div className="space-y-2 max-h-52 overflow-y-auto">
          {users.map((u: any) => (
            <label key={u.id} className="flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-[var(--secondary)]">
              <input type="checkbox" checked={selectedUsers.includes(u.id)} onChange={() => toggle(u.id)} />
              <span className="text-sm" style={{ color: "var(--foreground)" }}>{u.name}</span>
              <span className="text-xs ml-auto" style={{ color: "var(--muted-foreground)" }}>{u.role}</span>
            </label>
          ))}
        </div>
        {selectedUsers.length > 0 && (
          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            ~{perUser} leads per user ({selectedUsers.length} users)
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-md text-sm" style={{ color: "var(--muted-foreground)", background: "var(--secondary)" }}>Cancel</button>
          <button
            onClick={() => onSubmit(selectedUsers)}
            disabled={loading || selectedUsers.length === 0}
            className="px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            {loading ? "Dividing..." : "Divide Leads"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CSVImportModal({ users, onSubmit, onClose, loading }: any) {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [defaultOwner, setDefaultOwner] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function parseCSV(text: string) {
    const lines = text.trim().split("\n");
    if (lines.length < 2) { setError("CSV must have a header row and at least one data row"); return; }
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
    const parsed = lines.slice(1).map((line) => {
      const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
      return {
        name: obj.name || obj.lead_name || obj.company || "",
        status: obj.status || "NEW",
        priority: obj.priority || "MEDIUM",
        track: obj.track ? parseInt(obj.track) : undefined,
        estimatedValue: obj.estimated_value || obj.value ? parseFloat(obj.estimated_value || obj.value) : undefined,
        source: obj.source || undefined,
      };
    }).filter((r) => r.name);
    if (!parsed.length) { setError("No valid rows found. Make sure CSV has a 'name' column."); return; }
    setError("");
    setRows(parsed);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => parseCSV(ev.target?.result as string);
    reader.readAsText(file);
  }

  function handleImport() {
    const withOwner = rows.map((r) => ({ ...r, ownerId: defaultOwner || undefined }));
    onSubmit(withOwner);
  }

  return (
    <Modal title="Import Leads from CSV" onClose={onClose}>
      <div className="p-5 space-y-4">
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          CSV columns: <code>name</code> (required), <code>status</code>, <code>priority</code>, <code>track</code>, <code>estimated_value</code>, <code>source</code>
        </p>
        <div
          className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer"
          style={{ borderColor: "var(--border)" }}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={20} className="mx-auto mb-2" style={{ color: "var(--muted-foreground)" }} />
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Click to select CSV file</p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onFile} />
        </div>
        {error && <p className="text-xs" style={{ color: "var(--destructive)" }}>{error}</p>}
        {rows.length > 0 && (
          <>
            <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{rows.length} leads ready to import</p>
            <div className="rounded border overflow-hidden max-h-40 overflow-y-auto" style={{ borderColor: "var(--border)" }}>
              {rows.slice(0, 8).map((r, i) => (
                <div key={i} className="px-3 py-1.5 text-xs border-b last:border-b-0 flex items-center gap-3" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
                  <span className="flex-1 font-medium">{r.name}</span>
                  <span style={{ color: "var(--muted-foreground)" }}>{r.status}</span>
                  {r.track && <span style={{ color: "var(--muted-foreground)" }}>T{r.track}</span>}
                </div>
              ))}
              {rows.length > 8 && <p className="px-3 py-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>+{rows.length - 8} more</p>}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Assign all to (optional)</label>
              <select value={defaultOwner} onChange={(e) => setDefaultOwner(e.target.value)} className="fi" style={{ width: "100%", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "6px 10px", fontSize: "13px", background: "var(--background)", color: "var(--foreground)", outline: "none" }}>
                <option value="">Unassigned</option>
                {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-md text-sm" style={{ color: "var(--muted-foreground)", background: "var(--secondary)" }}>Cancel</button>
          <button
            onClick={handleImport}
            disabled={loading || !rows.length}
            className="px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            {loading ? "Importing..." : `Import ${rows.length} Leads`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="w-full max-w-md rounded-xl border shadow-xl" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{title}</h2>
          <button onClick={onClose} style={{ color: "var(--muted-foreground)", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ onClose, loading, submitLabel }: { onClose: () => void; loading: boolean; submitLabel: string }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-md text-sm" style={{ color: "var(--muted-foreground)", background: "var(--secondary)" }}>Cancel</button>
      <button type="submit" disabled={loading} className="px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-60" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
        {loading ? "Saving..." : submitLabel}
      </button>
    </div>
  );
}

function FiStyle() {
  return <style>{`.fi{width:100%;border:1px solid var(--border);border-radius:var(--radius);padding:6px 10px;font-size:13px;background:var(--background);color:var(--foreground);outline:none}input[type="date"]::-webkit-calendar-picker-indicator{filter:brightness(0) invert(1);opacity:0.5;cursor:pointer}`}</style>;
}

function F({ label, children, required }: any) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>{label}{required && " *"}</label>
      {children}
    </div>
  );
}
