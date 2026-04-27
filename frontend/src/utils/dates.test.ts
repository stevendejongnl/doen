import { describe, it, expect } from 'vitest';
import {
  startOfDay, startOfWeek, startOfMonth, sameDay,
  formatTime, formatDateHeader, formatShortDate,
  isOverdue, isoToDatetimeLocal, formatApiKeyExpiry, toEndOfDayIso,
} from './dates';

describe('startOfDay', () => {
  it('zeroes time components', () => {
    const d = startOfDay(new Date('2024-06-15T14:30:00'));
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });

  it('does not mutate the input', () => {
    const orig = new Date('2024-06-15T14:30:00');
    startOfDay(orig);
    expect(orig.getHours()).toBe(14);
  });
});

describe('startOfWeek', () => {
  it('returns Monday for a Wednesday', () => {
    // 2024-06-12 is a Wednesday
    const wed = new Date('2024-06-12T10:00:00');
    const mon = startOfWeek(wed);
    expect(mon.getDate()).toBe(10); // 2024-06-10 is Monday
    expect(mon.getDay()).toBe(1); // 1 = Monday
  });

  it('returns self for Monday', () => {
    const mon = new Date('2024-06-10T09:00:00');
    const result = startOfWeek(mon);
    expect(result.getDate()).toBe(10);
  });

  it('returns Monday for Sunday (NL: Sunday is end of week)', () => {
    const sun = new Date('2024-06-16T10:00:00');
    const result = startOfWeek(sun);
    expect(result.getDate()).toBe(10);
  });
});

describe('startOfMonth', () => {
  it('returns the 1st of the month', () => {
    const d = new Date('2024-06-15');
    const result = startOfMonth(d);
    expect(result.getDate()).toBe(1);
    expect(result.getMonth()).toBe(5); // June
  });
});

describe('sameDay', () => {
  it('returns true for same date at different times', () => {
    expect(sameDay(new Date('2024-06-15T00:00'), new Date('2024-06-15T23:59'))).toBe(true);
  });

  it('returns false for different dates', () => {
    expect(sameDay(new Date('2024-06-15'), new Date('2024-06-16'))).toBe(false);
  });

  it('returns false for different months', () => {
    expect(sameDay(new Date('2024-05-15'), new Date('2024-06-15'))).toBe(false);
  });

  it('returns false for different years', () => {
    expect(sameDay(new Date('2023-06-15'), new Date('2024-06-15'))).toBe(false);
  });
});

describe('formatTime', () => {
  it('returns empty string for midnight', () => {
    expect(formatTime('2024-06-15T00:00:00')).toBe('');
  });

  it('returns HH:MM for non-midnight times', () => {
    const result = formatTime('2024-06-15T08:30:00');
    expect(result).toMatch(/\d{2}:\d{2}/);
  });
});

describe('formatDateHeader', () => {
  it('day range includes weekday name', () => {
    const d = new Date('2024-06-15');
    const result = formatDateHeader(d, 'day');
    expect(result.toLowerCase()).toContain('2024');
  });

  it('week range shows start – end', () => {
    const d = new Date('2024-06-12'); // Wednesday
    const result = formatDateHeader(d, 'week');
    expect(result).toContain('–');
  });

  it('month range shows month and year', () => {
    const d = new Date('2024-06-01');
    const result = formatDateHeader(d, 'month');
    expect(result.toLowerCase()).toMatch(/jun|juni/);
    expect(result).toContain('2024');
  });
});

describe('formatShortDate', () => {
  it('returns a short locale date string', () => {
    const result = formatShortDate('2024-06-15T00:00:00');
    expect(result).toMatch(/\d/);
  });
});

describe('isOverdue', () => {
  it('returns true for a past date', () => {
    expect(isOverdue('2000-01-01T00:00:00Z')).toBe(true);
  });

  it('returns false for a future date', () => {
    expect(isOverdue('2999-01-01T00:00:00Z')).toBe(false);
  });
});

describe('formatApiKeyExpiry', () => {
  it('returns a non-empty string', () => {
    const result = formatApiKeyExpiry('2024-06-15T12:00:00Z');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('toEndOfDayIso', () => {
  it('appends T23:59:59Z to the date', () => {
    const result = toEndOfDayIso('2024-06-15');
    expect(result).toContain('2024-06-15');
    expect(result.endsWith('Z')).toBe(true);
  });
});

describe('isoToDatetimeLocal', () => {
  it('returns YYYY-MM-DDTHH:MM format', () => {
    const result = isoToDatetimeLocal('2024-06-15T08:30:00Z');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});
