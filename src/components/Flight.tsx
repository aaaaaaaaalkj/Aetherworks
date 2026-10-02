import { type MutableRefObject, useEffect, useRef } from 'react';
import type { GameState } from '../game/engine';
import { formatLog } from '../game/format';

interface Props {
  /** The live game state, read every frame. */
  game: () => GameState;
  /** Total production per second. */
  rate: () => number;
  /** Each machine's pulse progress (0..1), or null when it isn't shown. */
  pulses: () => (number | null)[];
  /** Where the flight was when the tab was last left, so it picks up from there. */
  memory: MutableRefObject<FlightMemory | null>;
}

export interface FlightMemory {
  y: number;
  vy: number;
  camY: number;
  scale: number;
  trail: [number, number][];
  particles: Particle[];
  prevPhases: number[];
  prevLevels: number[];
  seenPurchases: number;
  seenPrestiges: number;
  flash: number;
}

// The dot sits still; the world (grid, trail, sparks) moves past it. World x is
// real time in seconds, world y is log10 of the balance.
const PX_PER_SEC = 70;
const DOT_X = 0.68;
/** Spring pulling the dot toward the balance: stiffness and damping ratio (< 1 overshoots a little). */
const SPRING_K = 7;
const SPRING_ZETA = 0.55;
/** The dot aims at credits plus this many seconds of production, so a purchase dips rather than plunges. */
const FLOOR_SECONDS = 10;
const GRID_PX = 96;
const MAX_PARTICLES = 240;

interface Particle {
  /** World anchor. */
  t: number;
  v: number;
  /** Screen offset from the anchor and its velocity, px and px/s. */
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  color: string;
  ring: number; // 0 for a spark, else the final ring radius
  /** Stays centred on the dot instead of being left behind. */
  follow?: boolean;
}

interface Palette {
  bg: string;
  grid: string;
  label: string;
  dot: string;
  glow: string;
  series: string[];
  dark: boolean;
}

function readPalette(el: Element): Palette {
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    bg: v('--surface-1'),
    grid: v('--text-muted'),
    label: v('--text-muted'),
    dot: v('--text-primary'),
    glow: v('--heat-hue'),
    series: Array.from({ length: 8 }, (_, i) => v(`--series-${i + 1}`)),
    dark: matchMedia('(prefers-color-scheme: dark)').matches,
  };
}

/** A colour at the given opacity; canvas fades to `transparent` pass through black otherwise. */
function withAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return alpha > 0.5 ? color : 'rgba(0,0,0,0)';
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
}

const target = (s: GameState, rate: number) => {
  const pending = s.pending.reduce((a, b) => a + b, 0);
  const value = s.credits + pending + rate * FLOOR_SECONDS;
  return value > 0 ? Math.log10(value) : 0;
};

/**
 * The balance as a glowing dot flying through a grid, trailing a line. It follows
 * the balance on a spring, so deliveries and purchases bend its path instead of
 * jerking it. Each built machine circles it once per pulse and throws sparks in
 * its colour when it pays out; purchases and prestiges send out rings.
 */
export function Flight({ game, rate, pulses, memory }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let w = 0;
    let h = 0;
    let palette = readPalette(wrap);

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    const scheme = matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => (palette = readPalette(wrap));
    scheme.addEventListener('change', onScheme);

    const s0 = game();
    const start = target(s0, rate());
    const m: FlightMemory = memory.current ?? {
      y: start,
      vy: 0,
      camY: start,
      scale: 120, // px per decade
      trail: [],
      particles: [],
      prevPhases: [...s0.phases],
      prevLevels: [...s0.levels],
      seenPurchases: s0.purchases.length,
      seenPrestiges: s0.prestiges.length,
      flash: 0,
    };
    memory.current = m;
    let { y, vy, camY, scale, prevPhases, prevLevels, seenPurchases, seenPrestiges, flash } = m;
    const { trail, particles } = m;
    let last = performance.now() / 1000;
    let raf = 0;

    const spark = (t: number, v: number, color: string, n: number, speed: number) => {
      for (let k = 0; k < n && particles.length < MAX_PARTICLES; k++) {
        const a = Math.random() * Math.PI * 2;
        const sp = speed * (0.4 + Math.random() * 0.8);
        particles.push({ t, v, ox: 0, oy: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, age: 0, life: 0.9 + Math.random() * 0.6, color, ring: 0 });
      }
    };
    const ring = (t: number, v: number, color: string, radius: number, life: number, follow = false) => {
      if (particles.length < MAX_PARTICLES)
        particles.push({ t, v, ox: 0, oy: 0, vx: 0, vy: 0, age: 0, life, color, ring: radius, follow });
    };

    const frame = () => {
      const now = performance.now() / 1000;
      const dt = Math.min(0.05, now - last);
      last = now;
      const s = game();
      const r = rate();

      // Spring toward the balance.
      const goal = target(s, r);
      const c = 2 * SPRING_ZETA * Math.sqrt(SPRING_K);
      vy += (SPRING_K * (goal - y) - c * vy) * dt;
      y += vy * dt;

      // Events: deliveries, purchases, prestiges.
      // Only machines whose pulse is visible spark; under heavy warp they'd be a storm.
      const shown = pulses();
      s.phases.forEach((p, i) => {
        if (shown[i] != null && prevLevels[i] === s.levels[i] && p < prevPhases[i] - 1e-9)
          spark(now, y, palette.series[i], 7, 70);
      });
      if (s.purchases.length < seenPurchases) seenPurchases = s.purchases.length;
      for (; seenPurchases < s.purchases.length; seenPurchases++) {
        const i = s.purchases[seenPurchases][1];
        ring(now, y, palette.series[i] ?? palette.dot, 70, 1.1);
        spark(now, y, palette.series[i] ?? palette.dot, 14, 140);
        flash = 1;
      }
      if (s.prestiges.length < seenPrestiges) seenPrestiges = s.prestiges.length;
      for (; seenPrestiges < s.prestiges.length; seenPrestiges++) {
        ring(now, y, palette.dot, Math.max(w, h), 2.2, true);
        ring(now, y, palette.glow, Math.max(w, h) * 0.6, 1.6, true);
        palette.series.forEach((col) => spark(now, y, col, 8, 220));
        flash = 1.5;
      }
      prevPhases = [...s.phases];
      prevLevels = [...s.levels];

      // Trail and the window it spans.
      trail.push([now, y]);
      const span = (w * DOT_X) / PX_PER_SEC + 1;
      while (trail.length && trail[0][0] < now - span) trail.shift();
      let lo = y;
      let hi = y;
      for (const [, v] of trail) {
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
      lo = Math.min(lo, goal);
      hi = Math.max(hi, goal);

      // Zoom to fit the trail; follow the dot loosely so it drifts on screen.
      // Small changes still show as gentle waves; a prestige zooms right out.
      const want = (h * 0.5) / Math.max(0.2, hi - lo);
      // Zoom out quickly so a dive stays in view, back in slowly.
      scale += (want - scale) * (1 - Math.exp(-dt * (want < scale ? 4 : 0.8)));
      camY += ((lo + hi) / 2 - camY) * (1 - Math.exp(-dt * 1.5));
      const margin = (h * 0.38) / scale;
      camY = Math.min(Math.max(camY, y - margin), y + margin);

      const dotX = w * DOT_X;
      const sx = (t: number) => dotX - (now - t) * PX_PER_SEC;
      const sy = (v: number) => h / 2 - (v - camY) * scale;

      // Background.
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, w, h);

      // Far layer of vertical lines, slower: depth.
      ctx.lineWidth = 1;
      ctx.strokeStyle = palette.grid;
      ctx.globalAlpha = 0.07;
      const far = GRID_PX / 2;
      for (let x = -((now * PX_PER_SEC * 0.45) % far); x < w; x += far) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      // Near vertical lines move with the world.
      ctx.globalAlpha = 0.16;
      for (let x = dotX - ((now * PX_PER_SEC) % GRID_PX) - Math.ceil(dotX / GRID_PX) * GRID_PX; x < w; x += GRID_PX) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      // Horizontal lines at powers of ten (more often when zoomed out, halves and fifths when zoomed in).
      const step = scale < 14 ? 10 : scale < 28 ? 5 : scale < 60 ? 2 : 1;
      const top = camY + h / 2 / scale;
      const bottom = camY - h / 2 / scale;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'right';
      for (let d = Math.floor(bottom / step) * step; d <= top; d += step) {
        const yy = sy(d);
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.moveTo(0, yy);
        ctx.lineTo(w, yy);
        ctx.stroke();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = palette.label;
        if (d >= 0) ctx.fillText(d < 4 ? `${10 ** d}` : `1e${d}`, w - 6, yy - 3);
        if (scale > 220) {
          ctx.globalAlpha = 0.08;
          for (const f of [Math.log10(2), Math.log10(5)]) {
            ctx.beginPath();
            ctx.moveTo(0, sy(d + f));
            ctx.lineTo(w, sy(d + f));
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;

      // The trail: a soft wide glow under a thin line, both fading into the past.
      if (trail.length > 1) {
        const grad = (alpha: number) => {
          const g = ctx.createLinearGradient(0, 0, dotX, 0);
          g.addColorStop(0, withAlpha(palette.glow, 0));
          g.addColorStop(0.6, palette.glow);
          g.addColorStop(1, palette.dark ? '#fff' : palette.glow);
          ctx.globalAlpha = alpha;
          return g;
        };
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        const path = () => {
          ctx.beginPath();
          trail.forEach(([t, v], k) => (k ? ctx.lineTo(sx(t), sy(v)) : ctx.moveTo(sx(t), sy(v))));
        };
        if (palette.dark) ctx.globalCompositeOperation = 'lighter';
        path();
        ctx.strokeStyle = grad(0.18);
        ctx.lineWidth = 10;
        ctx.stroke();
        path();
        ctx.strokeStyle = grad(0.95);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }

      // Sparks and rings, left behind in the world.
      if (palette.dark) ctx.globalCompositeOperation = 'lighter';
      for (let k = particles.length - 1; k >= 0; k--) {
        const p = particles[k];
        p.age += dt;
        if (p.age >= p.life) {
          particles.splice(k, 1);
          continue;
        }
        const f = p.age / p.life;
        const px = p.follow ? dotX : sx(p.t);
        const py = p.follow ? sy(y) : sy(p.v);
        if (p.ring) {
          const rad = p.ring * (1 - (1 - f) ** 3);
          ctx.globalAlpha = (1 - f) * 0.8;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2 * (1 - f) + 0.5;
          ctx.beginPath();
          ctx.arc(px, py, rad, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          p.vx *= 1 - dt * 1.8;
          p.vy *= 1 - dt * 1.8;
          p.ox += p.vx * dt;
          p.oy += p.vy * dt;
          ctx.globalAlpha = (1 - f) ** 1.5;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(px + p.ox, py + p.oy, 2.2 * (1 - f) + 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // Machines circle the dot, one lap per pulse.
      const dy = sy(y);
      pulses().forEach((p, i) => {
        if (p === null || p === undefined) return;
        const radius = 16 + i * 5;
        const a = p * Math.PI * 2 - Math.PI / 2;
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = palette.series[i];
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(dotX, dy, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = palette.series[i];
        ctx.beginPath();
        ctx.arc(dotX + Math.cos(a) * radius, dy + Math.sin(a) * radius, 2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalCompositeOperation = 'source-over';

      // The dot: a halo that swells on purchases, and a bright core.
      flash = Math.max(0, flash - dt * 1.5);
      const halo = 22 + flash * 26;
      const g = ctx.createRadialGradient(dotX, dy, 0, dotX, dy, halo);
      g.addColorStop(0, palette.glow);
      g.addColorStop(1, withAlpha(palette.glow, 0));
      ctx.globalAlpha = 0.55 + flash * 0.3;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(dotX, dy, halo, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = palette.dark ? '#fff' : palette.dot;
      ctx.beginPath();
      ctx.arc(dotX, dy, 4, 0, Math.PI * 2);
      ctx.fill();

      // The balance, quietly, beside the dot.
      if (s.credits > 0) {
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = palette.label;
        ctx.textAlign = 'left';
        ctx.font = '11px ui-monospace, monospace';
        ctx.fillText(formatLog(Math.log10(s.credits)), dotX + 14 + 8 * 5 + 6, dy + 4);
        ctx.globalAlpha = 1;
      }

      // Vignette for depth.
      const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
      vg.addColorStop(0, withAlpha(palette.bg, 0));
      vg.addColorStop(1, palette.bg);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);

      Object.assign(m, { y, vy, camY, scale, prevPhases, prevLevels, seenPurchases, seenPrestiges, flash });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      scheme.removeEventListener('change', onScheme);
    };
  }, [game, rate, pulses]);

  return (
    <div className="slot">
      <section className="panel flight" ref={wrapRef} aria-label="The balance in flight">
        <canvas ref={canvasRef} />
      </section>
    </div>
  );
}
