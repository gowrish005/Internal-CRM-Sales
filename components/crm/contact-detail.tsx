"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatIST } from "@/lib/date";
import { ArrowLeft, Mail, Phone, ExternalLink, MapPin, Edit, Plus, Calendar, CheckSquare, PhoneCall, Trash2 } from "lucide-react";
import Link from "next/link";
import { updateContact, addContactNote } from "@/lib/actions/contacts";
import { addCallLog, deleteCallLog } from "@/lib/actions/call-logs";
import { getInitials } from "@/lib/utils";
import { ContactForm } from "@/components/forms/contact-form";

const STATUS_COLORS: Record<string, string> = {
  NEW: "#6b7280", CONTACTED: "#3b82f6", QUALIFIED: "#10b981",
  PROPOSAL: "#8b5cf6", NEGOTIATION: "#f59e0b", WON: "#059669", LOST: "#dc2626",
};

function localNow() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function ContactDetail({ contact, users }: { contact: any; users: any[] }) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const [activeTab, setActiveTab] = useState<"activity" | "notes" | "tasks" | "leads" | "calls">("activity");
  const [isPending, startTransition] = useTransition();
  const [showCallForm, setShowCallForm] = useState(false);
  const [callForm, setCallForm] = useState({ calledAt: localNow(), durationMinutes: "", remarks: "" });
  const router = useRouter();

  async function handleUpdate(data: any) {
    startTransition(async () => {
      try {
        await updateContact(contact.id, data);
        router.refresh();
        setEditing(false);
      } catch (err: any) {
        alert("Error: " + err.message);
      }
    });
  }

  async function handleAddNote() {
    if (!note.trim()) return;
    startTransition(async () => {
      try {
        await addContactNote({ content: note.trim(), contactId: contact.id });
        setNote("");
        router.refresh();
      } catch (err: any) {
        alert("Error: " + err.message);
      }
    });
  }

  async function handleAddCallLog() {
    if (!callForm.remarks.trim()) return;
    startTransition(async () => {
      try {
        await addCallLog({
          contactId: contact.id,
          calledAt: new Date(callForm.calledAt).toISOString(),
          durationMinutes: callForm.durationMinutes ? parseInt(callForm.durationMinutes) : undefined,
          remarks: callForm.remarks.trim(),
        });
        setCallForm({ calledAt: localNow(), durationMinutes: "", remarks: "" });
        setShowCallForm(false);
        router.refresh();
      } catch (err: any) {
        alert("Error: " + err.message);
      }
    });
  }

  async function handleDeleteCallLog(logId: string) {
    startTransition(async () => {
      try {
        await deleteCallLog(logId, contact.id);
        router.refresh();
      } catch (err: any) {
        alert("Error: " + err.message);
      }
    });
  }

  const tabs = ["activity", "notes", "tasks", "leads", "calls"] as const;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/crm/contacts" className="flex items-center gap-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
          <ArrowLeft size={14} /> Back
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Info */}
        <div className="space-y-4">
          <div className="rounded-lg border p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center font-semibold"
                  style={{ background: "var(--accent)", color: "var(--primary)", fontSize: 18 }}
                >
                  {getInitials(`${contact.firstName} ${contact.lastName}`)}
                </div>
                <div>
                  <h1 className="font-semibold text-base" style={{ color: "var(--foreground)" }}>
                    {contact.firstName} {contact.lastName}
                  </h1>
                  <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{contact.designation || "No title"}</p>
                </div>
              </div>
              <button
                onClick={() => setEditing(true)}
                className="p-1.5 rounded-md hover:bg-[var(--secondary)]"
                style={{ color: "var(--muted-foreground)" }}
              >
                <Edit size={14} />
              </button>
            </div>

            <div className="space-y-2.5 text-sm">
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-2" style={{ color: "var(--muted-foreground)" }}>
                  <Mail size={13} /> {contact.email}
                </a>
              )}
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="flex items-center gap-2" style={{ color: "var(--muted-foreground)" }}>
                  <Phone size={13} /> {contact.phone}
                </a>
              )}
              {contact.linkedin && (
                <a href={contact.linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-2" style={{ color: "var(--muted-foreground)" }}>
                  <ExternalLink size={13} /> LinkedIn
                </a>
              )}
              {contact.location && (
                <span className="flex items-center gap-2" style={{ color: "var(--muted-foreground)" }}>
                  <MapPin size={13} /> {contact.location}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-lg border p-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--muted-foreground)" }}>CRM Details</h3>
            <dl className="space-y-2 text-sm">
              <Row label="Owner" value={contact.owner?.name} />
              <Row label="Status">
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: `${STATUS_COLORS[contact.leadStatus]}15`, color: STATUS_COLORS[contact.leadStatus] }}
                >
                  {contact.leadStatus}
                </span>
              </Row>
              <Row label="Priority" value={contact.priority} />
              <Row label="Source" value={contact.leadSource?.replace("_", " ")} />
              <Row label="Next Follow-up" value={contact.nextFollowUpAt ? formatIST(contact.nextFollowUpAt, "monthDayYear") : undefined} />
              <Row label="Last Contacted" value={contact.lastContactedAt ? formatIST(contact.lastContactedAt, "monthDayYear") : undefined} />
              <Row label="Created" value={formatIST(contact.createdAt, "monthDayYear")} />
            </dl>
          </div>
        </div>

        {/* Right: Tabs */}
        <div className="lg:col-span-2 space-y-4">
          {/* Quick add note */}
          <div className="rounded-lg border p-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note..."
              rows={2}
              className="w-full text-sm resize-none outline-none bg-transparent"
              style={{ color: "var(--foreground)" }}
            />
            {note.trim() && (
              <div className="flex justify-end mt-2">
                <button
                  onClick={handleAddNote}
                  disabled={isPending}
                  className="px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-60"
                  style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  Add Note
                </button>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="rounded-lg border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex border-b" style={{ borderColor: "var(--border)" }}>
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="px-4 py-2.5 text-sm capitalize"
                  style={activeTab === tab
                    ? { color: "var(--primary)", borderBottom: "2px solid var(--primary)", fontWeight: 500 }
                    : { color: "var(--muted-foreground)" }
                  }
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {activeTab === "activity" && (
                contact.activities.length === 0 ? (
                  <EmptyState text="No activity yet" />
                ) : (
                  contact.activities.map((a: any) => (
                    <div key={a.id} className="px-4 py-3">
                      <p className="text-sm" style={{ color: "var(--foreground)" }}>{a.description}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                        {a.user?.name} · {formatIST(a.createdAt, "monthDayTime")}
                      </p>
                    </div>
                  ))
                )
              )}

              {activeTab === "notes" && (
                contact.notes.length === 0 ? (
                  <EmptyState text="No notes yet" />
                ) : (
                  contact.notes.map((n: any) => (
                    <div key={n.id} className="px-4 py-3">
                      <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--foreground)" }}>{n.content}</p>
                      <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
                        {n.author?.name} · {formatIST(n.createdAt, "monthDayYear")}
                      </p>
                    </div>
                  ))
                )
              )}

              {activeTab === "tasks" && (
                contact.tasks.length === 0 ? (
                  <EmptyState text="No tasks" />
                ) : (
                  contact.tasks.map((t: any) => (
                    <div key={t.id} className="px-4 py-3 flex items-center gap-3">
                      <CheckSquare size={14} style={{ color: t.status === "COMPLETED" ? "#059669" : "var(--muted-foreground)" }} />
                      <div>
                        <p className="text-sm" style={{ color: "var(--foreground)", textDecoration: t.status === "COMPLETED" ? "line-through" : "none" }}>
                          {t.title}
                        </p>
                        {t.dueAt && <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{formatIST(t.dueAt, "monthDay")}</p>}
                      </div>
                    </div>
                  ))
                )
              )}

              {activeTab === "leads" && (
                contact.leads.length === 0 ? (
                  <EmptyState text="No leads" />
                ) : (
                  contact.leads.map((l: any) => (
                    <div key={l.id} className="px-4 py-3">
                      <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{l.name}</p>
                      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{l.status} · {l.estimatedValue ? `₹${l.estimatedValue.toLocaleString()}` : "No value"}</p>
                    </div>
                  ))
                )
              )}

              {activeTab === "calls" && (
                <div>
                  <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                    {showCallForm ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Date & Time</label>
                            <input
                              type="datetime-local"
                              value={callForm.calledAt}
                              onChange={(e) => setCallForm((f) => ({ ...f, calledAt: e.target.value }))}
                              className="w-full text-sm rounded border px-2 py-1.5 outline-none"
                              style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)", colorScheme: "dark" }}
                            />
                          </div>
                          <div>
                            <label className="block text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Duration (min)</label>
                            <input
                              type="number"
                              placeholder="Optional"
                              value={callForm.durationMinutes}
                              onChange={(e) => setCallForm((f) => ({ ...f, durationMinutes: e.target.value }))}
                              className="w-full text-sm rounded border px-2 py-1.5 outline-none"
                              style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                            />
                          </div>
                        </div>
                        <textarea
                          placeholder="What was discussed on the call..."
                          value={callForm.remarks}
                          onChange={(e) => setCallForm((f) => ({ ...f, remarks: e.target.value }))}
                          rows={3}
                          className="w-full text-sm rounded border px-2 py-1.5 outline-none resize-none"
                          style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleAddCallLog}
                            disabled={isPending || !callForm.remarks.trim()}
                            className="px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
                            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setShowCallForm(false)}
                            className="px-3 py-1.5 rounded text-xs"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowCallForm(true)}
                        className="flex items-center gap-1.5 text-sm"
                        style={{ color: "var(--primary)" }}
                      >
                        <PhoneCall size={13} /> Log a call
                      </button>
                    )}
                  </div>
                  {contact.callLogs?.length === 0 ? (
                    <EmptyState text="No calls logged yet" />
                  ) : (
                    contact.callLogs?.map((log: any) => (
                      <div key={log.id} className="px-4 py-3 border-b group" style={{ borderColor: "var(--border)" }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--foreground)" }}>{log.remarks}</p>
                            <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
                              <PhoneCall size={10} className="inline mr-1" />
                              {formatIST(log.calledAt, "monthDayTime")}
                              {log.durationMinutes ? ` · ${log.durationMinutes} min` : ""}
                              {" · "}{log.loggedBy?.name}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteCallLog(log.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <ContactForm
          users={users}
          initial={contact}
          onSubmit={handleUpdate}
          onClose={() => setEditing(false)}
          loading={isPending}
        />
      )}
    </div>
  );
}

function Row({ label, value, children }: { label: string; value?: string | null; children?: React.ReactNode }) {
  if (!value && !children) return null;
  return (
    <div className="flex justify-between items-center">
      <dt style={{ color: "var(--muted-foreground)" }}>{label}</dt>
      <dd style={{ color: "var(--foreground)", textAlign: "right" }}>{children ?? value}</dd>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-8 text-center">
      <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{text}</p>
    </div>
  );
}
