"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Plus, Search, Filter, MoreHorizontal, Eye, Trash2 } from "lucide-react";
import { createContact, archiveContact } from "@/lib/actions/contacts";
import { getInitials, cn } from "@/lib/utils";
import { ContactForm } from "@/components/forms/contact-form";

const STATUS_LABELS: Record<string, string> = {
  NEW: "New", CONTACTED: "Contacted", QUALIFIED: "Qualified",
  PROPOSAL: "Proposal", NEGOTIATION: "Negotiation", WON: "Won", LOST: "Lost",
};

const STATUS_COLORS: Record<string, string> = {
  NEW: "#6b7280", CONTACTED: "#3b82f6", QUALIFIED: "#10b981",
  PROPOSAL: "#8b5cf6", NEGOTIATION: "#f59e0b", WON: "#059669", LOST: "#dc2626",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "#6b7280", MEDIUM: "#f59e0b", HIGH: "#dc2626",
};

interface Props {
  initialContacts: any[];
  branches: any[];
  users: any[];
  total: number;
}

export function ContactsClient({ initialContacts, branches, users, total }: Props) {
  const [contacts, setContacts] = useState(initialContacts);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const filtered = contacts.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.firstName?.toLowerCase().includes(q) ||
      c.lastName?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.designation?.toLowerCase().includes(q)
    );
  });

  async function handleCreate(data: any) {
    startTransition(async () => {
      try {
        await createContact(data);
        router.refresh();
        setShowForm(false);
      } catch (err: any) {
        alert("Error: " + err.message);
      }
    });
  }

  async function handleArchive(id: string) {
    if (!confirm("Archive this contact?")) return;
    startTransition(async () => {
      await archiveContact(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>Contacts</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>{total} total</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          <Plus size={14} /> Add Contact
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts..."
            className="w-full rounded-md border pl-8 pr-3 py-1.5 text-sm outline-none"
            style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>No contacts yet</p>
            <p className="text-sm mt-1 mb-4" style={{ color: "var(--muted-foreground)" }}>Add your first contact to get started</p>
            <button
              onClick={() => setShowForm(true)}
              className="rounded-md px-3 py-1.5 text-sm font-medium"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              Add Contact
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--muted)", borderBottom: `1px solid var(--border)` }}>
                  {["Name", "Branch", "Designation", "Email", "Phone", "Owner", "Status", "Last Contact", "Follow-up", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ background: "var(--card)" }}>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b transition-colors hover:bg-[var(--muted)] cursor-pointer"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="px-4 py-2.5">
                      <Link href={`/crm/contacts/${c.id}`} className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
                          style={{ background: "var(--accent)", color: "var(--primary)" }}
                        >
                          {getInitials(`${c.firstName} ${c.lastName}`)}
                        </div>
                        <span className="font-medium" style={{ color: "var(--foreground)" }}>
                          {c.firstName} {c.lastName}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{c.branch?.name || "—"}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{c.designation || "—"}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{c.email || "—"}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{c.phone || "—"}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{c.owner?.name || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          background: `${STATUS_COLORS[c.leadStatus]}15`,
                          color: STATUS_COLORS[c.leadStatus],
                        }}
                      >
                        {STATUS_LABELS[c.leadStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {c.lastContactedAt ? format(new Date(c.lastContactedAt), "MMM d") : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: c.nextFollowUpAt && new Date(c.nextFollowUpAt) < new Date() ? "#dc2626" : "var(--muted-foreground)" }}>
                      {c.nextFollowUpAt ? format(new Date(c.nextFollowUpAt), "MMM d") : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <Link href={`/crm/contacts/${c.id}`} className="p-1 rounded hover:bg-[var(--secondary)]" style={{ color: "var(--muted-foreground)" }}>
                          <Eye size={14} />
                        </Link>
                        <button onClick={() => handleArchive(c.id)} className="p-1 rounded hover:bg-[var(--secondary)]" style={{ color: "var(--muted-foreground)" }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <ContactForm
          branches={branches}
          users={users}
          onSubmit={handleCreate}
          onClose={() => setShowForm(false)}
          loading={isPending}
        />
      )}
    </div>
  );
}
