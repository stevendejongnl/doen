import { describe, it, expect } from 'vitest';
import { PROJECT_COLORS, isValidProjectColor } from './colors';

describe('PROJECT_COLORS', () => {
  it('is a non-empty array of hex strings', () => {
    expect(PROJECT_COLORS.length).toBeGreaterThan(0);
    for (const c of PROJECT_COLORS) {
      expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('isValidProjectColor', () => {
  it('returns true for a valid color', () => {
    expect(isValidProjectColor(PROJECT_COLORS[0])).toBe(true);
  });

  it('returns false for an unknown color', () => {
    expect(isValidProjectColor('#000000')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidProjectColor('')).toBe(false);
  });
});
