import { describe, it, expect } from 'vitest';
import {
  inputValue, checkboxChecked, selectValue,
  clampedInt, normalizeTime24, isValidTime24, customInputValue,
} from './form';

function makeInputEvent(value: string): Event {
  const input = document.createElement('input');
  input.value = value;
  const e = new Event('input');
  Object.defineProperty(e, 'target', { value: input, writable: false });
  return e;
}

function makeSelectEvent(value: string): Event {
  const select = document.createElement('select');
  const option = document.createElement('option');
  option.value = value;
  select.appendChild(option);
  select.value = value;
  const e = new Event('change');
  Object.defineProperty(e, 'target', { value: select, writable: false });
  return e;
}

function makeCheckboxEvent(checked: boolean): Event {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  const e = new Event('change');
  Object.defineProperty(e, 'target', { value: input, writable: false });
  return e;
}

describe('inputValue', () => {
  it('extracts value from input event', () => {
    expect(inputValue(makeInputEvent('hello'))).toBe('hello');
  });

  it('returns empty string for empty input', () => {
    expect(inputValue(makeInputEvent(''))).toBe('');
  });
});

describe('checkboxChecked', () => {
  it('returns true when checked', () => {
    expect(checkboxChecked(makeCheckboxEvent(true))).toBe(true);
  });

  it('returns false when unchecked', () => {
    expect(checkboxChecked(makeCheckboxEvent(false))).toBe(false);
  });
});

describe('selectValue', () => {
  it('extracts value from select event', () => {
    expect(selectValue(makeSelectEvent('foo'))).toBe('foo');
  });
});

describe('clampedInt', () => {
  it('returns parsed value within range', () => {
    expect(clampedInt(makeInputEvent('5'), 1, 10)).toBe(5);
  });

  it('clamps to min on NaN', () => {
    expect(clampedInt(makeInputEvent('abc'), 1, 10)).toBe(1);
  });

  it('clamps to min when below', () => {
    expect(clampedInt(makeInputEvent('0'), 1, 10)).toBe(1);
  });

  it('clamps to max when above', () => {
    expect(clampedInt(makeInputEvent('99'), 1, 10)).toBe(10);
  });

  it('returns min when empty', () => {
    expect(clampedInt(makeInputEvent(''), 1, 365)).toBe(1);
  });
});

describe('normalizeTime24', () => {
  it.each([
    ['08:30', '08:30'],
    ['0830', '08:30'],
    ['8', '8'],
    ['083', '08:3'],
    ['abc', ''],
    ['08:3x', '08:3'],
  ])('normalizeTime24(%s) → %s', (input, expected) => {
    expect(normalizeTime24(input)).toBe(expected);
  });
});

describe('isValidTime24', () => {
  it.each([
    ['08:00', true],
    ['23:59', true],
    ['24:00', false],
    ['8:00', false],
    ['8:0', false],
    ['ab:cd', false],
    ['', false],
  ])('isValidTime24(%s) → %s', (input, expected) => {
    expect(isValidTime24(input)).toBe(expected);
  });
});

describe('customInputValue', () => {
  it('extracts detail.value from CustomEvent', () => {
    const e = new CustomEvent('doen-input', { detail: { value: 'custom-val' } });
    expect(customInputValue(e)).toBe('custom-val');
  });
});
