import { describe, it, expect } from 'vitest';
import { addWorkingMinutes, workingMinutesBetween, isWorkingTime, isWorkingDay, nextWorkingStart } from '../utils/workingHours';

// Helper: an IST wall-clock time as a Date (IST = UTC+5:30).
const ist = (s: string) => new Date(`${s}+05:30`);
const fmt = (d: Date) => new Date(d.getTime() + 5.5 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');

// November 2026: Sun 1/8/15/22/29; 2nd Saturday = 14 Nov; other Saturdays 7/21/28 are working.
describe('working days', () => {
  it('Sunday and the 2nd Saturday are off; other Saturdays work', () => {
    expect(isWorkingDay(ist('2026-11-15T12:00:00'))).toBe(false); // Sunday
    expect(isWorkingDay(ist('2026-11-14T12:00:00'))).toBe(false); // 2nd Saturday
    expect(isWorkingDay(ist('2026-11-21T12:00:00'))).toBe(true);  // 3rd Saturday
    expect(isWorkingDay(ist('2026-11-07T12:00:00'))).toBe(true);  // 1st Saturday
    expect(isWorkingDay(ist('2026-11-18T12:00:00'))).toBe(true);  // Wednesday
  });
  it('listed holidays are off', () => {
    expect(isWorkingDay(ist('2026-11-18T12:00:00'), ['2026-11-18'])).toBe(false);
  });
});

describe('working hours are 09:45–18:45 IST', () => {
  it('clock runs inside, stops outside', () => {
    expect(isWorkingTime(ist('2026-11-18T09:44:00'))).toBe(false);
    expect(isWorkingTime(ist('2026-11-18T09:45:00'))).toBe(true);
    expect(isWorkingTime(ist('2026-11-18T18:44:00'))).toBe(true);
    expect(isWorkingTime(ist('2026-11-18T18:45:00'))).toBe(false);
  });
  it('after 18:45 the next start is 09:45 next working day; Saturday evening jumps over Sunday', () => {
    expect(fmt(nextWorkingStart(ist('2026-11-18T19:30:00')))).toBe('2026-11-19 09:45');
    expect(fmt(nextWorkingStart(ist('2026-11-21T18:50:00')))).toBe('2026-11-23 09:45'); // Sat -> Mon
    expect(fmt(nextWorkingStart(ist('2026-11-13T19:00:00')))).toBe('2026-11-16 09:45'); // Fri -> (2nd Sat, Sun) -> Mon
  });
});

describe('addWorkingMinutes — SLA deadlines', () => {
  it('within the same day', () => {
    expect(fmt(addWorkingMinutes(ist('2026-11-18T11:50:00'), 240))).toBe('2026-11-18 15:50');
  });
  it('TKT-26-00083: raised 11:50, 8h SLA -> due next morning 10:50, not 22:30 the same night', () => {
    expect(fmt(addWorkingMinutes(ist('2026-11-18T11:50:00'), 480))).toBe('2026-11-19 10:50');
  });
  it('raised after hours: clock starts at 09:45 next working day', () => {
    expect(fmt(addWorkingMinutes(ist('2026-11-18T21:00:00'), 60))).toBe('2026-11-19 10:45');
  });
  it('raised Friday evening before 2nd Saturday: skips Saturday 14th and Sunday 15th', () => {
    expect(fmt(addWorkingMinutes(ist('2026-11-13T18:00:00'), 120))).toBe('2026-11-16 11:00'); // 45 min Fri + 75 min Mon
  });
  it('raised on a working Saturday afternoon: continues Monday', () => {
    expect(fmt(addWorkingMinutes(ist('2026-11-21T17:45:00'), 120))).toBe('2026-11-23 10:45');
  });
  it('a full working day is 9 hours', () => {
    expect(fmt(addWorkingMinutes(ist('2026-11-18T09:45:00'), 540))).toBe('2026-11-18 18:45');
  });
});

describe('workingMinutesBetween', () => {
  it('counts only working time', () => {
    expect(workingMinutesBetween(ist('2026-11-18T18:00:00'), ist('2026-11-19T10:45:00'))).toBe(45 + 60);
    expect(workingMinutesBetween(ist('2026-11-13T18:00:00'), ist('2026-11-16T11:00:00'))).toBe(120);
    expect(workingMinutesBetween(ist('2026-11-15T10:00:00'), ist('2026-11-15T16:00:00'))).toBe(0); // Sunday
  });
  it('is the inverse of addWorkingMinutes', () => {
    const start = ist('2026-11-20T16:10:00');
    for (const m of [5, 90, 480, 1440, 3000]) {
      expect(workingMinutesBetween(start, addWorkingMinutes(start, m))).toBe(m);
    }
  });
});
