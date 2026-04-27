export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // 0 = Monday (NL)
  x.setDate(x.getDate() - dow);
  return x;
}

export function startOfMonth(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (d.getHours() === 0 && d.getMinutes() === 0) return '';
  return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
}

export type CalendarRange = 'day' | 'week' | 'month';

export function formatDateHeader(anchor: Date, range: CalendarRange): string {
  if (range === 'day') {
    return anchor.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  if (range === 'week') {
    const start = startOfWeek(anchor);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const sm = start.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
    const em = end.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${sm} – ${em}`;
  }
  return anchor.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

export function isOverdue(iso: string): boolean {
  return new Date(iso) < new Date();
}

export function isoToDatetimeLocal(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16);
}

export function formatApiKeyExpiry(iso: string): string {
  return new Date(iso).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' });
}

export function toEndOfDayIso(dateStr: string): string {
  return new Date(`${dateStr}T23:59:59Z`).toISOString();
}
