"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUser, updateUserRole, toggleUserActive } from "@/lib/actions/users";
import { getInitials } from "@/lib/utils";
import { X } from "lucide-react";

const TABS = ["Profile", "Users", "Branches"] as const;

interface Props {
  user: any;
  users: any[];
  branches: any[];
}

export function SettingsClient({ user, users, branches }: Props) {
  const [activeTab, setActiveTab] = useState("Profile");
  const [showAddUser, setShowAddUser] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const isAdmin = user.role === "ADMIN";

  async function handleAddUser(data: any) {
    startTransition(async () => {
      try {
        await createUser(data);
        router.refresh();
        setShowAddUser(false);
      } catch (err: any) {
        alert("Error: " + err.message);
      }
    });
  }

  async function handleRoleChange(id: string, role: string) {
    startTransition(async () => {
      await updateUserRole(id, role);
      router.refresh();
    });
  }

  async function handleToggleActive(id: string) {
    startTransition(async () => {
      await toggleUserActive(id);
      router.refresh();
    });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>Settings</h1>
      </div>

      <div className="flex gap-1 border-b" style={{ borderColor: "var(--border)" }}>
        {TABS.filter((t) => t !== "Users" || isAdmin).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-3 py-2 text-sm"
            style={activeTab === tab ? { color: "var(--primary)", borderBottom: "2px solid var(--primary)", fontWeight: 500 } : { color: "var(--muted-foreground)" }}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Profile" && (
        <div className="rounded-lg border p-5 space-y-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center font-semibold text-lg"
              style={{ background: "var(--accent)", color: "var(--primary)" }}
            >
              {user.name ? getInitials(user.name) : "?"}
            </div>
            <div>
              <p className="font-medium" style={{ color: "var(--foreground)" }}>{user.name}</p>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{user.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Row label="Role" value={user.role} />
            <Row label="Email" value={user.email} />
          </div>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            Contact your admin to update profile information.
          </p>
        </div>
      )}

      {activeTab === "Users" && isAdmin && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddUser(true)}
              className="px-3 py-1.5 rounded-md text-sm font-medium"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              Add User
            </button>
          </div>
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
                  {["Name", "Email", "Role", "Branch", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ background: "var(--card)" }}>
                {users.map((u) => (
                  <tr key={u.id} className="border-b" style={{ borderColor: "var(--border)" }}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium" style={{ background: "var(--accent)", color: "var(--primary)" }}>
                          {getInitials(u.name)}
                        </div>
                        <span style={{ color: "var(--foreground)" }}>{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{u.email}</td>
                    <td className="px-4 py-2.5">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="border rounded px-1.5 py-0.5 text-xs outline-none"
                        style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                        disabled={u.id === user.id}
                      >
                        {["ADMIN","FOUNDER","EMPLOYEE"].map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{u.branch?.name || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: u.isActive ? "#05966915" : "#dc262615", color: u.isActive ? "#059669" : "#dc2626" }}>
                        {u.isActive ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {u.id !== user.id && (
                        <button
                          onClick={() => handleToggleActive(u.id)}
                          className="text-xs px-2 py-0.5 rounded border"
                          style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                        >
                          {u.isActive ? "Disable" : "Enable"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showAddUser && (
            <AddUserForm onSubmit={handleAddUser} onClose={() => setShowAddUser(false)} loading={isPending} />
          )}
        </div>
      )}

      {activeTab === "Branches" && (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
                {["Name", "Code", "Location", "Manager", "Users"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody style={{ background: "var(--card)" }}>
              {branches.map((b: any) => (
                <tr key={b.id} className="border-b" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-2.5 font-medium" style={{ color: "var(--foreground)" }}>{b.name}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{b.code}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{b.location || "—"}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{b.manager?.name || "—"}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{b._count?.users || b.users?.length || 0}</td>
                </tr>
              ))}
              {!branches.length && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>No branches yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{label}</p>
      <p className="font-medium" style={{ color: "var(--foreground)" }}>{value || "—"}</p>
    </div>
  );
}

function AddUserForm({ onSubmit, onClose, loading }: any) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "EMPLOYEE" });
  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="w-full max-w-sm rounded-xl border shadow-xl" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Add User</h2>
          <button onClick={onClose} style={{ color: "var(--muted-foreground)" }}><X size={18} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="p-5 space-y-3">
          <F label="Name" required><input value={form.name} onChange={(e) => set("name", e.target.value)} required className="fi" /></F>
          <F label="Email" required><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required className="fi" /></F>
          <F label="Password" required><input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} required minLength={6} className="fi" /></F>
          <F label="Role">
            <select value={form.role} onChange={(e) => set("role", e.target.value)} className="fi">
              {["ADMIN","FOUNDER","EMPLOYEE"].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </F>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-md text-sm" style={{ color: "var(--muted-foreground)", background: "var(--secondary)" }}>Cancel</button>
            <button type="submit" disabled={loading} className="px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-60" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
              {loading ? "Creating..." : "Create User"}
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
