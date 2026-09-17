"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addDays, addWeeks, addMonths, subWeeks, subMonths,
  eachDayOfInterval,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { createPortal } from "react-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { createEvent, cancelEvent } from "@/lib/actions/events";
import {
  formatIST, istDateString, isTodayIST, istMinutesOfDay, istDateTimeAt,
  istHourMinute, startOfDayIST,
} from "@/lib/date";

type View = "week" | "month" | "day" | "agenda";

const EVENT_COLORS: Record<string, string> = {
  MEETING: "#3b82f6", CALL: "#10b981", EVENT: "#8b5cf6", FOLLOW_UP: "#f59e0b",
};

interface Props {
  events: any[];
  users: any[];
  contacts: any[];
  currentUserId?: string;
  currentUserRole?: string;
}

export function CalendarClient({ events: initialEvents, users, contacts, currentUserId, currentUserRole }: Props) {
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

  // Admin sees every other user's calendar; others see fellow founders/admins. Never list self (that's "My Calendar").
  const otherCalendars = users.filter((u: any) =>
    u.id !== currentUserId &&
    (currentUserRole === "ADMIN" || u.role === "FOUNDER" || u.role === "ADMIN")
  );

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
              ? `${formatIST(startOfWeek(current, { weekStartsOn: 1 }), "monthDay")} – ${formatIST(endOfWeek(current, { weekStartsOn: 1 }), "monthDayYear")}`
              : view === "month"
              ? formatIST(current, "monthYear")
              : formatIST(current, "fullMonthDayYear")}
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
            {otherCalendars.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
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
    return events.filter((e: any) => istDateString(e.startAt) === istDateString(day));
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
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{formatIST(day, "shortWeekday")}</p>
            <p
              className="text-sm font-medium"
              style={{ color: isTodayIST(day) ? "var(--primary)" : "var(--foreground)" }}
            >
              {formatIST(day, "day")}
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
                return (
                  <div
                    key={day.toISOString()}
                    className="flex-1 border-r cursor-pointer transition-colors"
                    style={{ borderColor: "var(--border)" }}
                    onClick={() => onCellClick(istDateTimeAt(day, h))}
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
              const startMin = istMinutesOfDay(ev.startAt);
              const endMin = istMinutesOfDay(ev.endAt);
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
                  <p className="text-xs opacity-80">{formatIST(ev.startAt, "time")}</p>
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
          const dayEvents = events.filter((e: any) => istDateString(e.startAt) === istDateString(day));
          return (
            <div
              key={day.toISOString()}
              className="border-r border-b p-1 min-h-[80px] cursor-pointer hover:bg-[var(--muted)]"
              style={{ borderColor: "var(--border)", opacity: istDateString(day).slice(0, 7) === istDateString(current).slice(0, 7) ? 1 : 0.4 }}
              onClick={() => onDayClick(day)}
            >
              <p
                className="text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full"
                style={isTodayIST(day) ? { background: "var(--primary)", color: "white" } : { color: "var(--foreground)" }}
              >
                {formatIST(day, "day")}
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
    .filter((e: any) => istDateString(e.startAt) === istDateString(current))
    .sort((a: any, b: any) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  return (
    <div className="p-4 space-y-2 overflow-y-auto" style={{ background: "var(--card)" }}>
      <h3 className="text-sm font-medium mb-4" style={{ color: "var(--foreground)" }}>{formatIST(current, "weekdayMonthDay")}</h3>
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
    .filter((e) => new Date(e.startAt) >= startOfDayIST())
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 50);

  let lastDate = "";
  return (
    <div className="overflow-y-auto p-4 space-y-1" style={{ background: "var(--card)" }}>
      {sorted.length === 0 ? (
        <p className="text-sm text-center py-12" style={{ color: "var(--muted-foreground)" }}>No upcoming events</p>
      ) : sorted.map((ev) => {
        const dateStr = formatIST(ev.startAt, "shortWeekdayMonthDay");
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
        {formatIST(event.startAt, "time")}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{event.title}</p>
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          {formatIST(event.startAt, "time")} – {formatIST(event.endAt, "time")}
          {event.organizer && ` · ${event.organizer.name}`}
        </p>
      </div>
    </div>
  );
}

function EventDetail({ event, onClose, onCancel }: { event: any; onClose: () => void; onCancel: (id: string) => void }) {
  const color = EVENT_COLORS[event.type] || "#6b7280";
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl border shadow-2xl" style={{ background: "#111e14", borderColor: "#1e3322" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#1e3322", borderLeft: `4px solid ${color}` }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{event.title}</h2>
            <p className="text-xs" style={{ color }}>
              {event.type}
            </p>
          </div>
          <button onClick={onClose} style={{ color: "var(--muted-foreground)" }}><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <Row label="Date" value={formatIST(event.startAt, "weekdayMonthDayYear")} />
          <Row label="Time" value={`${formatIST(event.startAt, "time")} – ${formatIST(event.endAt, "time")}`} />
          {event.organizer && <Row label="Organizer" value={event.organizer.name} />}
          {event.participants?.length > 0 && <Row label="Participants" value={event.participants.map((p: any) => p.name).join(", ")} />}
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
    </div>,
    document.body
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

function EventForm({ users, contacts, defaultDate, onSubmit, onClose, loading }: any) {
  const d = defaultDate ?? new Date();
  const dateStr = istDateString(d);
  const { hour: dHour, minute: dMinute } = istHourMinute(d);
  const hasTime = dHour !== 0 || dMinute !== 0;
  const startTime = hasTime ? formatIST(d, "time") : "09:00";
  const endD = new Date(d.getTime() + 60 * 60 * 1000);
  const endTime = hasTime ? formatIST(endD, "time") : "10:00";

  const [form, setForm] = useState({
    title: "", type: "MEETING",
    startAt: `${dateStr}T${startTime}`,
    endAt: `${dateStr}T${endTime}`,
    locationType: "offline" as "online" | "offline",
    location: "", meetingLink: "", description: "", notes: "",
    contactId: "", participantIds: [] as string[],
  });
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const toLocal = (dt: Date) => format(dt, "yyyy-MM-dd'T'HH:mm");

  function onStartChange(dt: Date | null) {
    if (!dt) return;
    set("startAt", toLocal(dt));
    // Keep end 1h after start if end is before/equal new start
    const curEnd = form.endAt ? new Date(form.endAt) : null;
    if (!curEnd || curEnd <= dt) {
      const end = new Date(dt.getTime() + 60 * 60 * 1000);
      set("endAt", toLocal(end));
    }
  }

  const quickDurations = [15, 30, 45, 60];

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-2xl border shadow-2xl flex flex-col max-h-[90vh]" style={{ background: "#111e14", borderColor: "#1e3322" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#1e3322" }}>
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
            {contacts.length > 0 && (<F label="Contact"><select value={form.contactId} onChange={(e) => set("contactId", e.target.value)} className="fi"><option value="">None</option>{contacts.map((c: any) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}</select></F>)}
            <F label="Start Time">
              <DatePicker
                selected={form.startAt ? new Date(form.startAt) : null}
                onChange={onStartChange}
                showTimeSelect
                timeIntervals={15}
                minDate={new Date()}
                dateFormat="MMM d, yyyy  h:mm aa"
                timeFormat="h:mm aa"
                placeholderText="Pick start"
                className="fi"
                popperClassName="hc-dp-popper"
                wrapperClassName="w-full"
              />
            </F>
            <F label="End Time">
              <DatePicker
                selected={form.endAt ? new Date(form.endAt) : null}
                onChange={(dt: Date | null) => dt && set("endAt", toLocal(dt))}
                showTimeSelect
                timeIntervals={15}
                minDate={form.startAt ? new Date(form.startAt) : new Date()}
                dateFormat="MMM d, yyyy  h:mm aa"
                timeFormat="h:mm aa"
                placeholderText="Pick end"
                className="fi"
                popperClassName="hc-dp-popper"
                wrapperClassName="w-full"
              />
              <div className="flex gap-1 mt-1.5">
                {quickDurations.map((min) => (
                  <button
                    key={min}
                    type="button"
                    className="px-2 py-0.5 rounded-md text-xs border transition-colors"
                    style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                    onClick={() => {
                      if (form.startAt) {
                        const end = new Date(form.startAt);
                        end.setMinutes(end.getMinutes() + min);
                        set("endAt", toLocal(end));
                      }
                    }}
                  >
                    +{min}m
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
              <input value={form.location} onChange={(e) => set("location", e.target.value)} className="fi" placeholder="Office, city..." />
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
        <style>{`
          .fi{width:100%;border:1px solid var(--border);border-radius:var(--radius);padding:6px 10px;font-size:13px;background:var(--background);color:var(--foreground);outline:none}
          input[type="datetime-local"]::-webkit-calendar-picker-indicator,input[type="date"]::-webkit-calendar-picker-indicator{filter:brightness(0) invert(1);opacity:0.55;cursor:pointer}
          .react-datepicker{background:#111e14;border:1px solid #1e3322;font-family:inherit;color:#e8e8e8}
          .react-datepicker__header{background:#0f1a12;border-bottom:1px solid #1e3322}
          .react-datepicker__current-month,.react-datepicker-time__header,.react-datepicker__day-name{color:#e8e8e8}
          .react-datepicker__day{color:#c8c8c8}
          .react-datepicker__day:hover{background:#1a2e1e}
          .react-datepicker__day--selected,.react-datepicker__day--keyboard-selected{background:#22c55e!important;color:#071209!important}
          .react-datepicker__day--disabled{color:#3a4a3d}
          .react-datepicker__time-container{border-left:1px solid #1e3322}
          .react-datepicker__time,.react-datepicker__time-box,.react-datepicker__time-list{background:#111e14!important}
          .react-datepicker__header--time{background:#0f1a12!important}
          .react-datepicker-time__header{color:#e8e8e8}
          .react-datepicker__time-list-item{color:#c8c8c8!important}
          .react-datepicker__time-list-item:hover{background:#1a2e1e!important}
          .react-datepicker__time-list-item--selected{background:#22c55e!important;color:#071209!important}
          .react-datepicker__time-list-item--disabled{color:#3a4a3d!important}
          .react-datepicker__time-list::-webkit-scrollbar{width:6px}
          .react-datepicker__time-list::-webkit-scrollbar-thumb{background:#1e3322;border-radius:3px}
          .react-datepicker__triangle{display:none}
          .react-datepicker__navigation-icon::before{border-color:#4ade80}
        `}</style>
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
