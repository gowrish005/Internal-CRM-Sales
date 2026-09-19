"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createUser, updateUserRole, toggleUserActive, deleteUser, changePassword } from "@/lib/actions/users";
import { getInitials } from "@/lib/utils";
import { X } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";

const TABS = ["Profile", "Users"] as const;

interface Props {
  user: any;
  users: any[];
}

export function SettingsClient({ user, users }: Props) {
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

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete ${name}? This permanently removes the user. Their leads, contacts and tasks become unassigned.`)) return;
    startTransition(async () => {
      try {
        await deleteUser(id);
        router.refresh();
      } catch (err: any) {
        alert("Error: " + err.message);
      }
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
        </div>
      )}

      {activeTab === "Profile" && <ChangePasswordCard />}

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
                  {["Name", "Email", "Role", "Status", "Actions"].map((h) => (
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
                    <td className="px-4 py-2.5">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: u.isActive ? "#05966915" : "#dc262615", color: u.isActive ? "#059669" : "#dc2626" }}>
                        {u.isActive ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {u.id !== user.id && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleToggleActive(u.id)}
                            className="text-xs px-2 py-0.5 rounded border"
                            style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                          >
                            {u.isActive ? "Disable" : "Enable"}
                          </button>
                          <button
                            onClick={() => handleDelete(u.id, u.name)}
                            className="text-xs px-2 py-0.5 rounded border"
                            style={{ borderColor: "rgba(220,38,38,0.4)", color: "#f87171" }}
                          >
                            Delete
                          </button>
                        </div>
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

    </div>
  );
}

function ChangePasswordCard() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (next !== confirm) { setMsg({ type: "err", text: "New passwords do not match" }); return; }
    if (next.length < 6) { setMsg({ type: "err", text: "New password must be at least 6 characters" }); return; }
    setSaving(true);
    try {
      await changePassword(current, next);
      setMsg({ type: "ok", text: "Password updated. Use it next time you log in." });
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err: any) {
      setMsg({ type: "err", text: err.message || "Failed to update password" });
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: "100%", border: "1px solid var(--border)", borderRadius: "var(--radius)",
    padding: "6px 10px", fontSize: 13, background: "var(--background)", color: "var(--foreground)", outline: "none",
  } as const;

  return (
    <div className="rounded-lg border p-5 space-y-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Change Password</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>Update your login password.</p>
        </div>
        <button
          type="button"
          onClick={() => { setOpen((v) => !v); setMsg(null); }}
          className="px-3 py-1.5 rounded-md text-sm font-medium"
          style={open
            ? { background: "var(--secondary)", color: "var(--foreground)" }
            : { background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          {open ? "Cancel" : "Change Password"}
        </button>
      </div>
      {open && (
      <form onSubmit={submit} className="space-y-3 max-w-sm">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Current password</label>
          <PasswordInput value={current} onChange={(e) => setCurrent(e.target.value)} required style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>New password</label>
          <PasswordInput value={next} onChange={(e) => setNext(e.target.value)} required minLength={6} style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Confirm new password</label>
          <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} style={inputStyle} />
        </div>
        {msg && (
          <p className="text-xs" style={{ color: msg.type === "ok" ? "#4ade80" : "#f87171" }}>{msg.text}</p>
        )}
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-60"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          {saving ? "Updating…" : "Update Password"}
        </button>
      </form>
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

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl border shadow-2xl" style={{ background: "#111e14", borderColor: "#1e3322" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#1e3322" }}>
          <h2 className="text-sm font-semibold" style={{ color: "#e8e8e8" }}>Add User</h2>
          <button onClick={onClose} style={{ color: "var(--muted-foreground)" }}><X size={18} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="p-5 space-y-3">
          <F label="Name" required><input value={form.name} onChange={(e) => set("name", e.target.value)} required className="fi" /></F>
          <F label="Email" required><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required className="fi" /></F>
          <F label="Password" required><PasswordInput value={form.password} onChange={(e) => set("password", e.target.value)} required minLength={6} className="fi" /></F>
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
    </div>,
    document.body
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
