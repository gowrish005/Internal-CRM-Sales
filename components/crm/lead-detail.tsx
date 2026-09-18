"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { formatIST, istDateString, parseISTDateOnly, endOfDayIST, isPastIST } from "@/lib/date";
import { ArrowLeft, ChevronLeft, ChevronRight, Phone, Mail, CheckCircle, Circle, CalendarDays, MessageCircle } from "lucide-react";
import { LEAD_STATUSES, LEAD_STATUS_COLORS, LEAD_STATUS_LABELS, type LeadStatus } from "@/lib/lead-status";
import { parseLeadOrder, readLeadOrderRaw, subscribeLeadOrder } from "@/lib/lead-order";
import { useToast } from "@/components/crm/toast-provider";
import { sendWhatsApp } from "@/components/crm/whatsapp-modal";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
const PRIORITY_COLORS: Record<string, string> = { LOW: "#6b7280", MEDIUM: "#f59e0b", HIGH: "#dc2626" };
const SOURCES = ["REFERRAL", "WEBSITE", "COLD_OUTREACH", "EVENT", "SOCIAL_MEDIA", "OTHER"] as const;

function leadToForm(lead: any) {
  return {
    name: lead.name || "",
    phone: lead.phone || "",
    email: lead.email || "",
    college: lead.college || "",
    branch: lead.branch || "",
    usn: lead.usn || "",
    passoutYear: lead.passoutYear ? String(lead.passoutYear) : "",
    ownerId: lead.ownerId || "",
    source: lead.source || "",
    status: (lead.status || "NEW") as LeadStatus,
    priority: lead.priority || "MEDIUM",
    track: lead.track ? String(lead.track) : "",
    estimatedValue: lead.estimatedValue ? String(lead.estimatedValue) : "",
    nextFollowUpAt: lead.nextFollowUpAt ? istDateString(lead.nextFollowUpAt) : "",
  };
}
type Form = ReturnType<typeof leadToForm>;

function formToPayload(form: Form) {
  // Empty fields are sent as null so clearing a field actually clears it.
  return {
    name: form.name,
    phone: form.phone,
    email: form.email,
    college: form.college,
    branch: form.branch,
    usn: form.usn,
    passoutYear: form.passoutYear ? parseInt(form.passoutYear) : null,
    ownerId: form.ownerId || null,
    source: form.source || null,
    status: form.status,
    priority: form.priority,
    track: form.track ? parseInt(form.track) : null,
    estimatedValue: form.estimatedValue ? parseFloat(form.estimatedValue) : null,
    nextFollowUpAt: form.nextFollowUpAt || null,
  };
}

/**
 * Saves go through PATCH /api/leads/[id] with `keepalive`, not a Server Action:
 * actions are dispatched through the client router, so one started right
 * before navigating to the next lead can lose its response (and its toast).
 * keepalive also lets a save finish while the tab is closing.
 */
async function patchLead(id: string, body: object): Promise<{ name: string; status: string }> {
  const res = await fetch(`/api/leads/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}

interface Props {
  lead: any;
  users: any[];
  canManage: boolean;
}

export function LeadDetail({ lead, users, canManage }: Props) {
  const router = useRouter();
  const notify = useToast();
  const [form, setForm] = useState<Form>(() => leadToForm(lead));
  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // ---- position in the leads list (same order as the list's filters + sort)
  const orderRaw = useSyncExternalStore(subscribeLeadOrder, readLeadOrderRaw, () => null);
  const order = useMemo(() => parseLeadOrder(orderRaw), [orderRaw]);
  const index = order.indexOf(lead.id);
  const prevId = index > 0 ? order[index - 1] : null;
  const nextId = index !== -1 && index < order.length - 1 ? order[index + 1] : null;
  useEffect(() => {
    if (prevId) router.prefetch(`/crm/leads/${prevId}`);
    if (nextId) router.prefetch(`/crm/leads/${nextId}`);
  }, [prevId, nextId, router]);

  // ---- autosave: no Save button. Pending edits are saved when you move to
  // another lead, go back, press Enter, or leave the page any other way.
  const formRef = useRef(form);
  const savedRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);

  const commit = useCallback(() => {
    const current = formRef.current;
    if (JSON.stringify(current) === JSON.stringify(savedRef.current)) return;
    if (!current.name.trim()) {
      notify("Not saved: lead name can't be empty", "error");
      return;
    }
    savedRef.current = current;
    patchLead(lead.id, formToPayload(current))
      .then((u) => notify(`Saved ${u.name}`))
      .catch((err) => notify(`Couldn't save ${current.name}: ${err.message}`, "error"));
  }, [lead.id, notify]);

  const goTo = useCallback((href: string) => { commit(); router.push(href); }, [commit, router]);

  // Leaving through the sidebar, browser back, etc. still saves.
  useEffect(() => () => commit(), [commit]);
  // Closing or reloading the tab: the keepalive request still completes.
  useEffect(() => {
    window.addEventListener("pagehide", commit);
    return () => window.removeEventListener("pagehide", commit);
  }, [commit]);

  // Fill exactly the space below the top bar (and the notifications banner,
  // when shown) so the whole lead fits one screen without page scrolling.
  // Re-measured when that space changes. Below lg the columns stack and the
  // page scrolls normally.
  const rootRef = useRef<HTMLFormElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const el = rootRef.current;
    const main = el?.closest("main");
    if (!el || !main) return;
    const fit = () => {
      if (window.innerWidth < 1024) { setHeight(null); return; }
      const bottom = main.getBoundingClientRect().bottom - parseFloat(getComputedStyle(main).paddingBottom);
      setHeight(Math.max(560, Math.floor(bottom - el.getBoundingClientRect().top)));
    };
    const ro = new ResizeObserver(fit); // fires once on observe, then on every size change
    ro.observe(main);
    return () => ro.disconnect();
  }, []);

  // ---- status: applied immediately (not part of the autosave batch)
  const changeStatus = useCallback((status: LeadStatus) => {
    const previous = formRef.current.status;
    if (status === previous) return;
    setForm((f) => ({ ...f, status }));
    savedRef.current = { ...savedRef.current, status };
    patchLead(lead.id, { status }).catch((err) => {
      setForm((f) => ({ ...f, status: previous }));
      savedRef.current = { ...savedRef.current, status: previous };
      notify(`Couldn't change status: ${err.message}`, "error");
    });
  }, [lead.id, notify]);

  // ---- keyboard: ←/→ previous/next lead, ↑/↓ status, Esc back to the list.
  // Ignored while typing in a field so text editing and <select> keys work.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (e.key === "Escape") {
        if (typing) { (e.target as HTMLElement).blur(); return; }
        e.preventDefault(); goTo("/crm/leads"); return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight" && nextId) { e.preventDefault(); goTo(`/crm/leads/${nextId}`); }
      else if (e.key === "ArrowLeft" && prevId) { e.preventDefault(); goTo(`/crm/leads/${prevId}`); }
      else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const idx = LEAD_STATUSES.indexOf(formRef.current.status);
        const next = LEAD_STATUSES[Math.min(LEAD_STATUSES.length - 1, Math.max(0, idx + (e.key === "ArrowUp" ? -1 : 1)))];
        changeStatus(next);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, nextId, prevId, changeStatus]);

  const followUpOverdue = form.nextFollowUpAt && isPastIST(endOfDayIST(parseISTDateOnly(form.nextFollowUpAt)));

  return (
    <form
      ref={rootRef}
      onSubmit={(e) => { e.preventDefault(); commit(); }}
      className="flex flex-col gap-3 max-w-7xl mx-auto"
      style={height ? { height } : undefined}
    >
      {/* Enter in any field saves */}
      <button type="submit" hidden aria-hidden />

      {/* ---- header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button type="button" onClick={() => goTo("/crm/leads")} title="Back to leads (Esc)"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-[var(--secondary)]" style={{ color: "var(--muted-foreground)" }}>
          <ArrowLeft size={14} /> Leads
        </button>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h1 className="text-lg font-semibold truncate" style={{ color: "var(--foreground)" }}>{form.name || "Untitled lead"}</h1>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
            style={{ background: `${LEAD_STATUS_COLORS[form.status]}22`, color: LEAD_STATUS_COLORS[form.status] }}>
            {LEAD_STATUS_LABELS[form.status]}
          </span>
          {lead.owner && <span className="text-xs shrink-0" style={{ color: "var(--muted-foreground)" }}>· {lead.owner.name}</span>}
        </div>
        <span className="hidden md:inline text-xs" style={{ color: "var(--muted-foreground)" }}>
          ← → switch lead · ↑ ↓ status · Esc back · changes save automatically
        </span>
        <div className="flex items-center gap-1">
          <NavButton disabled={!prevId} onClick={() => prevId && goTo(`/crm/leads/${prevId}`)} title="Previous lead (←)"><ChevronLeft size={15} /></NavButton>
          {index !== -1 && <span className="text-xs px-1 tabular-nums" style={{ color: "var(--muted-foreground)" }}>{index + 1} of {order.length}</span>}
          <NavButton disabled={!nextId} onClick={() => nextId && goTo(`/crm/leads/${nextId}`)} title="Next lead (→)"><ChevronRight size={15} /></NavButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:flex-1 lg:min-h-0">
        {/* ---- column 1: who they are */}
        <Card title="Details">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <Field label="Name" span><input value={form.name} onChange={(e) => set("name", e.target.value)} className="ld-in" /></Field>
            <Field label="Phone">
              <div className="flex gap-1">
                <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} className="ld-in" />
                {form.phone && <a href={`tel:${form.phone}`} title="Call" className="ld-icon"><Phone size={13} /></a>}
                {form.phone && (
                  <button onClick={() => sendWhatsApp({ ...lead, ...form })} title="Send WhatsApp" className="ld-icon" style={{ color: "#25d366" }}>
                    <MessageCircle size={13} />
                  </button>
                )}
              </div>
            </Field>
            <Field label="Email">
              <div className="flex gap-1">
                <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="ld-in" />
                {form.email && <a href={`mailto:${form.email}`} title="Email" className="ld-icon"><Mail size={13} /></a>}
              </div>
            </Field>
            <Field label="College" span><input value={form.college} onChange={(e) => set("college", e.target.value)} className="ld-in" /></Field>
            <Field label="Branch" span><input value={form.branch} onChange={(e) => set("branch", e.target.value)} className="ld-in" /></Field>
            <Field label="USN"><input value={form.usn} onChange={(e) => set("usn", e.target.value)} className="ld-in" /></Field>
            <Field label="Passout year"><input type="number" value={form.passoutYear} onChange={(e) => set("passoutYear", e.target.value)} className="ld-in" placeholder="2027" /></Field>
          </div>
          <div className="mt-3">
            <Label>Courses / source events</Label>
            {lead.tags?.length ? (
              <div className="flex flex-wrap gap-1 mt-1">
                {lead.tags.map((t: string) => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--secondary)", color: "var(--foreground)" }}>{t}</span>
                ))}
              </div>
            ) : <Empty>None recorded</Empty>}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
            <Meta label="Created" value={formatIST(lead.createdAt, "dayMonthYear")} />
            <Meta label="Last activity" value={lead.lastActivityAt ? formatDistanceToNow(new Date(lead.lastActivityAt), { addSuffix: true }) : "—"} />
            {lead.expectedCloseAt && <Meta label="Expected close" value={formatIST(lead.expectedCloseAt, "dayMonthYear")} />}
          </div>
        </Card>

        {/* ---- column 2: where they are in the pipeline */}
        <Card title="Pipeline">
          <Label>Status <span className="opacity-60">(↑ ↓)</span></Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-1.5 mt-1 mb-3">
            {LEAD_STATUSES.map((s) => {
              const on = form.status === s;
              return (
                <button key={s} type="button" onClick={() => changeStatus(s)}
                  className="rounded-md border px-2 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    borderColor: on ? LEAD_STATUS_COLORS[s] : "var(--border)",
                    background: on ? `${LEAD_STATUS_COLORS[s]}26` : "transparent",
                    color: on ? LEAD_STATUS_COLORS[s] : "var(--muted-foreground)",
                  }}>
                  {LEAD_STATUS_LABELS[s]}
                </button>
              );
            })}
          </div>

          <Label>Priority</Label>
          <div className="grid grid-cols-3 gap-1.5 mt-1 mb-3">
            {PRIORITIES.map((p) => {
              const on = form.priority === p;
              return (
                <button key={p} type="button" onClick={() => set("priority", p)}
                  className="rounded-md border px-2 py-1.5 text-xs font-medium"
                  style={{ borderColor: on ? PRIORITY_COLORS[p] : "var(--border)", background: on ? `${PRIORITY_COLORS[p]}26` : "transparent", color: on ? PRIORITY_COLORS[p] : "var(--muted-foreground)" }}>
                  {p}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            {canManage ? (
              <Field label="Owner">
                <select value={form.ownerId} onChange={(e) => set("ownerId", e.target.value)} className="ld-in">
                  <option value="">Unassigned</option>
                  {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </Field>
            ) : (
              <Field label="Owner"><div className="ld-in ld-ro">{lead.owner?.name ?? "—"}</div></Field>
            )}
            <Field label="Source">
              <select value={form.source} onChange={(e) => set("source", e.target.value)} className="ld-in">
                <option value="">None</option>
                {SOURCES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </Field>
            <Field label="Track">
              <select value={form.track} onChange={(e) => set("track", e.target.value)} className="ld-in">
                <option value="">None</option>
                {[1, 2, 3].map((t) => <option key={t} value={t}>Track {t}</option>)}
              </select>
            </Field>
            <Field label="Est. value (₹)"><input type="number" value={form.estimatedValue} onChange={(e) => set("estimatedValue", e.target.value)} className="ld-in" placeholder="0" /></Field>
            <Field label="Next follow-up" span>
              <input type="date" value={form.nextFollowUpAt} onChange={(e) => set("nextFollowUpAt", e.target.value)} className="ld-in"
                style={followUpOverdue ? { borderColor: "#dc2626" } : undefined} />
            </Field>
          </div>
          {followUpOverdue && <p className="text-xs mt-1" style={{ color: "#f87171" }}>Follow-up is overdue</p>}
        </Card>

        {/* ---- column 3: history */}
        <div className="flex flex-col gap-3 lg:min-h-0">
          <Card title={`Call notes (${lead.notes.length})`} grow>
            {lead.notes.length === 0 ? <Empty>No notes yet</Empty> : (
              <ul className="space-y-2">
                {lead.notes.map((n: any) => (
                  <li key={n.id} className="rounded-md px-2.5 py-2" style={{ background: "var(--muted)" }}>
                    <p className="text-xs whitespace-pre-line" style={{ color: "var(--foreground)" }}>{n.content}</p>
                    <p className="text-[11px] mt-1" style={{ color: "var(--muted-foreground)" }}>{n.author?.name} · {formatIST(n.createdAt, "dayMonthTime")}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={`Tasks & meetings (${lead.tasks.length + lead.meetings.length})`}>
            {lead.tasks.length + lead.meetings.length === 0 ? <Empty>None linked</Empty> : (
              <ul className="space-y-1.5 max-h-32 overflow-y-auto">
                {lead.tasks.map((t: any) => (
                  <li key={t.id} className="flex items-center gap-2 text-xs">
                    {t.status === "COMPLETED" ? <CheckCircle size={13} color="#059669" /> : <Circle size={13} style={{ color: "var(--muted-foreground)" }} />}
                    <span className="flex-1 truncate" style={{ color: "var(--foreground)", textDecoration: t.status === "COMPLETED" ? "line-through" : undefined }}>{t.title}</span>
                    {t.dueAt && <span style={{ color: "var(--muted-foreground)" }}>{formatIST(t.dueAt, "dayMonth")}</span>}
                  </li>
                ))}
                {lead.meetings.map((m: any) => (
                  <li key={m.id} className="flex items-center gap-2 text-xs">
                    <CalendarDays size={13} style={{ color: "var(--muted-foreground)" }} />
                    <span className="flex-1 truncate" style={{ color: "var(--foreground)" }}>{m.title}</span>
                    <span style={{ color: "var(--muted-foreground)" }}>{formatIST(m.startAt, "dayMonthTime")}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Activity" grow>
            {lead.activities.length === 0 ? <Empty>No activity yet</Empty> : (
              <ul className="space-y-1.5">
                {lead.activities.map((a: any) => (
                  <li key={a.id} className="text-xs">
                    <span style={{ color: "var(--foreground)" }}>{a.description}</span>
                    <span style={{ color: "var(--muted-foreground)" }}> · {a.user?.name ?? "System"} · {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <style>{`
        .ld-in{width:100%;border:1px solid var(--border);border-radius:var(--radius);padding:5px 8px;font-size:13px;background:var(--background);color:var(--foreground);outline:none;color-scheme:dark;min-width:0}
        .ld-in:focus{border-color:var(--primary)}
        .ld-ro{color:var(--muted-foreground)}
        .ld-icon{display:flex;align-items:center;justify-content:center;width:30px;flex-shrink:0;border:1px solid var(--border);border-radius:var(--radius);color:var(--muted-foreground)}
        .ld-icon:hover{color:var(--foreground);background:var(--secondary)}
      `}</style>

    </form>
  );
}

function Card({ title, children, grow }: { title: string; children: React.ReactNode; grow?: boolean }) {
  return (
    <section className={`rounded-xl border flex flex-col lg:min-h-0 ${grow ? "lg:flex-1" : ""}`} style={{ background: "var(--card)", borderColor: "var(--border)" }}>
      <h2 className="px-4 pt-3 pb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>{title}</h2>
      <div className="px-4 pb-3 lg:overflow-y-auto lg:min-h-0">{children}</div>
    </section>
  );
}

function Field({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (
    <label className={`block ${span ? "col-span-2" : ""}`}>
      <Label>{label}</Label>
      <div className="mt-0.5">{children}</div>
    </label>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="block text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>{children}</span>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div><span className="block text-[11px]">{label}</span><span style={{ color: "var(--foreground)" }}>{value}</span></div>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{children}</p>;
}

function NavButton({ children, disabled, onClick, title }: { children: React.ReactNode; disabled: boolean; onClick: () => void; title: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className="flex items-center justify-center w-7 h-7 rounded-md border disabled:opacity-30"
      style={{ borderColor: "var(--border)", color: "var(--foreground)", background: "var(--card)" }}>
      {children}
    </button>
  );
}
