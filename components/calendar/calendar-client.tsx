"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addDays, addWeeks, addMonths, subWeeks, subMonths,
  isSameDay, isSameMonth, isToday, eachDayOfInterval, startOfDay, endOfDay, parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { createEvent, cancelEvent } from "@/lib/actions/events";

type View = "week" | "month" | "day" | "agenda";

const EVENT_COLORS: Record<string, string> = {
  MEETING: "#3b82f6", CALL: "#10b981", EVENT: "#8b5cf6", FOLLOW_UP: "#f59e0b",
};

interface Props {
  events: any[];
  users: any[];
  branches: any[];
  contacts: any[];
  currentUserId?: string;
}

export function CalendarClient({ events: initialEvents, users, branches, contacts, currentUserId }: Props) {
  const [events, setEvents] = useState(initialEvents);
  const [view, setView] = useState<View>("week");
  const [current, setCurrent] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [calendarFilter, setCalendarFilter] = useState<string>("all"); // "all", userId
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const filteredEvents = events.filter((e) => {
    if (calendarFilter === "all") return true;
    return e.organizerId === calendarFilter || e.participantIds?.includes(calendarFilter);
  });

  async function handleCreate(data: any) {
    startTransition(async () => {
      try {
        const newEvent = await createEvent({ ...data, organizerId: currentUserId });
        setEvents((prev) => [...prev, newEvent]);
        setShowForm(false);
        router.refresh();
      } catch (err: any) {
        alert("Error: " + err.message);
      }
    });
  }

  async function handleCancel(id: string) {
    if (!confirm("Cancel this event?")) return;
    startTransition(async () => {
      await cancelEvent(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      setSelectedEvent(null);
    });
  }

  const founders = users.filter((u: any) => u.role === "FOUNDER" || u.role === "ADMIN");

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => {
            if (view === "week") setCurrent(subWeeks(current, 1));
            else if (view === "month") setCurrent(subMonths(current, 1));
            else setCurrent(addDays(current, -1));
          }} className="p-1.5 rounded-md hover:bg-[var(--secondary)]" style={{ color: "var(--muted-foreground)" }}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setCurrent(new Date())} className="px-2.5 py-1 rounded-md text-xs border" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
            Today
          </button>
          <button onClick={() => {
            if (view === "week") setCurrent(addWeeks(current, 1));
            else if (view === "month") setCurrent(addMonths(current, 1));
            else setCurrent(addDays(current, 1));
          }} className="p-1.5 rounded-md hover:bg-[var(--secondary)]" style={{ color: "var(--muted-foreground)" }}>
            <ChevronRight size={16} />
          </button>
          <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
            {view === "week"
              ? `${format(startOfWeek(current, { weekStartsOn: 1 }), "MMM d")} – ${format(endOfWeek(current, { weekStartsOn: 1 }), "MMM d, yyyy")}`
              : view === "month"
              ? format(current, "MMMM yyyy")
              : format(current, "MMMM d, yyyy")}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={calendarFilter}
            onChange={(e) => setCalendarFilter(e.target.value)}
            className="rounded-md border px-2 py-1.5 text-xs outline-none"
            style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
          >
            <option value="all">All Calendars</option>
            <option value={currentUserId || ""}>My Calendar</option>
            {founders.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <div className="flex rounded-md border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            {(["day", "week", "month", "agenda"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-2.5 py-1.5 text-xs capitalize"
                style={{ background: view === v ? "var(--secondary)" : "var(--card)", color: view === v ? "var(--foreground)" : "var(--muted-foreground)", borderRight: "1px solid var(--border)" }}
              >
                {v}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setFormDate(new Date()); setShowForm(true); }}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            <Plus size={14} /> New Event
          </button>
        </div>
      </div>

      {/* Calendar body */}
      <div className="flex-1 overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)" }}>
        {view === "week" && <WeekView current={current} events={filteredEvents} onEventClick={setSelectedEvent} onDayClick={(d: Date) => { setFormDate(d); setShowForm(true); }} onCellClick={(d: Date) => { setFormDate(d); setShowForm(true); }} />}
        {view === "month" && <MonthView current={current} events={filteredEvents} onEventClick={setSelectedEvent} onDayClick={(d: Date) => { setFormDate(d); setShowForm(true); }} />}
        {view === "day" && <DayView current={current} events={filteredEvents} onEventClick={setSelectedEvent} />}
        {view === "agenda" && <AgendaView events={filteredEvents} onEventClick={setSelectedEvent} />}
      </div>

      {/* Event detail panel */}
      {selectedEvent && (
        <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} onCancel={handleCancel} />
      )}

      {/* Create form */}
      {showForm && (
        <EventForm
          users={users}
          branches={branches}
          contacts={contacts}
          defaultDate={formDate}
          onSubmit={handleCreate}
          onClose={() => setShowForm(false)}
          loading={isPending}
        />
      )}
    </div>
  );
}

function WeekView({ current, events, onEventClick, onDayClick, onCellClick }: any) {
  const start = startOfWeek(current, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const hours = Array.from({ length: 24 }, (_, i) => i);

  function eventsForDay(day: Date) {
    return events.filter((e: any) => isSameDay(new Date(e.startAt), day));
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--card)" }}>
      {/* Day headers — scrollbar-gutter keeps widths aligned with scrollable body */}
      <div className="grid border-b" style={{ gridTemplateColumns: "48px repeat(7, 1fr)", borderColor: "var(--border)", scrollbarGutter: "stable", overflowY: "scroll" }}>
        <div className="border-r" style={{ borderColor: "var(--border)" }} />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className="text-center py-2 border-r cursor-pointer hover:bg-[var(--secondary)]"
            style={{ borderColor: "var(--border)" }}
            onClick={() => onDayClick(day)}
          >
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{format(day, "EEE")}</p>
            <p
              className="text-sm font-medium"
              style={{ color: isToday(day) ? "var(--primary)" : "var(--foreground)" }}
            >
              {format(day, "d")}
            </p>
          </div>
        ))}
      </div>
      {/* Time grid */}
      <div className="flex-1 overflow-y-scroll">
        <div className="relative" style={{ minHeight: `${24 * 60}px` }}>
          {hours.map((h) => (
            <div key={h} className="flex border-b" style={{ height: 60, borderColor: "var(--border)" }}>
              <div className="w-12 shrink-0 border-r px-2 flex items-start pt-1" style={{ borderColor: "var(--border)" }}>
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{h === 0 ? "" : `${h}:00`}</span>
              </div>
              {days.map((day) => {
                const cellDate = new Date(day);
                cellDate.setHours(h, 0, 0, 0);
                return (
                  <div
                    key={day.toISOString()}
                    className="flex-1 border-r cursor-pointer transition-colors"
                    style={{ borderColor: "var(--border)" }}
                    onClick={() => onCellClick(cellDate)}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  />
                );
              })}
            </div>
          ))}
          {/* Events overlay */}
          {days.map((day, di) => (
            eventsForDay(day).map((ev: any) => {
              const startMin = new Date(ev.startAt).getHours() * 60 + new Date(ev.startAt).getMinutes();
              const endMin = new Date(ev.endAt).getHours() * 60 + new Date(ev.endAt).getMinutes();
              const top = startMin + (48 / 7) * 0; // rough positioning
              const height = Math.max(endMin - startMin, 20);
              const color = EVENT_COLORS[ev.type] || "#6b7280";
              return (
                <div
                  key={ev.id}
                  onClick={() => onEventClick(ev)}
                  className="absolute rounded-md px-2 py-1 cursor-pointer text-white overflow-hidden"
                  style={{
                    top: startMin,
                    height: Math.max(height, 24),
                    left: `calc(48px + ${di} * (100% - 48px) / 7 + 2px)`,
                    width: `calc((100% - 48px) / 7 - 4px)`,
                    background: color,
                    opacity: 0.9,
                    zIndex: 1,
                  }}
                >
                  <p className="text-xs font-medium truncate">{ev.title}</p>
                  <p className="text-xs opacity-80">{format(new Date(ev.startAt), "HH:mm")}</p>
                </div>
              );
            })
          ))}
        </div>
      </div>
    </div>
  );
}

function MonthView({ current, events, onEventClick, onDayClick }: any) {
  const start = startOfMonth(current);
  const end = endOfMonth(current);
  const gridStart = startOfWeek(start, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(end, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--card)" }}>
      <div className="grid grid-cols-7 border-b" style={{ borderColor: "var(--border)" }}>
        {weekDays.map((d) => (
          <div key={d} className="text-center py-2 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>{d}</div>
        ))}
      </div>
      <div className="flex-1 grid grid-cols-7" style={{ gridAutoRows: "1fr" }}>
        {days.map((day) => {
          const dayEvents = events.filter((e: any) => isSameDay(new Date(e.startAt), day));
          return (
            <div
              key={day.toISOString()}
              className="border-r border-b p-1 min-h-[80px] cursor-pointer hover:bg-[var(--muted)]"
              style={{ borderColor: "var(--border)", opacity: isSameMonth(day, current) ? 1 : 0.4 }}
              onClick={() => onDayClick(day)}
            >
              <p
                className="text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full"
                style={isToday(day) ? { background: "var(--primary)", color: "white" } : { color: "var(--foreground)" }}
              >
                {format(day, "d")}
              </p>
              {dayEvents.slice(0, 3).map((ev: any) => (
                <div
                  key={ev.id}
                  onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                  className="rounded text-xs px-1 py-0.5 mb-0.5 truncate text-white cursor-pointer"
                  style={{ background: EVENT_COLORS[ev.type] || "#6b7280" }}
                >
                  {ev.title}
                </div>
              ))}
              {dayEvents.length > 3 && (
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>+{dayEvents.length - 3} more</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayView({ current, events, onEventClick }: any) {
  const dayEvents = events
    .filter((e: any) => isSameDay(new Date(e.startAt), current))
    .sort((a: any, b: any) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  return (
    <div className="p-4 space-y-2 overflow-y-auto" style={{ background: "var(--card)" }}>
      <h3 className="text-sm font-medium mb-4" style={{ color: "var(--foreground)" }}>{format(current, "EEEE, MMMM d")}</h3>
      {dayEvents.length === 0 ? (
        <p className="text-sm text-center py-12" style={{ color: "var(--muted-foreground)" }}>No events today</p>
      ) : dayEvents.map((ev: any) => (
        <EventCard key={ev.id} event={ev} onClick={() => onEventClick(ev)} />
      ))}
    </div>
  );
}

function AgendaView({ events, onEventClick }: any) {
  const sorted = [...events]
    .filter((e) => new Date(e.startAt) >= startOfDay(new Date()))
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 50);

  let lastDate = "";
  return (
    <div className="overflow-y-auto p-4 space-y-1" style={{ background: "var(--card)" }}>
      {sorted.length === 0 ? (
        <p className="text-sm text-center py-12" style={{ color: "var(--muted-foreground)" }}>No upcoming events</p>
      ) : sorted.map((ev) => {
        const dateStr = format(new Date(ev.startAt), "EEE, MMM d");
        const showDate = dateStr !== lastDate;
        lastDate = dateStr;
        return (
          <div key={ev.id}>
            {showDate && (
              <p className="text-xs font-semibold pt-3 pb-1" style={{ color: "var(--muted-foreground)" }}>{dateStr}</p>
            )}
            <EventCard event={ev} onClick={() => onEventClick(ev)} />
          </div>
        );
      })}
    </div>
  );
}

function EventCard({ event, onClick }: { event: any; onClick: () => void }) {
  const color = EVENT_COLORS[event.type] || "#6b7280";
  return (
    <div
      onClick={onClick}
      className="flex items-start gap-3 rounded-md border px-3 py-2.5 cursor-pointer hover:bg-[var(--muted)]"
      style={{ borderColor: "var(--border)", borderLeft: `3px solid ${color}` }}
    >
      <div className="shrink-0 text-xs font-medium" style={{ color }}>
        {format(new Date(event.startAt), "HH:mm")}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{event.title}</p>
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          {format(new Date(event.startAt), "HH:mm")} – {format(new Date(event.endAt), "HH:mm")}
          {event.organizer && ` · ${event.organizer.name}`}
        </p>
      </div>
    </div>
  );
}

function EventDetail({ event, onClose, onCancel }: { event: any; onClose: () => void; onCancel: (id: string) => void }) {
  const color = EVENT_COLORS[event.type] || "#6b7280";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="w-full max-w-md rounded-xl border shadow-xl" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)", borderLeft: `4px solid ${color}` }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{event.title}</h2>
            <p className="text-xs" style={{ color }}>
              {event.type}
            </p>
          </div>
          <button onClick={onClose} style={{ color: "var(--muted-foreground)" }}><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <Row label="Date" value={format(new Date(event.startAt), "EEEE, MMMM d, yyyy")} />
          <Row label="Time" value={`${format(new Date(event.startAt), "HH:mm")} – ${format(new Date(event.endAt), "HH:mm")}`} />
          {event.organizer && <Row label="Organizer" value={event.organizer.name} />}
          {event.participants?.length > 0 && <Row label="Participants" value={event.participants.map((p: any) => p.name).join(", ")} />}
          {event.branch && <Row label="Branch" value={event.branch.name} />}
          {event.contact && <Row label="Contact" value={`${event.contact.firstName} ${event.contact.lastName}`} />}
          {event.location && <Row label="Location" value={event.location} />}
          {event.meetingLink && <Row label="Link" value={event.meetingLink} />}
          {event.description && <Row label="Description" value={event.description} />}
          {event.notes && <Row label="Notes" value={event.notes} />}
        </div>
        <div className="flex justify-end gap-2 px-5 pb-4">
          <button onClick={() => onCancel(event.id)} className="px-3 py-1.5 rounded-md text-xs" style={{ color: "var(--destructive)", background: `var(--destructive)15` }}>
            Cancel Event
          </button>
          <button onClick={onClose} className="px-3 py-1.5 rounded-md text-xs" style={{ background: "var(--secondary)", color: "var(--foreground)" }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-xs" style={{ color: "var(--muted-foreground)" }}>{label}</dt>
      <dd className="text-xs break-all" style={{ color: "var(--foreground)" }}>{value}</dd>
    </div>
  );
}

function EventForm({ users, branches, contacts, defaultDate, onSubmit, onClose, loading }: any) {
  const d = defaultDate ?? new Date();
  const dateStr = format(d, "yyyy-MM-dd");
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  const startTime = hasTime ? format(d, "HH:mm") : "09:00";
  const endD = new Date(d.getTime() + 60 * 60 * 1000);
  const endTime = hasTime ? format(endD, "HH:mm") : "10:00";

  const [form, setForm] = useState({
    title: "", type: "MEETING",
    startAt: `${dateStr}T${startTime}`,
    endAt: `${dateStr}T${endTime}`,
    locationType: "offline" as "online" | "offline",
    location: "", meetingLink: "", description: "", notes: "",
    contactId: "", participantIds: [] as string[],
  });
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  function onStartChange(val: string) {
    set("startAt", val);
    if (val) {
      const end = new Date(val);
      end.setHours(end.getHours() + 1);
      set("endAt", format(end, "yyyy-MM-dd'T'HH:mm"));
    }
  }

  const quickDurations = [15, 30, 45, 60];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="w-full max-w-lg rounded-xl border shadow-xl" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>New Event</h2>
          <button onClick={onClose} style={{ color: "var(--muted-foreground)" }}><X size={18} /></button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              ...form,
              contactId: form.contactId || undefined,
              location: form.locationType === "offline" ? form.location || undefined : undefined,
              meetingLink: form.locationType === "online" ? form.meetingLink || undefined : undefined,
            });
          }}
          className="p-5 space-y-3 max-h-[70vh] overflow-y-auto"
        >
          <F label="Title" required><input value={form.title} onChange={(e) => set("title", e.target.value)} required className="fi" /></F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Type"><select value={form.type} onChange={(e) => set("type", e.target.value)} className="fi">{["MEETING","CALL","EVENT","FOLLOW_UP"].map((t) => <option key={t} value={t}>{t.replace("_"," ")}</option>)}</select></F>
            <F label="Contact"><select value={form.contactId} onChange={(e) => set("contactId", e.target.value)} className="fi"><option value="">None</option>{contacts.map((c: any) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}</select></F>
            <F label="Start Time">
              <input type="datetime-local" value={form.startAt} onChange={(e) => onStartChange(e.target.value)} required className="fi" />
            </F>
            <F label="End Time">
              <input type="datetime-local" value={form.endAt} onChange={(e) => set("endAt", e.target.value)} required className="fi" />
              <div className="flex gap-1 mt-1">
                {quickDurations.map((min) => (
                  <button
                    key={min}
                    type="button"
                    className="px-1.5 py-0.5 rounded text-xs border"
                    style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                    onClick={() => {
                      if (form.startAt) {
                        const end = new Date(form.startAt);
                        end.setMinutes(end.getMinutes() + min);
                        set("endAt", format(end, "yyyy-MM-dd'T'HH:mm"));
                      }
                    }}
                  >
                    {min}m
                  </button>
                ))}
              </div>
            </F>
          </div>

          {/* Location type toggle */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Location</label>
            <div className="flex rounded-md border overflow-hidden mb-2" style={{ borderColor: "var(--border)", width: "fit-content" }}>
              {(["offline", "online"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set("locationType", t)}
                  className="px-3 py-1.5 text-xs capitalize"
                  style={{
                    background: form.locationType === t ? "var(--secondary)" : "var(--card)",
                    color: form.locationType === t ? "var(--foreground)" : "var(--muted-foreground)",
                    borderRight: t === "offline" ? "1px solid var(--border)" : undefined,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            {form.locationType === "offline" ? (
              <input value={form.location} onChange={(e) => set("location", e.target.value)} className="fi" placeholder="Office, branch, city..." />
            ) : (
              <input value={form.meetingLink} onChange={(e) => set("meetingLink", e.target.value)} className="fi" placeholder="https://meet.google.com/..." />
            )}
          </div>

          <F label="Description"><textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} className="fi resize-none" /></F>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-md text-sm" style={{ color: "var(--muted-foreground)", background: "var(--secondary)" }}>Cancel</button>
            <button type="submit" disabled={loading} className="px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-60" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
              {loading ? "Creating..." : "Create Event"}
            </button>
          </div>
        </form>
        <style>{`.fi{width:100%;border:1px solid var(--border);border-radius:var(--radius);padding:6px 10px;font-size:13px;background:var(--background);color:var(--foreground);outline:none}input[type="datetime-local"]::-webkit-calendar-picker-indicator{filter:brightness(0) invert(1);opacity:0.55;cursor:pointer}input[type="date"]::-webkit-calendar-picker-indicator{filter:brightness(0) invert(1);opacity:0.55;cursor:pointer}`}</style>
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
