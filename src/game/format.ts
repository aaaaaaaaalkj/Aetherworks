const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

/** Splits a credit amount into display digits and a magnitude suffix, e.g. 1234567 -> ["1.23", "M"]. */
export function splitCredits(n: number): { digits: string; suffix: string } {
  if (!Number.isFinite(n) || n < 0) n = 0;
  if (n < 1e6) return { digits: Math.floor(n).toLocaleString('en-US'), suffix: '' };
  const tier = Math.floor(Math.log10(n) / 3);
  if (tier < SUFFIXES.length) {
    const scaled = n / 10 ** (tier * 3);
    const digits = scaled >= 100 ? scaled.toFixed(1) : scaled >= 10 ? scaled.toFixed(2) : scaled.toFixed(3);
    return { digits, suffix: SUFFIXES[tier] };
  }
  const exp = Math.floor(Math.log10(n));
  return { digits: (n / 10 ** exp).toFixed(3), suffix: `e${exp}` };
}

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
