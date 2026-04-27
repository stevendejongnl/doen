export const PROJECT_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16',
] as const;

export type ProjectColor = typeof PROJECT_COLORS[number];

export function isValidProjectColor(color: string): color is ProjectColor {
  return (PROJECT_COLORS as readonly string[]).includes(color);
}
