/** Extract string value from an input/select event. */
export function inputValue(e: Event): string {
  return (e.target as HTMLInputElement).value;
}

/** Extract checked state from a checkbox event. */
export function checkboxChecked(e: Event): boolean {
  return (e.target as HTMLInputElement).checked;
}

/** Extract string value from a select element event. */
export function selectValue(e: Event): string {
  return (e.target as HTMLSelectElement).value;
}

/** Parse an integer input, clamped to [min, max]. Falls back to min on NaN. */
export function clampedInt(e: Event, min: number, max: number): number {
  const parsed = parseInt((e.target as HTMLInputElement).value, 10);
  return Math.max(min, Math.min(max, isNaN(parsed) ? min : parsed));
}

/** Normalize a raw time string to HH:MM format by stripping non-digits. */
export function normalizeTime24(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/** Return true if value is a valid HH:MM 24-hour string. */
export function isValidTime24(value: string): boolean {
  return /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
}

/** Convert a CustomEvent<{value:string}> to its string value. */
export function customInputValue(e: Event): string {
  return (e as CustomEvent<{ value: string }>).detail.value;
}
