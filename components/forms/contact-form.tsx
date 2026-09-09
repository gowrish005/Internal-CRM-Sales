"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface Props {
  branches: any[];
  users: any[];
  onSubmit: (data: any) => void;
  onClose: () => void;
  loading?: boolean;
  initial?: any;
}

const STATUSES = ["NEW","CONTACTED","QUALIFIED","PROPOSAL","NEGOTIATION","WON","LOST"];
const SOURCES = ["REFERRAL","WEBSITE","COLD_OUTREACH","EVENT","SOCIAL_MEDIA","OTHER"];
const PRIORITIES = ["LOW","MEDIUM","HIGH"];

export function ContactForm({ branches, users, onSubmit, onClose, loading, initial }: Props) {
  const [form, setForm] = useState({
    firstName: initial?.firstName || "",
    lastName: initial?.lastName || "",
    email: initial?.email || "",
    phone: initial?.phone || "",
    designation: initial?.designation || "",
    company: initial?.company || "",
    linkedin: initial?.linkedin || "",
    location: initial?.location || "",
    branchId: initial?.branchId || "",
    ownerId: initial?.ownerId || "",
    leadStatus: initial?.leadStatus || "NEW",
    leadSource: initial?.leadSource || "",
    priority: initial?.priority || "MEDIUM",
    nextFollowUpAt: initial?.nextFollowUpAt ? initial.nextFollowUpAt.slice(0, 10) : "",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      ...form,
      leadSource: form.leadSource || undefined,
      branchId: form.branchId || undefined,
      ownerId: form.ownerId || undefined,
      nextFollowUpAt: form.nextFollowUpAt || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-lg rounded-xl border shadow-xl" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            {initial ? "Edit Contact" : "Add Contact"}
          </h2>
          <button onClick={onClose} style={{ color: "var(--muted-foreground)" }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name" required>
              <input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required className="field-input" />
            </Field>
            <Field label="Last Name" required>
              <input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} required className="field-input" />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="field-input" />
            </Field>
            <Field label="Phone">
              <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className="field-input" />
            </Field>
            <Field label="Designation">
              <input value={form.designation} onChange={(e) => set("designation", e.target.value)} className="field-input" />
            </Field>
            <Field label="Company">
              <input value={form.company} onChange={(e) => set("company", e.target.value)} className="field-input" />
            </Field>
            <Field label="Branch">
              <select value={form.branchId} onChange={(e) => set("branchId", e.target.value)} className="field-input">
                <option value="">None</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="Owner">
              <select value={form.ownerId} onChange={(e) => set("ownerId", e.target.value)} className="field-input">
                <option value="">None</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={form.leadStatus} onChange={(e) => set("leadStatus", e.target.value)} className="field-input">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select value={form.priority} onChange={(e) => set("priority", e.target.value)} className="field-input">
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Lead Source">
              <select value={form.leadSource} onChange={(e) => set("leadSource", e.target.value)} className="field-input">
                <option value="">None</option>
                {SOURCES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </Field>
            <Field label="Next Follow-up">
              <input type="date" value={form.nextFollowUpAt} onChange={(e) => set("nextFollowUpAt", e.target.value)} className="field-input" />
            </Field>
          </div>
          <Field label="LinkedIn">
            <input value={form.linkedin} onChange={(e) => set("linkedin", e.target.value)} className="field-input" placeholder="https://linkedin.com/in/..." />
          </Field>
          <Field label="Location">
            <input value={form.location} onChange={(e) => set("location", e.target.value)} className="field-input" />
          </Field>
        </form>
        <div className="flex justify-end gap-2 px-5 py-3 border-t" style={{ borderColor: "var(--border)" }}>
          <button onClick={onClose} type="button" className="px-3 py-1.5 rounded-md text-sm" style={{ color: "var(--muted-foreground)", background: "var(--secondary)" }}>
            Cancel
          </button>
          <button
            onClick={() => {
              const e = new Event("submit", { bubbles: true, cancelable: true });
              document.querySelector("form")?.dispatchEvent(e);
            }}
            disabled={loading}
            className="px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-60"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            {loading ? "Saving..." : initial ? "Update" : "Create"}
          </button>
        </div>
      </div>
      <style>{`
        .field-input {
          width: 100%;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 6px 10px;
          font-size: 13px;
          background: var(--background);
          color: var(--foreground);
          outline: none;
        }
        .field-input:focus { box-shadow: 0 0 0 2px var(--ring)30; }
      `}</style>
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>
        {label}{required && <span style={{ color: "var(--destructive)" }}> *</span>}
      </label>
      {children}
    </div>
  );
}
