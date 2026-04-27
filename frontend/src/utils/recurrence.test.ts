import { describe, it, expect } from 'vitest';
import {
  toggleWeekday, weekdaysToCsv, weekdaysFromCsv,
  describeDraft, parityLabel, parseWeekdays, describeRule,
} from './recurrence';
import type { RecurringRule } from '../services/types';

describe('toggleWeekday', () => {
  it('adds a weekday when absent', () => {
    const result = toggleWeekday(new Set([0, 2]), 4);
    expect(result.has(4)).toBe(true);
    expect(result.size).toBe(3);
  });

  it('removes a weekday when present', () => {
    const result = toggleWeekday(new Set([0, 2, 4]), 2);
    expect(result.has(2)).toBe(false);
    expect(result.size).toBe(2);
  });

  it('does not mutate the input set', () => {
    const orig = new Set([0, 2]);
    toggleWeekday(orig, 4);
    expect(orig.size).toBe(2);
  });
});

describe('weekdaysToCsv', () => {
  it('returns null for empty set', () => {
    expect(weekdaysToCsv(new Set())).toBeNull();
  });

  it('returns sorted comma-separated string', () => {
    expect(weekdaysToCsv(new Set([4, 0, 2]))).toBe('0,2,4');
  });

  it('handles single value', () => {
    expect(weekdaysToCsv(new Set([3]))).toBe('3');
  });
});

describe('weekdaysFromCsv', () => {
  it('returns Set([0]) for null', () => {
    expect(weekdaysFromCsv(null)).toEqual(new Set([0]));
  });

  it('returns Set([0]) for undefined', () => {
    expect(weekdaysFromCsv(undefined)).toEqual(new Set([0]));
  });

  it('parses csv string', () => {
    expect(weekdaysFromCsv('0,2,4')).toEqual(new Set([0, 2, 4]));
  });
});

describe('describeDraft', () => {
  it('describes daily interval=1', () => {
    expect(describeDraft('day', 1, new Set([0]), 1, '08:00', 'any')).toBe('Dagelijks · 08:00');
  });

  it('describes daily interval>1', () => {
    expect(describeDraft('day', 3, new Set([0]), 1, '09:00', 'any')).toBe('Elke 3 dagen · 09:00');
  });

  it('describes weekly with days', () => {
    const result = describeDraft('week', 1, new Set([0, 4]), 1, '08:00', 'any');
    expect(result).toContain('Wekelijks op ma, vr');
  });

  it('describes weekly interval>1', () => {
    const result = describeDraft('week', 2, new Set([0]), 1, '08:00', 'any');
    expect(result).toContain('Elke 2 weken');
  });

  it('describes monthly', () => {
    const result = describeDraft('month', 1, new Set([0]), 15, '08:00', 'any');
    expect(result).toContain('Maandelijks op dag 15');
  });

  it('appends odd parity for week', () => {
    const result = describeDraft('week', 1, new Set([0]), 1, '08:00', 'odd');
    expect(result).toContain('oneven weken');
  });

  it('appends even parity for month', () => {
    const result = describeDraft('month', 1, new Set([0]), 1, '08:00', 'even');
    expect(result).toContain('· even');
  });
});

describe('parseWeekdays', () => {
  it('returns empty set for null', () => {
    expect(parseWeekdays(null)).toEqual(new Set());
  });

  it('returns empty set for undefined', () => {
    expect(parseWeekdays(undefined)).toEqual(new Set());
  });

  it('parses csv, filters out-of-range', () => {
    expect(parseWeekdays('0,3,7')).toEqual(new Set([0, 3]));
  });
});

describe('describeRule', () => {
  function makeRule(overrides: Partial<RecurringRule> = {}): RecurringRule {
    return {
      id: 'r1', template_task_id: 't1', active: true,
      unit: 'day', interval: 1,
      weekdays: null, month_day: null,
      time_of_day: '08:00', parity: 'any',
      notify_on_spawn: false,
      ...overrides,
    };
  }

  it('describes daily rule', () => {
    expect(describeRule(makeRule({ unit: 'day', interval: 1 }))).toBe('Dagelijks · 08:00');
  });

  it('describes weekly rule with weekdays', () => {
    const result = describeRule(makeRule({ unit: 'week', interval: 1, weekdays: '0,4' }));
    expect(result).toContain('op ma, vr');
  });

  it('describes monthly rule', () => {
    const result = describeRule(makeRule({ unit: 'month', interval: 1, month_day: 15 }));
    expect(result).toContain('op dag 15');
  });

  it('appends odd parity', () => {
    expect(describeRule(makeRule({ parity: 'odd' }))).toContain('oneven');
  });

  it('describes daily rule with interval > 1', () => {
    expect(describeRule(makeRule({ unit: 'day', interval: 3 }))).toBe('Elke 3 dagen · 08:00');
  });
});

describe('parityLabel', () => {
  it.each([
    ['week', 'weken'],
    ['month', 'maanden'],
    ['day', 'dagen'],
  ] as const)('parityLabel(%s) → %s', (unit, label) => {
    expect(parityLabel(unit)).toBe(label);
  });
});

describe('describeDraft additional branches', () => {
  it('month interval>1 with monthDay', () => {
    const result = describeDraft('month', 3, new Set(), 15, '09:00', 'any');
    expect(result).toContain('Elke 3 maanden op dag 15');
  });

  it('week with no weekdays still produces prefix only', () => {
    const result = describeDraft('week', 1, new Set(), 1, '08:00', 'any');
    expect(result).toContain('Wekelijks');
  });

  it('odd parity for month gives non-week suffix', () => {
    const result = describeDraft('month', 1, new Set(), 1, '08:00', 'odd');
    expect(result).toContain('· oneven');
    expect(result).not.toContain('weken');
  });

  it('even parity for week gives weken suffix', () => {
    const result = describeDraft('week', 1, new Set([0]), 1, '08:00', 'even');
    expect(result).toContain('· even weken');
  });
});

describe('describeRule additional branches', () => {
  function makeRule(overrides: Partial<import('../services/types').RecurringRule> = {}): import('../services/types').RecurringRule {
    return {
      id: 'r1', template_task_id: 't1', active: true,
      unit: 'day', interval: 1,
      weekdays: null, month_day: null,
      time_of_day: '08:00', parity: 'any',
      notify_on_spawn: false,
      ...overrides,
    } as unknown as import('../services/types').RecurringRule;
  }

  it('describes weekly rule with interval>1 and no weekdays', () => {
    const result = describeRule(makeRule({ unit: 'week', interval: 2, weekdays: null }));
    expect(result).toContain('Elke 2 weken');
  });

  it('describes monthly rule with interval>1', () => {
    const result = describeRule(makeRule({ unit: 'month', interval: 3, month_day: 10 }));
    expect(result).toContain('Elke 3 maanden op dag 10');
  });

  it('describes monthly rule without month_day', () => {
    const result = describeRule(makeRule({ unit: 'month', interval: 1, month_day: null }));
    expect(result).toContain('Maandelijks');
  });

  it('even parity week gives weken suffix', () => {
    const result = describeRule(makeRule({ unit: 'week', parity: 'even' }));
    expect(result).toContain('· even weken');
  });

  it('even parity month gives non-week suffix', () => {
    const result = describeRule(makeRule({ unit: 'month', parity: 'even' }));
    expect(result).toContain('· even');
    expect(result).not.toContain('weken');
  });

  it('odd parity week gives oneven weken suffix', () => {
    const result = describeRule(makeRule({ unit: 'week', parity: 'odd' }));
    expect(result).toContain('· oneven weken');
  });

  it('uses fallback time 08:00 when time_of_day is null', () => {
    const result = describeRule(makeRule({ time_of_day: null }));
    expect(result).toContain('08:00');
  });

  it('uses interval 1 as fallback when interval is null', () => {
    const result = describeRule(makeRule({ unit: 'day', interval: null as unknown as number }));
    expect(result).toContain('Dagelijks');
  });

  it('returns empty base string when unit is unknown', () => {
    const result = describeRule(makeRule({ unit: 'unknown' as unknown as 'day' }));
    expect(result).toContain('08:00');
  });
});
