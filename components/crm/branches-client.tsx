"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Search, Eye, Trash2, GitBranch, Users, TrendingUp } from "lucide-react";
import { createBranch, archiveBranch } from "@/lib/actions/branches";

interface Props {
  branches: any[];
  users: any[];
}

export function BranchesClient({ branches: initial, users }: Props) {
  const [branches, setBranches] = useState(initial);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const filtered = branches.filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return b.name?.toLowerCase().includes(q) || b.code?.toLowerCase().includes(q) || b.location?.toLowerCase().includes(q);
  });

  async function handleCreate(data: any) {
    startTransition(async () => {
      try {
        await createBranch(data);
        router.refresh();
        setShowForm(false);
      } catch (err: any) {
        alert("Error: " + err.message);
      }
    });
  }

  async function handleArchive(id: string) {
    if (!confirm("Archive this branch?")) return;
    startTransition(async () => {
      await archiveBranch(id);
      setBranches((prev) => prev.filter((b) => b.id !== id));
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>Branches</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>{branches.length} branches</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          <Plus size={14} /> Add Branch
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search branches..."
          className="w-full rounded-md border pl-8 pr-3 py-1.5 text-sm outline-none"
          style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-lg border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>No branches yet</p>
          <p className="text-sm mt-1 mb-4" style={{ color: "var(--muted-foreground)" }}>Add your first branch to get started</p>
          <button onClick={() => setShowForm(true)} className="rounded-md px-3 py-1.5 text-sm font-medium" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
            Add Branch
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((b) => (
            <div key={b.id} className="rounded-lg border p-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: "var(--accent)" }}>
                    <GitBranch size={14} style={{ color: "var(--primary)" }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{b.name}</p>
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{b.code}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Link href={`/crm/branches/${b.id}`} className="p-1.5 rounded hover:bg-[var(--secondary)]" style={{ color: "var(--muted-foreground)" }}>
                    <Eye size={13} />
                  </Link>
                  <button onClick={() => handleArchive(b.id)} className="p-1.5 rounded hover:bg-[var(--secondary)]" style={{ color: "var(--muted-foreground)" }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {b.location && <p className="text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>{b.location}</p>}
              <div className="flex items-center gap-4 text-xs" style={{ color: "var(--muted-foreground)" }}>
                <span className="flex items-center gap-1"><Users size={12} />{b._count?.contacts || 0} contacts</span>
                <span className="flex items-center gap-1"><TrendingUp size={12} />{b._count?.leads || 0} leads</span>
              </div>
              {b.manager && <p className="text-xs mt-2" style={{ color: "var(--muted-foreground)" }}>Manager: {b.manager.name}</p>}
            </div>
          ))}
        </div>
      )}

      {showForm && <BranchForm users={users} onSubmit={handleCreate} onClose={() => setShowForm(false)} loading={isPending} />}
    </div>
  );
}

function BranchForm({ users, onSubmit, onClose, loading }: { users: any[]; onSubmit: (d: any) => void; onClose: () => void; loading?: boolean }) {
  const [form, setForm] = useState({ name: "", code: "", location: "", address: "", managerId: "", notes: "" });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="w-full max-w-md rounded-xl border shadow-xl" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Add Branch</h2>
          <button onClick={onClose} style={{ color: "var(--muted-foreground)", fontSize: 20 }}>×</button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...form, managerId: form.managerId || undefined }); }} className="p-5 space-y-3">
          <Field label="Branch Name" required><input value={form.name} onChange={(e) => set("name", e.target.value)} required className="fi" /></Field>
          <Field label="Branch Code" required><input value={form.code} onChange={(e) => set("code", e.target.value)} required className="fi" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Location"><input value={form.location} onChange={(e) => set("location", e.target.value)} className="fi" /></Field>
            <Field label="Manager">
              <select value={form.managerId} onChange={(e) => set("managerId", e.target.value)} className="fi">
                <option value="">None</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Address"><input value={form.address} onChange={(e) => set("address", e.target.value)} className="fi" /></Field>
          <Field label="Notes"><textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className="fi resize-none" /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-md text-sm" style={{ color: "var(--muted-foreground)", background: "var(--secondary)" }}>Cancel</button>
            <button type="submit" disabled={loading} className="px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-60" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
        <style>{`.fi{width:100%;border:1px solid var(--border);border-radius:var(--radius);padding:6px 10px;font-size:13px;background:var(--background);color:var(--foreground);outline:none}`}</style>
      </div>
    </div>
  );
}

function Field({ label, children, required }: any) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>{label}{required && " *"}</label>
      {children}
    </div>
  );
}
