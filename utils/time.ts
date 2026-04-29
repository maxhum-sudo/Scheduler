export const HOUR_START = 8;  // 8 AM
export const HOUR_END = 22;   // up to but not including 10 PM (last slot = 9 PM)
export const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

/** Returns array of 7 Date objects starting from today (midnight local time) */
export function getNext7Days(): Date[] {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

/** Returns an ISO string for a given day + hour in local time, stored as UTC */
export function slotToISO(day: Date, hour: number): string {
  const d = new Date(day);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export function formatDayHeader(day: Date): string {
  return day.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
}

export function formatHour(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const h = hour > 12 ? hour - 12 : hour;
  return `${h}${suffix}`;
}
