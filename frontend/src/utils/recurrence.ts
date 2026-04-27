import type { RecurrenceParity, RecurrenceUnit } from '../services/types';

export const DAY_LABELS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];

export function toggleWeekday(current: Set<number>, n: number): Set<number> {
  const next = new Set(current);
  if (next.has(n)) next.delete(n);
  else next.add(n);
  return next;
}

export function weekdaysToCsv(s: Set<number>): string | null {
  if (s.size === 0) return null;
  return [...s].sort((a, b) => a - b).join(',');
}

export function weekdaysFromCsv(csv: string | null | undefined): Set<number> {
  if (!csv) return new Set([0]);
  return new Set(csv.split(',').map(Number).filter(n => !isNaN(n)));
}

export function describeDraft(
  unit: RecurrenceUnit,
  interval: number,
  weekdays: Set<number>,
  monthDay: number,
  timeOfDay: string,
  parity: RecurrenceParity,
): string {
  let base = '';
  if (unit === 'day') {
    base = interval > 1 ? `Elke ${interval} dagen` : 'Dagelijks';
  } else if (unit === 'week') {
    const days = [...weekdays].sort((a, b) => a - b).map(n => DAY_LABELS[n]).join(', ');
    const prefix = interval > 1 ? `Elke ${interval} weken` : 'Wekelijks';
    base = days ? `${prefix} op ${days}` : prefix;
  } else {
    base = interval > 1 ? `Elke ${interval} maanden op dag ${monthDay}` : `Maandelijks op dag ${monthDay}`;
  }
  let suffix = '';
  if (parity === 'odd') suffix = unit === 'week' ? ' · oneven weken' : ' · oneven';
  if (parity === 'even') suffix = unit === 'week' ? ' · even weken' : ' · even';
  return `${base}${suffix} · ${timeOfDay}`;
}

export function parityLabel(unit: RecurrenceUnit): string {
  if (unit === 'week') return 'weken';
  if (unit === 'month') return 'maanden';
  return 'dagen';
}

export function parseWeekdays(csv: string | null | undefined): Set<number> {
  if (!csv) return new Set();
  return new Set(csv.split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n) && n >= 0 && n <= 6));
}

export function describeRule(rule: import('../services/types').RecurringRule): string {
  const interval = Math.max(1, rule.interval ?? 1);
  let base = '';
  if (rule.unit === 'day') {
    base = interval > 1 ? `Elke ${interval} dagen` : 'Dagelijks';
  } else if (rule.unit === 'week') {
    const days = [...parseWeekdays(rule.weekdays)].sort((a, b) => a - b).map(n => DAY_LABELS[n]).join(', ');
    const prefix = interval > 1 ? `Elke ${interval} weken` : 'Wekelijks';
    base = days ? `${prefix} op ${days}` : prefix;
  } else if (rule.unit === 'month') {
    const dayBit = rule.month_day ? ` op dag ${rule.month_day}` : '';
    base = interval > 1 ? `Elke ${interval} maanden${dayBit}` : `Maandelijks${dayBit}`;
  }
  let suffix = '';
  if (rule.parity === 'odd') suffix = rule.unit === 'week' ? ' · oneven weken' : ' · oneven';
  if (rule.parity === 'even') suffix = rule.unit === 'week' ? ' · even weken' : ' · even';
  return `${base}${suffix} · ${rule.time_of_day ?? '08:00'}`;
}
