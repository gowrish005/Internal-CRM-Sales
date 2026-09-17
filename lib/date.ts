// All timestamps are stored as UTC instants in Mongo. Every place that
// creates, parses, filters, or displays a date must go through here so
// "today", "this week", and every rendered date/time are anchored to IST
// (Asia/Kolkata, UTC+5:30, no DST) — independent of the server's or the
// viewer's browser timezone.

export const IST_TIME_ZONE = "Asia/Kolkata";
const IST_OFFSET = "+05:30";

type DateInput = Date | string;

function toDate(input: DateInput): Date {
  return typeof input === "string" ? new Date(input) : input;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface ISTParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  weekday: number; // 0-6, Sunday first
}

// en-US + formatToParts gives us stable numeric fields for the Asia/Kolkata
// wall-clock time of an instant, regardless of the runtime's own timezone.
function getISTParts(date: Date): ISTParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekdayAbbr = get("weekday");

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    // Intl reports midnight as "24" with hour12: false in some engines.
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday: WEEKDAYS_SHORT.indexOf(weekdayAbbr),
  };
}

/** "YYYY-MM-DD" for the given instant, as seen in IST. */
export function istDateString(date: DateInput = new Date()): string {
  const { year, month, day } = getISTParts(toDate(date));
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Midnight IST (start of day) for the given instant, as a real Date/instant. */
export function startOfDayIST(date: DateInput = new Date()): Date {
  return new Date(`${istDateString(date)}T00:00:00${IST_OFFSET}`);
}

/** End of day (23:59:59.999 IST) for the given instant. */
export function endOfDayIST(date: DateInput = new Date()): Date {
  return new Date(`${istDateString(date)}T23:59:59.999${IST_OFFSET}`);
}

/** Adds whole days to an instant (elapsed-time math, timezone-agnostic). */
export function addDaysIST(date: DateInput, days: number): Date {
  return new Date(toDate(date).getTime() + days * 86400000);
}

/** Hour (0-23) and minute of an instant, as seen in IST. */
export function istHourMinute(date: DateInput): { hour: number; minute: number } {
  const { hour, minute } = getISTParts(toDate(date));
  return { hour, minute };
}

/** Minutes since IST midnight for the given instant — for calendar-grid positioning. */
export function istMinutesOfDay(date: DateInput): number {
  const { hour, minute } = getISTParts(toDate(date));
  return hour * 60 + minute;
}

/**
 * An instant at the given IST wall-clock hour/minute, on the same IST
 * calendar date as `day`. Used when a calendar grid cell (representing "this
 * IST day, this IST hour") is clicked to seed a new event's start time.
 */
export function istDateTimeAt(day: DateInput, hour: number, minute = 0): Date {
  return new Date(`${istDateString(day)}T${pad(hour)}:${pad(minute)}:00${IST_OFFSET}`);
}

/** True if the instant falls on today's IST calendar date. */
export function isTodayIST(date: DateInput): boolean {
  return istDateString(date) === istDateString(new Date());
}

/** True if the instant falls on tomorrow's IST calendar date. */
export function isTomorrowIST(date: DateInput): boolean {
  return istDateString(date) === istDateString(addDaysIST(new Date(), 1));
}

/** True if the instant is strictly before the current instant. */
export function isPastIST(date: DateInput): boolean {
  return toDate(date).getTime() < Date.now();
}

/**
 * Parses a date-only "YYYY-MM-DD" value (e.g. from `<input type="date">`)
 * as IST midnight, not UTC midnight.
 */
export function parseISTDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00${IST_OFFSET}`);
}

/**
 * Parses an offset-less "YYYY-MM-DDTHH:mm" value (e.g. from a
 * datetime-local-style input) as IST wall-clock time, not the parsing
 * runtime's local time.
 */
export function parseISTDateTime(value: string): Date {
  return new Date(`${value}:00${IST_OFFSET}`);
}

/** Formats a stored instant back to "YYYY-MM-DD" for `<input type="date">`, in IST. */
export function toISTDateInputValue(date: DateInput): string {
  return istDateString(date);
}

/** Formats a stored instant to "YYYY-MM-DDTHH:mm" for datetime-local-style inputs, in IST. */
export function toISTDateTimeInputValue(date: DateInput): string {
  const { year, month, day, hour, minute } = getISTParts(toDate(date));
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}

type FormatStyle =
  | "time" // 14:05
  | "day" // 17
  | "shortWeekday" // Thu
  | "shortWeekdayMonthDay" // Thu, Sep 17
  | "monthDay" // Sep 17
  | "monthDayYear" // Sep 17, 2026
  | "monthDayTime" // Sep 17, 14:05
  | "monthDayYearTime" // Sep 17, 2026 14:05
  | "weekdayMonthDay" // Thursday, September 17
  | "weekdayMonthDayYear" // Thursday, September 17, 2026
  | "fullMonthDayYear" // September 17, 2026
  | "monthYear" // September 2026
  | "dayMonth" // 17 Sep
  | "dayMonthYear" // 17 Sep 2026
  | "dayMonthTime"; // 17 Sep, 14:05

/** Formats an instant for display, always in IST. */
export function formatIST(date: DateInput, style: FormatStyle): string {
  const d = toDate(date);
  const { year, day, hour, minute, month, weekday } = getISTParts(d);
  const monthShort = MONTHS_SHORT[month - 1];
  const monthLong = MONTHS_LONG[month - 1];
  const weekdayShort = WEEKDAYS_SHORT[weekday];
  const weekdayLong = WEEKDAYS_LONG[weekday];
  const time = `${pad(hour)}:${pad(minute)}`;

  switch (style) {
    case "time":
      return time;
    case "day":
      return String(day);
    case "shortWeekday":
      return weekdayShort;
    case "shortWeekdayMonthDay":
      return `${weekdayShort}, ${monthShort} ${day}`;
    case "monthDay":
      return `${monthShort} ${day}`;
    case "monthDayYear":
      return `${monthShort} ${day}, ${year}`;
    case "monthDayTime":
      return `${monthShort} ${day}, ${time}`;
    case "monthDayYearTime":
      return `${monthShort} ${day}, ${year} ${time}`;
    case "weekdayMonthDay":
      return `${weekdayLong}, ${monthLong} ${day}`;
    case "weekdayMonthDayYear":
      return `${weekdayLong}, ${monthLong} ${day}, ${year}`;
    case "fullMonthDayYear":
      return `${monthLong} ${day}, ${year}`;
    case "monthYear":
      return `${monthLong} ${year}`;
    case "dayMonth":
      return `${day} ${monthShort}`;
    case "dayMonthYear":
      return `${day} ${monthShort} ${year}`;
    case "dayMonthTime":
      return `${day} ${monthShort}, ${time}`;
  }
}
