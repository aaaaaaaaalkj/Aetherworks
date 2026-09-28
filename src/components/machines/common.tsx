export interface ArtProps {
  /** Visual complexity tier, 0 (unbuilt) to 5. */
  tier: number;
  /** Animation speed multiplier (purely cosmetic). */
  spd: number;
  hue: string;
  hue2: string;
}

/** Levels at which a machine visibly grows new parts. */
export const TIER_LEVELS = [1, 10, 25, 50, 100];

export function tierOf(level: number): number {
  return TIER_LEVELS.filter((l) => level >= l).length;
}

/** Deterministic PRNG so generated shapes don't jump between renders. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A jagged lightning path between two points. */
export function boltPath(x1: number, y1: number, x2: number, y2: number, seed: number, segments = 7): string {
  const r = rng(seed);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  let d = `M${x1.toFixed(1)},${y1.toFixed(1)}`;
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const off = (r() - 0.5) * len * 0.28;
    d += ` L${(x1 + dx * t + nx * off).toFixed(1)},${(y1 + dy * t + ny * off).toFixed(1)}`;
  }
  return `${d} L${x2.toFixed(1)},${y2.toFixed(1)}`;
}

/** A gear outline centred on the origin. */
export function gearPath(r: number, teeth: number, depth = 6): string {
  const pts: string[] = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const corners: [number, number][] = [
      [a - step * 0.28, r - depth],
      [a - step * 0.16, r],
      [a + step * 0.16, r],
      [a + step * 0.28, r - depth],
    ];
    for (const [ang, rad] of corners) {
      pts.push(`${(Math.cos(ang) * rad).toFixed(2)},${(Math.sin(ang) * rad).toFixed(2)}`);
    }
  }
  return `M${pts.join(' L')} Z`;
}

/** An elliptical path usable by <animateMotion>. */
export function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  return `M${cx - rx},${cy} a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 ${-rx * 2},0`;
}

export function GlowFilter({ id, blur = 2.2 }: { id: string; blur?: number }) {
  return (
    <filter id={id} x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation={blur} result="b" />
      <feMerge>
        <feMergeNode in="b" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );
}

/** Seconds for a CSS animation, scaled by the machine's cosmetic speed. */
export const dur = (base: number, spd: number) => `${(base / spd).toFixed(3)}s`;
