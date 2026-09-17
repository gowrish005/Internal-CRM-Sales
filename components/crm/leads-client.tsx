"use client";

import { useState, useTransition, useRef, useMemo, useEffect, useCallback, useSyncExternalStore, useDeferredValue } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus, LayoutGrid, List, Upload, Divide, X, Edit2, Search, ChevronDown, ChevronUp, ChevronsUpDown, Check } from "lucide-react";
import { createLead, updateLeadStatus, divideLeads, importLeadsFromCSV } from "@/lib/actions/leads";
import { saveLeadOrder } from "@/lib/lead-order";
import { useToast } from "@/components/crm/toast-provider";
import { formatCurrency } from "@/lib/utils";
import { LEAD_STATUSES, LEAD_STATUS_COLORS, LEAD_STATUS_LABELS, type LeadStatus } from "@/lib/lead-status";
import { formatIST, startOfDayIST, addDaysIST } from "@/lib/date";

const STATUSES = LEAD_STATUSES;
type Status = LeadStatus;
const STATUS_COLORS = LEAD_STATUS_COLORS;
const STATUS_LABELS = LEAD_STATUS_LABELS;


const PRIORITY_COLORS: Record<string, string> = { LOW: "#6b7280", MEDIUM: "#f59e0b", HIGH: "#dc2626" };
const PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;
const SOURCES = ["REFERRAL", "WEBSITE", "COLD_OUTREACH", "EVENT", "SOCIAL_MEDIA", "OTHER"] as const;

// Sentinel for "field is empty" options (no owner, no track, …).
const NONE = "__none__";
type SortKey = "name" | "phone" | "college" | "owner" | "track" | "status" | "priority" | "value" | "followUp";
type Sort = { key: SortKey; dir: "asc" | "desc" } | null;
type FollowUp = "" | "overdue" | "today" | "week" | "set" | "none";

interface Filters {
  search: string;
  statuses: string[];
  priorities: string[];
  owners: string[];
  tracks: string[];
  sources: string[];
  tags: string[];
  passoutYears: string[];
  followUp: FollowUp;
}

const EMPTY_FILTERS: Filters = { search: "", statuses: [], priorities: [], owners: [], tracks: [], sources: [], tags: [], passoutYears: [], followUp: "" };

/* View, filters and sort persist per browser. Backed by localStorage, with an
 * in-memory copy so the page still works where storage is blocked. */
type Prefs = { view: "kanban" | "table"; filters: Filters; sort: Sort };
const PREFS_KEY = "crm.leads.view";
const DEFAULT_PREFS: Prefs = { view: "kanban", filters: EMPTY_FILTERS, sort: null };
const prefsListeners = new Set<() => void>();
let memoryPrefs: string | null = null;

function readPrefsRaw() {
  try { return localStorage.getItem(PREFS_KEY) ?? memoryPrefs; } catch { return memoryPrefs; }
}
function parsePrefs(raw: string | null): Prefs {
  try {
    const saved = raw ? JSON.parse(raw) : null;
    return saved ? { ...DEFAULT_PREFS, ...saved, filters: { ...EMPTY_FILTERS, ...saved.filters } } : DEFAULT_PREFS;
  } catch { return DEFAULT_PREFS; }
}
function subscribePrefs(cb: () => void) {
  prefsListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => { prefsListeners.delete(cb); window.removeEventListener("storage", cb); };
}

function useLeadPrefs() {
  const raw = useSyncExternalStore(subscribePrefs, readPrefsRaw, () => null);
  const prefs = useMemo(() => parsePrefs(raw), [raw]);
  const update = useCallback((fn: (p: Prefs) => Prefs) => {
    memoryPrefs = JSON.stringify(fn(parsePrefs(readPrefsRaw())));
    try { localStorage.setItem(PREFS_KEY, memoryPrefs); } catch {}
    prefsListeners.forEach((cb) => cb());
  }, []);
  return [prefs, update] as const;
}

/** Value a column sorts by; null/"" always sorts last regardless of direction. */
function sortValue(l: any, key: SortKey): string | number | null {
  switch (key) {
    case "name": return l.name?.toLowerCase() || null;
    case "phone": return l.phone || null;
    case "college": return l.college?.toLowerCase() || null;
    case "owner": return l.owner?.name?.toLowerCase() || null;
    case "track": return l.track ?? null;
    case "status": return STATUSES.indexOf(l.status); // pipeline order, not alphabetical
    case "priority": return ["LOW", "MEDIUM", "HIGH"].indexOf(l.priority);
    case "value": return l.estimatedValue ?? null;
    case "followUp": return l.nextFollowUpAt ? new Date(l.nextFollowUpAt).getTime() : null;
  }
}

function matchesFollowUp(l: any, f: FollowUp) {
  if (!f) return true;
  if (f === "none") return !l.nextFollowUpAt;
  if (!l.nextFollowUpAt) return false;
  if (f === "set") return true;
  const at = new Date(l.nextFollowUpAt);
  const startOfToday = startOfDayIST();
  const endOfToday = addDaysIST(startOfToday, 1);
  if (f === "overdue") return at < startOfToday;
  if (f === "today") return at >= startOfToday && at < endOfToday;
  const endOfWeek = addDaysIST(startOfToday, 7);
  return at >= startOfToday && at < endOfWeek; // "week" = next 7 days
}

function applyFilters(leads: any[], f: Filters) {
  const q = f.search.trim().toLowerCase();
  return leads.filter((l) => {
    if (f.statuses.length && !f.statuses.includes(l.status)) return false;
    if (f.priorities.length && !f.priorities.includes(l.priority)) return false;
    if (f.owners.length && !f.owners.includes(l.ownerId ?? NONE)) return false;
    if (f.tracks.length && !f.tracks.includes(l.track ? String(l.track) : NONE)) return false;
    if (f.sources.length && !f.sources.includes(l.source ?? NONE)) return false;
    if (f.tags.length && !f.tags.some((t) => l.tags?.includes(t))) return false;
    if (f.passoutYears.length && !f.passoutYears.includes(l.passoutYear ? String(l.passoutYear) : NONE)) return false;
    if (!matchesFollowUp(l, f.followUp)) return false;
    if (q) {
      const haystack = [l.name, l.phone, l.email, l.college, l.branch, l.usn, l.owner?.name, ...(l.tags ?? [])]
        .filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

function applySort(leads: any[], sort: Sort) {
  if (!sort) return leads;
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...leads].sort((a, b) => {
    const va = sortValue(a, sort.key), vb = sortValue(b, sort.key);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return (va < vb ? -1 : va > vb ? 1 : 0) * sign;
  });
}

interface Props {
  leads: any[];
  users: any[];
  /** ADMIN/FOUNDER. Employees only see their own leads (enforced server-side) and get no bulk or assignment controls. */
  canManage: boolean;
}

export function LeadsClient({ leads: initial, users, canManage }: Props) {
  const [leads, setLeads] = useState(initial);
  // useState only reads `initial` on mount — router.refresh() re-runs the server
  // component and gives us a new `initial` array, but without this effect that
  // fresh data never reaches state, so actions that rely on refresh (create,
  // divide, CSV import) look like nothing happened until a manual page reload.
  useEffect(() => { setLeads(initial); }, [initial]);
  const [{ view, filters, sort }, updatePrefs] = useLeadPrefs();
  const setView = (v: Prefs["view"]) => updatePrefs((p) => ({ ...p, view: v }));
  const [showForm, setShowForm] = useState(false);
  const [showDivide, setShowDivide] = useState(false);
  const [showCSV, setShowCSV] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Status | null>(null);
  const router = useRouter();

  const tagOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of leads) for (const t of l.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]).map(([t, n]) => ({ value: t, label: t, count: n }));
  }, [leads]);
  const yearOptions = useMemo(() => {
    const counts = new Map<number, number>();
    for (const l of leads) if (l.passoutYear) counts.set(l.passoutYear, (counts.get(l.passoutYear) ?? 0) + 1);
    const opts = [...counts].sort((a, b) => a[0] - b[0]).map(([y, n]) => ({ value: String(y), label: String(y), count: n }));
    const none = leads.filter((l) => !l.passoutYear).length;
    return none ? [...opts, { value: NONE, label: "No year", count: none }] : opts;
  }, [leads]);

  // Search re-filters the whole list on every keystroke; deferring it lets React
  // keep the input responsive and only redo the (more expensive) filter+sort pass
  // once typing pauses, instead of blocking on every character.
  const deferredSearch = useDeferredValue(filters.search);
  const effectiveFilters = useMemo(() => ({ ...filters, search: deferredSearch }), [filters, deferredSearch]);
  const displayed = useMemo(() => applySort(applyFilters(leads, effectiveFilters), sort), [leads, effectiveFilters, sort]);
  const notify = useToast();

  // Opening a lead goes to its own page. Remember the list's current order
  // (filters + sort) so ←/→ there walks the same sequence.
  function openLead(lead: any) {
    saveLeadOrder(displayed.map((l) => l.id));
    router.push(`/crm/leads/${lead.id}`);
  }

  const activeFilterCount =
    (filters.search.trim() ? 1 : 0) + (filters.followUp ? 1 : 0) +
    [filters.statuses, filters.priorities, filters.owners, filters.tracks, filters.sources, filters.tags, filters.passoutYears].filter((a) => a.length).length;
  const set = <K extends keyof Filters>(key: K) => (value: Filters[K]) =>
    updatePrefs((p) => ({ ...p, filters: { ...p.filters, [key]: value } }));

  // Leads eligible for the "Divide" action: whatever the panel's current
  // filters show, restricted to leads nobody owns yet. This is what the
  // Divide modal previews and what actually gets divided — dividing never
  // touches a lead that's already assigned, and it never reaches outside
  // the leads currently in view.
  const unassignedInView = useMemo(() => displayed.filter((l) => !l.ownerId), [displayed]);

  // Table pagination — keeps the DOM small when there are many leads instead
  // of rendering every row at once.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  useEffect(() => { setPage(1); }, [effectiveFilters, sort]);
  const pageCount = Math.max(1, Math.ceil(displayed.length / pageSize));
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const paged = useMemo(() => displayed.slice((page - 1) * pageSize, page * pageSize), [displayed, page, pageSize]);

  function toggleSort(key: SortKey) {
    // asc -> desc -> off
    updatePrefs((p) => ({
      ...p,
      sort: p.sort?.key !== key ? { key, dir: "asc" } : p.sort.dir === "asc" ? { key, dir: "desc" } : null,
    }));
  }
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

  async function handleDrop(status: Status) {
    if (!dragging || dragOver === null) return;
    const lead = leads.find((l) => l.id === dragging);
    if (!lead || lead.status === status) { setDragging(null); setDragOver(null); return; }
    setLeads((prev) => prev.map((l) => l.id === dragging ? { ...l, status } : l));
    startTransition(async () => {
      try {
        await updateLeadStatus(dragging, status);
      } catch (err: any) {
        setLeads(initial);
        notify(`Couldn't change status: ${err.message}`, "error");
      }
    });
    setDragging(null);
    setDragOver(null);
  }

  async function handleDivide(userIds: string[]) {
    const leadIds = unassignedInView.map((l) => l.id);
    startTransition(async () => {
      try {
        const result = await divideLeads(leadIds, userIds);
        const skippedNote = result.skipped ? ` (${result.skipped} were already assigned by someone else and were skipped.)` : "";
        alert(`Done. ${result.assigned} unassigned leads divided — ~${result.perUser} per user.${skippedNote}`);
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
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            {activeFilterCount ? `${displayed.length} of ${leads.length} leads` : `${leads.length} leads`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex rounded-md border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <button onClick={() => setView("kanban")} className="px-2.5 py-1.5" style={{ background: view === "kanban" ? "var(--secondary)" : "var(--card)", color: view === "kanban" ? "var(--foreground)" : "var(--muted-foreground)" }}>
              <LayoutGrid size={14} />
            </button>
            <button onClick={() => setView("table")} className="px-2.5 py-1.5 border-l" style={{ borderColor: "var(--border)", background: view === "table" ? "var(--secondary)" : "var(--card)", color: view === "table" ? "var(--foreground)" : "var(--muted-foreground)" }}>
              <List size={14} />
            </button>
          </div>

          {canManage && (
            <>
              <button onClick={() => setShowCSV(true)} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs border" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)", background: "var(--card)" }}>
                <Upload size={13} /> Import CSV
              </button>
              <button onClick={() => setShowDivide(true)} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs border" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)", background: "var(--card)" }}>
                <Divide size={13} /> Divide
              </button>
            </>
          )}
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
            <Plus size={14} /> Add Lead
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--muted-foreground)" }} />
          <input
            value={filters.search}
            onChange={(e) => set("search")(e.target.value)}
            placeholder="Search name, phone, email, college, USN…"
            className="w-full rounded-md border pl-8 pr-7 py-1.5 text-xs outline-none"
            style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--foreground)" }}
          />
          {filters.search && (
            <button onClick={() => set("search")("")} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} title="Clear search">
              <X size={12} />
            </button>
          )}
        </div>
        <MultiSelect label="Status" value={filters.statuses} onChange={set("statuses")}
          options={STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s], color: STATUS_COLORS[s], count: leads.filter((l) => l.status === s).length }))} />
        <MultiSelect label="Priority" value={filters.priorities} onChange={set("priorities")}
          options={PRIORITIES.map((p) => ({ value: p, label: p, color: PRIORITY_COLORS[p], count: leads.filter((l) => l.priority === p).length }))} />
        {canManage && (
          <MultiSelect label="Owner" value={filters.owners} onChange={set("owners")}
            options={[
              ...users.map((u: any) => ({ value: u.id, label: u.name, count: leads.filter((l) => l.ownerId === u.id).length })),
              { value: NONE, label: "Unassigned", count: leads.filter((l) => !l.ownerId).length },
            ]} />
        )}
        <MultiSelect label="Track" value={filters.tracks} onChange={set("tracks")}
          options={[
            ...[1, 2, 3].map((t) => ({ value: String(t), label: `Track ${t}`, count: leads.filter((l) => l.track === t).length })),
            { value: NONE, label: "No track", count: leads.filter((l) => !l.track).length },
          ]} />
        <MultiSelect label="Source" value={filters.sources} onChange={set("sources")}
          options={[
            ...SOURCES.map((s) => ({ value: s, label: s.replace("_", " "), count: leads.filter((l) => l.source === s).length })),
            { value: NONE, label: "No source", count: leads.filter((l) => !l.source).length },
          ]} />
        {tagOptions.length > 0 && (
          <MultiSelect label="Course" value={filters.tags} onChange={set("tags")} options={tagOptions} searchable />
        )}
        {yearOptions.length > 0 && (
          <MultiSelect label="Passout" value={filters.passoutYears} onChange={set("passoutYears")} options={yearOptions} />
        )}
        <SingleSelect label="Follow-up" value={filters.followUp} onChange={set("followUp")}
          options={[
            { value: "overdue", label: "Overdue" },
            { value: "today", label: "Due today" },
            { value: "week", label: "Next 7 days" },
            { value: "set", label: "Has follow-up" },
            { value: "none", label: "No follow-up" },
          ]} />
        {activeFilterCount > 0 && (
          <button onClick={() => updatePrefs((p) => ({ ...p, filters: EMPTY_FILTERS }))} className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md hover:bg-[var(--secondary)]" style={{ color: "var(--muted-foreground)" }}>
            <X size={12} /> Clear filters
          </button>
        )}
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
                  <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>{STATUS_LABELS[status]}</span>
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
                    onClick={() => openLead(lead)}
                    className="rounded-md border p-3 cursor-grab active:cursor-grabbing"
                    style={{ background: "var(--card)", borderColor: "var(--border)", opacity: dragging === lead.id ? 0.5 : 1 }}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-sm font-medium mb-1 flex-1" style={{ color: "var(--foreground)" }}>{lead.name}</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); openLead(lead); }}
                        className="shrink-0 p-0.5 rounded hover:bg-[var(--secondary)]"
                        style={{ color: "var(--muted-foreground)" }}
                        title="Edit"
                      >
                        <Edit2 size={11} />
                      </button>
                    </div>
                    {(lead.phone || lead.college) && (
                      <p className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>{[lead.phone, lead.college].filter(Boolean).join(" · ")}</p>
                    )}
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
                  {([
                    ["name", "Name"], ["phone", "Phone"], ["college", "College"], ["owner", "Owner"], ["track", "Track"],
                    ["status", "Status"], ["priority", "Priority"], ["value", "Value"], ["followUp", "Follow-up"],
                  ] as [SortKey, string][]).map(([key, label]) => {
                    const active = sort?.key === key;
                    const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ChevronUp : ChevronDown;
                    return (
                      <th key={key} className="text-left px-4 py-2.5 text-xs font-medium" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                        <button onClick={() => toggleSort(key)} className="flex items-center gap-1 hover:text-[var(--foreground)]" style={{ color: active ? "var(--foreground)" : "var(--muted-foreground)" }}>
                          {label}
                          <Icon size={12} style={{ opacity: active ? 1 : 0.4 }} />
                        </button>
                      </th>
                    );
                  })}
                  <th />
                </tr>
              </thead>
              <tbody style={{ background: "var(--card)" }}>
                {displayed.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-12 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>{leads.length ? "No leads match these filters" : "No leads yet"}</td></tr>
                ) : paged.map((l) => (
                  <tr key={l.id} onClick={() => openLead(l)} className="border-b cursor-pointer hover:bg-[var(--muted)]" style={{ borderColor: "var(--border)" }}>
                    <td className="px-4 py-2.5">
                      <div className="font-medium" style={{ color: "var(--foreground)" }}>{l.name}</div>
                      {l.usn && <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{l.usn}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: "var(--muted-foreground)" }}>
                      {l.phone ? <a href={`tel:${l.phone}`} onClick={(e) => e.stopPropagation()} className="hover:underline" style={{ color: "var(--foreground)" }}>{l.phone}</a> : "—"}
                      {l.email && <div className="opacity-75">{l.email}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-xs max-w-[260px]" style={{ color: "var(--muted-foreground)" }}>
                      {l.college ? <div className="truncate" style={{ color: "var(--foreground)" }} title={l.college}>{l.college}</div> : "—"}
                      {(l.branch || l.passoutYear) && <div className="truncate opacity-75">{[l.branch, l.passoutYear && `Passout ${l.passoutYear}`].filter(Boolean).join(" · ")}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{l.owner?.name || "—"}</td>
                    <td className="px-4 py-2.5 text-xs">
                      {l.track ? <span className="px-1.5 py-0.5 rounded" style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>T{l.track}</span> : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${STATUS_COLORS[l.status as Status]}15`, color: STATUS_COLORS[l.status as Status] }}>
                        {STATUS_LABELS[l.status as Status] ?? l.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium" style={{ color: PRIORITY_COLORS[l.priority] }}>{l.priority}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--foreground)" }}>{l.estimatedValue ? formatCurrency(l.estimatedValue) : "—"}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{l.nextFollowUpAt ? formatIST(l.nextFollowUpAt, "monthDayYear") : "—"}</td>
                    <td className="px-4 py-2.5">
                      <button onClick={(e) => { e.stopPropagation(); openLead(l); }} className="p-1 rounded hover:bg-[var(--secondary)]" style={{ color: "var(--muted-foreground)" }} title="Edit">
                        <Edit2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {displayed.length > 0 && (
            <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-2.5 border-t" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                <span>
                  {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, displayed.length)} of {displayed.length}
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="rounded border px-1.5 py-1 text-xs outline-none"
                  style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--foreground)" }}
                >
                  {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n} / page</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-2.5 py-1 rounded-md text-xs border disabled:opacity-40"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)", background: "var(--card)" }}
                >
                  Prev
                </button>
                <span className="text-xs px-1.5" style={{ color: "var(--muted-foreground)" }}>Page {page} of {pageCount}</span>
                <button
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={page >= pageCount}
                  className="px-2.5 py-1 rounded-md text-xs border disabled:opacity-40"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)", background: "var(--card)" }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <LeadForm users={users} canManage={canManage} onSubmit={handleCreate} onClose={() => setShowForm(false)} loading={isPending} />
      )}

      {canManage && showDivide && (
        <DivideModal
          users={users}
          eligibleCount={unassignedInView.length}
          filteredCount={displayed.length}
          activeFilterCount={activeFilterCount}
          onSubmit={handleDivide}
          onClose={() => setShowDivide(false)}
          loading={isPending}
        />
      )}

      {canManage && showCSV && (
        <CSVImportModal users={users} onSubmit={handleCSVImport} onClose={() => setShowCSV(false)} loading={isPending} />
      )}

    </div>
  );
}

function LeadForm({ users, canManage, onSubmit, onClose, loading }: any) {
  const [form, setForm] = useState({
    name: "", phone: "", email: "", college: "", branch: "", usn: "", passoutYear: "", ownerId: "", source: "", status: "NEW",
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
          passoutYear: form.passoutYear ? parseInt(form.passoutYear) : undefined,
          ownerId: form.ownerId || undefined,
          source: form.source || undefined,
          expectedCloseAt: form.expectedCloseAt || undefined,
          nextFollowUpAt: form.nextFollowUpAt || undefined,
        });
      }} className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
        <F label="Lead Name" required><input value={form.name} onChange={(e) => set("name", e.target.value)} required className="fi" /></F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Phone"><input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} className="fi" /></F>
          <F label="Email"><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="fi" /></F>
          <F label="College"><input value={form.college} onChange={(e) => set("college", e.target.value)} className="fi" /></F>
          <F label="Branch"><input value={form.branch} onChange={(e) => set("branch", e.target.value)} className="fi" /></F>
          <F label="USN"><input value={form.usn} onChange={(e) => set("usn", e.target.value)} className="fi" /></F>
          <F label="Passout Year"><input type="number" value={form.passoutYear} onChange={(e) => set("passoutYear", e.target.value)} className="fi" placeholder="2027" /></F>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {canManage && (<F label="Owner"><select value={form.ownerId} onChange={(e) => set("ownerId", e.target.value)} className="fi"><option value="">None</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></F>)}
          <F label="Source"><select value={form.source} onChange={(e) => set("source", e.target.value)} className="fi"><option value="">None</option>{["REFERRAL","WEBSITE","COLD_OUTREACH","EVENT","SOCIAL_MEDIA","OTHER"].map((s) => <option key={s} value={s}>{s.replace("_"," ")}</option>)}</select></F>
          <F label="Track"><select value={form.track} onChange={(e) => set("track", e.target.value)} className="fi"><option value="">None</option><option value="1">Track 1</option><option value="2">Track 2</option><option value="3">Track 3</option></select></F>
          <F label="Status"><select value={form.status} onChange={(e) => set("status", e.target.value)} className="fi">{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select></F>
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

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  ADMIN:    { bg: "rgba(251,191,36,0.12)",  text: "#fbbf24" },
  FOUNDER:  { bg: "rgba(167,139,250,0.12)", text: "#a78bfa" },
  EMPLOYEE: { bg: "rgba(34,197,94,0.10)",   text: "#4ade80" },
};

function getInitialsFD(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function DivideModal({ users, eligibleCount, filteredCount, activeFilterCount, onSubmit, onClose, loading }: any) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const perUser = selectedUsers.length > 0 ? Math.ceil(eligibleCount / selectedUsers.length) : 0;
  const assignedInView = filteredCount - eligibleCount;

  const filtered = users.filter((u: any) =>
    u.name.toLowerCase().includes(search.toLowerCase())
  );
  const allFilteredSelected = filtered.length > 0 && filtered.every((u: any) => selectedUsers.includes(u.id));

  function toggle(id: string) {
    setSelectedUsers((prev) => prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]);
  }

  function toggleAll() {
    if (allFilteredSelected) {
      setSelectedUsers((prev) => prev.filter((id) => !filtered.some((u: any) => u.id === id)));
    } else {
      const newIds = filtered.map((u: any) => u.id);
      setSelectedUsers((prev) => Array.from(new Set([...prev, ...newIds])));
    }
  }

  return (
    <Modal title="Divide Leads" onClose={onClose}>
      <div className="p-5 space-y-4">
        {/* Summary bar */}
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3"
          style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.12)" }}
        >
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: "#e8e8e8" }}>{eligibleCount} unassigned lead{eligibleCount === 1 ? "" : "s"}</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(34,197,94,0.55)" }}>
              {selectedUsers.length > 0
                ? `~${perUser} per user across ${selectedUsers.length} selected`
                : "Select users below to distribute"}
            </p>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
              {activeFilterCount > 0
                ? `Matches your current filters (${filteredCount} shown)${assignedInView > 0 ? ` — ${assignedInView} already assigned, skipped` : ""}.`
                : assignedInView > 0
                  ? `${assignedInView} of ${filteredCount} leads already have an owner and are skipped.`
                  : "No filters active — all leads are in scope."}
            </p>
          </div>
          {selectedUsers.length > 0 && (
            <div
              className="flex items-center justify-center rounded-lg px-3 py-1 font-bold text-sm"
              style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80" }}
            >
              {selectedUsers.length} selected
            </div>
          )}
        </div>

        {/* Search + Select All row */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "rgba(255,255,255,0.25)" }}>
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users…"
              className="w-full rounded-xl pl-9 pr-3 py-2 text-sm outline-none"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#e8e8e8",
              }}
              onFocus={e => (e.currentTarget.style.borderColor = "rgba(34,197,94,0.3)")}
              onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
            />
          </div>
          <button
            type="button"
            onClick={toggleAll}
            className="shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: allFilteredSelected ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
              color: allFilteredSelected ? "#4ade80" : "rgba(180,180,180,0.7)",
              border: `1px solid ${allFilteredSelected ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
            }}
          >
            {allFilteredSelected ? "Deselect all" : "Select all"}
          </button>
        </div>

        {/* User cards */}
        <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
          {filtered.length === 0 ? (
            <p className="text-center py-6 text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No users match</p>
          ) : filtered.map((u: any) => {
            const selected = selectedUsers.includes(u.id);
            const roleStyle = ROLE_COLORS[u.role] ?? { bg: "rgba(150,150,150,0.1)", text: "#aaa" };
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => toggle(u.id)}
                className="w-full flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-150 text-left"
                style={{
                  background: selected ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${selected ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.06)"}`,
                  boxShadow: selected ? "0 0 0 1px rgba(34,197,94,0.1) inset" : "none",
                }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center font-bold shrink-0 text-xs"
                  style={{
                    background: selected ? "linear-gradient(135deg, #15803d, #22c55e)" : "rgba(255,255,255,0.06)",
                    color: selected ? "#fff" : "#888",
                    transition: "background 0.15s",
                  }}
                >
                  {getInitialsFD(u.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: selected ? "#e8e8e8" : "#aaa" }}>
                    {u.name}
                  </p>
                </div>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-md shrink-0"
                  style={{ background: roleStyle.bg, color: roleStyle.text, letterSpacing: "0.04em" }}
                >
                  {u.role}
                </span>
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-150"
                  style={{
                    background: selected ? "#22c55e" : "rgba(255,255,255,0.06)",
                    border: `1.5px solid ${selected ? "#22c55e" : "rgba(255,255,255,0.12)"}`,
                    boxShadow: selected ? "0 0 8px rgba(34,197,94,0.4)" : "none",
                  }}
                >
                  {selected && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1.5" stroke="#071209" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(180,180,180,0.7)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(selectedUsers)}
            disabled={loading || selectedUsers.length === 0 || eligibleCount === 0}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
            style={{ background: selectedUsers.length > 0 ? "#22c55e" : "rgba(34,197,94,0.2)", color: selectedUsers.length > 0 ? "#071209" : "#4ade80" }}
          >
            {loading ? "Dividing…" : eligibleCount === 0 ? "Nothing to divide" : "Divide Leads"}
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
        name: obj.name || obj.lead_name || "",
        phone: obj.phone || undefined,
        email: obj.email || undefined,
        college: obj.college || undefined,
        branch: obj.branch || undefined,
        usn: obj.usn || undefined,
        passoutYear: obj.passout_year || obj.year ? parseInt(obj.passout_year || obj.year) : undefined,
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
          CSV columns: <code>name</code> (required), <code>phone</code>, <code>email</code>, <code>college</code>, <code>branch</code>, <code>usn</code>, <code>passout_year</code>, <code>status</code>, <code>priority</code>, <code>track</code>, <code>estimated_value</code>, <code>source</code>
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

type Option = { value: string; label: string; color?: string; count?: number };

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, close]);
  return ref;
}

function FilterButton({ label, summary, active, open, onClick }: { label: string; summary?: string; active: boolean; open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs"
      style={{ borderColor: active ? "var(--primary)" : "var(--border)", background: active ? "var(--secondary)" : "var(--card)", color: active ? "var(--foreground)" : "var(--muted-foreground)" }}
    >
      <span>{label}{summary && <span className="font-medium">: {summary}</span>}</span>
      <ChevronDown size={12} style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }} />
    </button>
  );
}

const panelStyle = { background: "var(--card)", borderColor: "var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" };

function MultiSelect({ label, options, value, onChange, searchable }: { label: string; options: Option[]; value: string[]; onChange: (v: string[]) => void; searchable?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useDismiss(open, () => setOpen(false));
  const shown = query ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : options;
  const summary = value.length === 1 ? options.find((o) => o.value === value[0])?.label : value.length > 1 ? String(value.length) : undefined;
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div ref={ref} className="relative">
      <FilterButton label={label} summary={summary} active={value.length > 0} open={open} onClick={() => setOpen((o) => !o)} />
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 w-60 rounded-md border py-1" style={panelStyle}>
          {searchable && (
            <div className="px-2 pb-1">
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Find ${label.toLowerCase()}…`}
                className="w-full rounded border px-2 py-1 text-xs outline-none" style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--foreground)" }} />
            </div>
          )}
          <div className="max-h-64 overflow-y-auto">
            {shown.map((o) => {
              const checked = value.includes(o.value);
              return (
                <button key={o.value} onClick={() => toggle(o.value)} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs text-left hover:bg-[var(--muted)]" style={{ color: "var(--foreground)" }}>
                  <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border" style={{ borderColor: checked ? "var(--primary)" : "var(--border)", background: checked ? "var(--primary)" : "transparent", color: "var(--primary-foreground)" }}>
                    {checked && <Check size={10} strokeWidth={3} />}
                  </span>
                  {o.color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: o.color }} />}
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.count !== undefined && <span style={{ color: "var(--muted-foreground)" }}>{o.count}</span>}
                </button>
              );
            })}
            {shown.length === 0 && <p className="px-2.5 py-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>No matches</p>}
          </div>
          {value.length > 0 && (
            <button onClick={() => onChange([])} className="mt-1 w-full border-t px-2.5 pt-1.5 pb-0.5 text-left text-xs hover:text-[var(--foreground)]" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
              Clear {label.toLowerCase()}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SingleSelect<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T | ""; onChange: (v: T | "") => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const current = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <FilterButton label={label} summary={current?.label} active={!!current} open={open} onClick={() => setOpen((o) => !o)} />
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 w-44 rounded-md border py-1" style={panelStyle}>
          {[{ value: "" as const, label: "Any" }, ...options].map((o) => (
            <button key={o.value || "any"} onClick={() => { onChange(o.value); setOpen(false); }}
              className="flex w-full items-center justify-between px-2.5 py-1.5 text-xs text-left hover:bg-[var(--muted)]" style={{ color: "var(--foreground)" }}>
              {o.label}
              {o.value === value && <Check size={12} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Modal({ title, onClose, children, headerRight }: { title: string; onClose: () => void; children: React.ReactNode; headerRight?: React.ReactNode }) {
  // Portal to document.body so fixed positioning isn't confined by parent stacking contexts
  // (PageTransition uses will-change: transform which creates a new containing block)
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl"
        style={{ background: "#111e14", borderColor: "#1e3322" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#1e3322" }}>
          <h2 className="text-sm font-semibold" style={{ color: "#e8e8e8" }}>{title}</h2>
          <div className="flex items-center gap-2">
          {headerRight}
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
            style={{ color: "var(--muted-foreground)", background: "rgba(255,255,255,0.05)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
          >
            ×
          </button>
          </div>
        </div>
        {children}
      </div>
    </div>,
    document.body
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
