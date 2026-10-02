/** A value given by its log10, e.g. 45.3 -> "2.0e45". */
export function formatLog(log10: number): string {
  if (log10 < 4) return (10 ** log10).toFixed(log10 < 1 ? 2 : 0);
  const exp = Math.floor(log10);
  return `${(10 ** (log10 - exp)).toFixed(1)}e${exp}`;
}

/** Largest unit only: 45s, 12m, 3h, 85d, 2y. */
export function formatCompact(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  for (const [unit, size] of [
    ['y', 31_536_000],
    ['d', 86_400],
    ['h', 3600],
    ['m', 60],
  ] as const)
    if (s >= size) return `${Math.floor(s / size)}${unit}`;
  return `${s}s`;
}

/** Compact duration: 45s, 12m, 3h 20m, 4d 6h, 2y 30d. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const y = Math.floor(s / 31_536_000);
  const d = Math.floor((s % 31_536_000) / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (y > 0) return `${y}y ${d}d`;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
