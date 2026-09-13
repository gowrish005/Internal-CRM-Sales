"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { format, isPast, isToday } from "date-fns";
import { Plus, CheckCircle, Circle, X } from "lucide-react";
import { createTask, updateTask, archiveTask } from "@/lib/actions/tasks";

const VIEWS = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "overdue", label: "Overdue" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
] as const;

const PRIORITY_COLORS: Record<string, string> = { LOW: "#6b7280", MEDIUM: "#f59e0b", HIGH: "#dc2626" };
const STATUS_COLORS: Record<string, string> = { TODO: "#6b7280", IN_PROGRESS: "#3b82f6", COMPLETED: "#059669" };

interface Props {
  tasks: any[];
  users: any[];
  contacts: any[];
  leads: any[];
  currentUserId?: string;
}

export function TasksClient({ tasks: initial, users, contacts, leads, currentUserId }: Props) {
  const [tasks, setTasks] = useState(initial);
  const [activeView, setActiveView] = useState("all");
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);

  function filterTasks(t: any) {
    if (activeView === "today") return t.dueAt && new Date(t.dueAt) >= today && new Date(t.dueAt) < tomorrow && t.status !== "COMPLETED";
    if (activeView === "overdue") return t.dueAt && new Date(t.dueAt) < today && t.status !== "COMPLETED";
    if (activeView === "upcoming") return t.dueAt && new Date(t.dueAt) >= tomorrow && t.status !== "COMPLETED";
    if (activeView === "completed") return t.status === "COMPLETED";
    return true;
  }

  const filtered = tasks.filter(filterTasks).filter((t) => !myTasksOnly || t.ownerId === currentUserId);

  async function handleCreate(data: any) {
    const { ownerIds, ...rest } = data;
    startTransition(async () => {
      try {
        if (Array.isArray(ownerIds) && ownerIds.length > 0) {
          // One task per selected assignee — each gets their own notification
          await Promise.all(ownerIds.map((ownerId: string) => createTask({ ...rest, ownerId })));
        } else {
          await createTask({ ...rest, ownerId: undefined });
        }
        router.refresh();
        setShowForm(false);
      } catch (err: any) {
        alert("Error: " + err.message);
      }
    });
  }

  async function toggleComplete(task: any) {
    const newStatus = task.status === "COMPLETED" ? "TODO" : "COMPLETED";
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: newStatus } : t));
    startTransition(async () => {
      try {
        await updateTask(task.id, { status: newStatus });
      } catch {
        setTasks(initial);
      }
    });
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>Tasks</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>{filtered.length} tasks</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          <Plus size={14} /> Add Task
        </button>
      </div>

      {/* View tabs */}
      <div className="flex items-center justify-between border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex gap-1">
          {VIEWS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveView(key)}
              className="px-3 py-2 text-sm"
              style={activeView === key
                ? { color: "var(--primary)", borderBottom: "2px solid var(--primary)", fontWeight: 500 }
                : { color: "var(--muted-foreground)" }
              }
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setMyTasksOnly((v) => !v)}
          className="flex items-center gap-2 pr-1 pb-1 cursor-pointer select-none"
          style={{ background: "none", border: "none", padding: 0 }}
        >
          {/* Toggle pill */}
          <span
            className="relative inline-flex items-center shrink-0 transition-colors duration-200"
            style={{
              width: 32, height: 18, borderRadius: 9,
              background: myTasksOnly ? "rgba(34,197,94,0.85)" : "rgba(255,255,255,0.08)",
              border: myTasksOnly ? "1px solid rgba(34,197,94,0.6)" : "1px solid rgba(255,255,255,0.12)",
              boxShadow: myTasksOnly ? "0 0 8px rgba(34,197,94,0.3)" : "none",
            }}
          >
            <span
              className="absolute transition-all duration-200"
              style={{
                width: 12, height: 12, borderRadius: "50%",
                background: myTasksOnly ? "#fff" : "rgba(255,255,255,0.4)",
                left: myTasksOnly ? 17 : 3,
                boxShadow: myTasksOnly ? "0 1px 3px rgba(0,0,0,0.3)" : "none",
              }}
            />
          </span>
          <span className="text-xs font-medium" style={{ color: myTasksOnly ? "#4ade80" : "var(--muted-foreground)" }}>My Tasks</span>
        </button>
      </div>

      {/* Task list */}
      <div className="rounded-lg border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No tasks in this view</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {filtered.map((task) => {
              const overdue = task.dueAt && isPast(new Date(task.dueAt)) && task.status !== "COMPLETED";
              return (
                <div key={task.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--muted)]">
                  <button
                    onClick={() => toggleComplete(task)}
                    className="mt-0.5 shrink-0"
                    style={{ color: task.status === "COMPLETED" ? "#059669" : "var(--muted-foreground)" }}
                  >
                    {task.status === "COMPLETED" ? <CheckCircle size={17} /> : <Circle size={17} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm"
                      style={{
                        color: "var(--foreground)",
                        textDecoration: task.status === "COMPLETED" ? "line-through" : "none",
                        opacity: task.status === "COMPLETED" ? 0.6 : 1,
                      }}
                    >
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {task.dueAt && (
                        <span className="text-xs" style={{ color: overdue ? "#dc2626" : "var(--muted-foreground)" }}>
                          {overdue ? "Overdue · " : ""}{format(new Date(task.dueAt), "MMM d")}
                        </span>
                      )}
                      <span className="text-xs font-medium" style={{ color: PRIORITY_COLORS[task.priority] }}>{task.priority}</span>
                      {task.owner && <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{task.owner.name}</span>}
                      {task.contact && <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{task.contact.firstName} {task.contact.lastName}</span>}
                    </div>
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: `${STATUS_COLORS[task.status]}15`, color: STATUS_COLORS[task.status] }}
                  >
                    {task.status.replace("_", " ")}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showForm && (
        <TaskForm users={users} contacts={contacts} leads={leads} onSubmit={handleCreate} onClose={() => setShowForm(false)} loading={isPending} />
      )}
    </div>
  );
}

function TaskForm({ users, contacts, leads, onSubmit, onClose, loading }: any) {
  const [form, setForm] = useState({
    title: "", description: "", priority: "MEDIUM",
    status: "TODO", dueAt: "", contactId: "", leadId: "",
  });
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const toggleOwner = (id: string) =>
    setOwnerIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ background: "#111e14", borderColor: "#1e3322" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0" style={{ borderColor: "#1e3322", background: "#111e14" }}>
          <h2 className="text-sm font-semibold" style={{ color: "#e8e8e8" }}>Add Task</h2>
          <button onClick={onClose} style={{ color: "var(--muted-foreground)" }}><X size={18} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...form, ownerIds, contactId: form.contactId || undefined, leadId: form.leadId || undefined, dueAt: form.dueAt || undefined }); }} className="p-5 space-y-3">
          <F label="Title" required><input value={form.title} onChange={(e) => set("title", e.target.value)} required className="fi" /></F>

          {/* Assign to — multi-select */}
          <F label={`Assign to${ownerIds.length > 0 ? ` (${ownerIds.length})` : ""}`}>
            <div className="flex flex-wrap gap-1.5">
              {(() => {
                const allOn = users.length > 0 && ownerIds.length === users.length;
                return (
                  <button
                    type="button"
                    onClick={() => setOwnerIds(allOn ? [] : users.map((u: any) => u.id))}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: allOn ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.04)",
                      color: allOn ? "#4ade80" : "rgba(200,200,200,0.7)",
                      border: `1px solid ${allOn ? "rgba(34,197,94,0.5)" : "rgba(255,255,255,0.12)"}`,
                    }}
                  >
                    {allOn ? "✓ All" : "All"}
                  </button>
                );
              })()}
              {users.map((u: any) => {
                const on = ownerIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleOwner(u.id)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: on ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.04)",
                      color: on ? "#4ade80" : "rgba(200,200,200,0.6)",
                      border: `1px solid ${on ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    {on ? "✓ " : ""}{u.name}
                  </button>
                );
              })}
            </div>
          </F>

          <div className="grid grid-cols-2 gap-3">
            <F label="Priority"><select value={form.priority} onChange={(e) => set("priority", e.target.value)} className="fi">{["LOW","MEDIUM","HIGH"].map((p) => <option key={p} value={p}>{p}</option>)}</select></F>
            <F label="Due Date"><input type="date" min={todayStr} value={form.dueAt} onChange={(e) => set("dueAt", e.target.value)} className="fi" /></F>
            <F label="Contact"><select value={form.contactId} onChange={(e) => set("contactId", e.target.value)} className="fi"><option value="">None</option>{contacts.map((c: any) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}</select></F>
            <F label="Lead"><select value={form.leadId} onChange={(e) => set("leadId", e.target.value)} className="fi"><option value="">None</option>{leads.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></F>
          </div>
          <F label="Description"><textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} className="fi resize-none" /></F>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-md text-sm" style={{ color: "var(--muted-foreground)", background: "var(--secondary)" }}>Cancel</button>
            <button type="submit" disabled={loading} className="px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-60" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
              {loading ? "Creating..." : "Create Task"}
            </button>
          </div>
        </form>
        <style>{`.fi{width:100%;border:1px solid var(--border);border-radius:var(--radius);padding:6px 10px;font-size:13px;background:var(--background);color:var(--foreground);outline:none;color-scheme:dark}.fi::-webkit-calendar-picker-indicator{opacity:0.7;cursor:pointer}`}</style>
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
