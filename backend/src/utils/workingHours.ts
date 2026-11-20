// LIFC working-hours calendar for SLAs (all departments, all SLA policies):
//   Monday–Saturday 09:45–18:45 India time (IST, UTC+5:30, no daylight saving).
//   Not working: Sundays, the 2nd Saturday of the month, and listed holidays (YYYY-MM-DD, IST).
// The SLA clock only runs inside these hours — it is paused every evening after 18:45, on Sundays
// and on 2nd Saturdays, and resumes at 09:45 on the next working day.
// Uses explicit IST arithmetic, so the server's own timezone (UTC on EC2) doesn't matter.
// Unit-tested in src/__tests__/working_hours.test.ts.

export const WORK_START_MIN = 9 * 60 + 45;  // 09:45
export const WORK_END_MIN = 18 * 60 + 45;   // 18:45
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

/** Midnight IST (as a UTC instant) of the IST day containing `d`. */
function istDayStart(d: Date): number {
  const shifted = d.getTime() + IST_OFFSET_MS;
  return Math.floor(shifted / DAY_MS) * DAY_MS - IST_OFFSET_MS;
}

/** IST calendar parts of an instant. */
function istParts(d: Date): { y: number; m: number; day: number; dow: number; minuteOfDay: number; dateStr: string } {
  const s = new Date(d.getTime() + IST_OFFSET_MS); // read with getUTC* = IST wall clock
  const y = s.getUTCFullYear(), m = s.getUTCMonth() + 1, day = s.getUTCDate();
  return {
    y, m, day,
    dow: s.getUTCDay(), // 0 = Sunday
    minuteOfDay: s.getUTCHours() * 60 + s.getUTCMinutes() + s.getUTCSeconds() / 60,
    dateStr: `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
}

/** Is the IST calendar day containing `d` a working day? */
export function isWorkingDay(d: Date, holidays: string[] = []): boolean {
  const p = istParts(d);
  if (p.dow === 0) return false;                                   // Sunday
  if (p.dow === 6 && p.day >= 8 && p.day <= 14) return false;      // 2nd Saturday
  if (holidays.includes(p.dateStr)) return false;                  // listed holiday
  return true;
}

/** Is the SLA clock running at this instant? */
export function isWorkingTime(d: Date, holidays: string[] = []): boolean {
  if (!isWorkingDay(d, holidays)) return false;
  const m = istParts(d).minuteOfDay;
  return m >= WORK_START_MIN && m < WORK_END_MIN;
}

/** Start of the next working period at or after `d` (returns `d` itself if inside working hours). */
export function nextWorkingStart(d: Date, holidays: string[] = []): Date {
  let day = istDayStart(d);
  let t = d.getTime();
  for (let i = 0; i < 400; i++) {
    const dayDate = new Date(day);
    if (isWorkingDay(dayDate, holidays)) {
      const open = day + WORK_START_MIN * MIN_MS;
      const close = day + WORK_END_MIN * MIN_MS;
      if (t < open) return new Date(open);
      if (t < close) return new Date(t);
    }
    day += DAY_MS;
    t = day;
  }
  return new Date(d);
}

/** Add `minutes` of working time to `start`. */
export function addWorkingMinutes(start: Date, minutes: number, holidays: string[] = []): Date {
  let remaining = Math.max(0, minutes) * MIN_MS;
  let cur = nextWorkingStart(start, holidays).getTime();
  for (let i = 0; i < 2000 && remaining > 0; i++) {
    const close = istDayStart(new Date(cur)) + WORK_END_MIN * MIN_MS;
    const available = close - cur;
    if (remaining <= available) return new Date(cur + remaining);
    remaining -= available;
    cur = nextWorkingStart(new Date(close), holidays).getTime();
  }
  return new Date(cur);
}

/** Working minutes between two instants (0 if `to` is not after `from`). */
export function workingMinutesBetween(from: Date, to: Date, holidays: string[] = []): number {
  if (to.getTime() <= from.getTime()) return 0;
  let total = 0;
  let cur = nextWorkingStart(from, holidays).getTime();
  const end = to.getTime();
  for (let i = 0; i < 2000 && cur < end; i++) {
    const close = istDayStart(new Date(cur)) + WORK_END_MIN * MIN_MS;
    total += Math.min(close, end) - cur;
    if (end <= close) break;
    cur = nextWorkingStart(new Date(close), holidays).getTime();
  }
  return Math.round(total / MIN_MS);
}
