import { useEffect, useRef } from 'react';

export interface FlowSource {
  /** Motes per second (cosmetic). */
  rate: number;
  hue: string;
  hue2: string;
}

interface Mote {
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  t: number;
  life: number;
  color: string;
  size: number;
  src: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  life: number;
  color: string;
}

interface Ring {
  x: number;
  y: number;
  t: number;
  color: string;
}

type BurstFn = (index: number) => void;
let burstImpl: BurstFn = () => {};

/** Fire a celebratory burst from machine `index` (called on purchase). */
export function burst(index: number): void {
  burstImpl(index);
}

const MAX_MOTES = 220;
const RECT_REFRESH_MS = 300;

/**
 * A full-screen overlay where credits visibly flow as glowing motes from each machine
 * up into the vault. Purely decorative — it never reveals any numbers.
 */
export function FlowCanvas({ sources }: { sources: () => FlowSource[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const motes: Mote[] = [];
    const sparks: Spark[] = [];
    const rings: Ring[] = [];
    const acc: number[] = [];
    let raf = 0;
    let last = performance.now();
    let lastHit = 0;
    let w = 0;
    let h = 0;
    let drewLastFrame = false;

    // Element positions are cached and refreshed on a timer or scroll, so the
    // animation loop never forces a synchronous layout.
    let arts: (DOMRect | undefined)[] = [];
    let vault: DOMRect | undefined;
    let flash: HTMLElement | null = null;
    let rectsAt = -Infinity;
    const refreshRects = () => {
      arts = sourcesRef.current().map((_, i) => document.getElementById(`art-${i}`)?.getBoundingClientRect());
      vault = document.getElementById('vault')?.getBoundingClientRect();
      flash = document.querySelector('.vault-flash');
      rectsAt = performance.now();
    };
    const invalidateRects = () => {
      rectsAt = -Infinity;
    };
    window.addEventListener('scroll', invalidateRects, { passive: true });

    const resize = () => {
      invalidateRects();
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    burstImpl = (i) => {
      refreshRects();
      const r = arts[i];
      const src = sourcesRef.current()[i];
      if (!r || !src) return;
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      rings.push({ x, y, t: 0, color: src.hue });
      for (let k = 0; k < 46; k++) {
        const a = Math.random() * Math.PI * 2;
        const v = 80 + Math.random() * 260;
        sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, t: 0, life: 0.6 + Math.random() * 0.7, color: k % 3 ? src.hue : src.hue2 });
      }
    };

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (now - rectsAt > RECT_REFRESH_MS) refreshRects();
      const target = vault ? { x: vault.left + vault.width / 2, y: vault.top + vault.height / 2 } : null;
      const srcs = sourcesRef.current();

      // Emit motes from every running machine that's on screen.
      srcs.forEach((s, i) => {
        if (s.rate <= 0 || motes.length > MAX_MOTES) return;
        acc[i] = (acc[i] ?? 0) + s.rate * dt;
        while (acc[i] >= 1) {
          acc[i] -= 1;
          const r = arts[i];
          if (!r || r.bottom < 0 || r.top > h || !target) continue;
          const x0 = r.left + r.width * (0.3 + Math.random() * 0.4);
          const y0 = r.top + r.height * (0.3 + Math.random() * 0.4);
          motes.push({
            x0,
            y0,
            cx: (x0 + target.x) / 2 + (Math.random() - 0.5) * 260,
            cy: Math.min(y0, target.y) - 40 - Math.random() * 120,
            t: 0,
            life: 1.1 + Math.random() * 0.8,
            color: Math.random() < 0.7 ? s.hue : s.hue2,
            size: 1.4 + Math.random() * 1.8,
            src: i,
          });
        }
      });

      const busy = motes.length + sparks.length + rings.length > 0;
      if (!busy && !drewLastFrame) {
        raf = requestAnimationFrame(frame);
        return;
      }
      drewLastFrame = busy;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';

      const bez = (m: Mote, t: number, tx: number, ty: number) => {
        const u = 1 - t;
        return [u * u * m.x0 + 2 * u * t * m.cx + t * t * tx, u * u * m.y0 + 2 * u * t * m.cy + t * t * ty];
      };

      for (let k = motes.length - 1; k >= 0; k--) {
        const m = motes[k];
        m.t += dt / m.life;
        if (m.t >= 1 || !target) {
          motes.splice(k, 1);
          if (flash && now - lastHit > 140) {
            lastHit = now;
            flash.animate([{ opacity: 0.8 }, { opacity: 0 }], { duration: 300, easing: 'ease-out' });
          }
          continue;
        }
        const e = m.t * m.t * (3 - 2 * m.t);
        const [x, y] = bez(m, e, target.x, target.y);
        const [px, py] = bez(m, Math.max(0, e - 0.06), target.x, target.y);
        const alpha = Math.min(1, m.t * 6) * (1 - Math.max(0, m.t - 0.85) / 0.15);
        ctx.strokeStyle = m.color;
        ctx.globalAlpha = alpha * 0.45;
        ctx.lineWidth = m.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = m.color;
        ctx.beginPath();
        ctx.arc(x, y, m.size * 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha * 0.9;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x, y, m.size * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let k = sparks.length - 1; k >= 0; k--) {
        const s = sparks[k];
        s.t += dt;
        if (s.t >= s.life) {
          sparks.splice(k, 1);
          continue;
        }
        s.vx *= 0.94;
        s.vy = s.vy * 0.94 + 240 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        ctx.globalAlpha = 1 - s.t / s.life;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2.2 * (1 - s.t / s.life) + 0.6, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let k = rings.length - 1; k >= 0; k--) {
        const r = rings[k];
        r.t += dt / 0.7;
        if (r.t >= 1) {
          rings.splice(k, 1);
          continue;
        }
        ctx.globalAlpha = (1 - r.t) * 0.8;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 3 * (1 - r.t) + 0.5;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 20 + r.t * 140, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', invalidateRects);
      burstImpl = () => {};
    };
  }, []);

  return <canvas ref={canvasRef} className="flow-canvas" aria-hidden="true" />;
}
