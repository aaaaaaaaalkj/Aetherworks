import { useEffect, useRef, useState } from 'react';
import type { HistoryPoint } from '../game/engine';
import { formatDuration, formatLog } from '../game/format';
import { type MachineDef, NAMES } from '../game/machines';
import { assign, type Choice, emptyPools, METRICS, multiplier, PAYOUT } from '../game/prestige';

interface Props {
  machines: MachineDef[];
  history: HistoryPoint[];
  purchases: [number, number][];
  prestiges: [number, number, Choice][];
  now: number;
  credits: number;
  earned: number;
}

/** Tallest the chart gets; below MIN_HEIGHT there's no room and it is hidden. */
const MAX_HEIGHT = 260;
const MIN_HEIGHT = 90;
/** Padding + top border of the panel around the svg (see .slot .panel). */
const PANEL_X = 24;
const PANEL_Y = 25;
const M = { top: 8, right: 12, bottom: 22, left: 12 };
const RUG = 6;

/** Ages (seconds before now) marked on the time axis. */
const AGE_TICKS: [number, string][] = [
  [0, 'now'],
  [10, '−10s'],
  [60, '−1m'],
  [600, '−10m'],
  [3600, '−1h'],
  [21_600, '−6h'],
  [86_400, '−1d'],
  [604_800, '−1w'],
  [2_592_000, '−30d'],
  [31_536_000, '−1y'],
];
const MIN_TICK_GAP = 34;

/**
 * Credits (log) against how long ago (log): now is the right edge, the recent past
 * is expanded and the start of the game is compressed at the left.
 */
export function CreditChart({ machines, history, purchases, prestiges, now, credits, earned }: Props) {
  const slotRef = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState({ width: 800, height: MAX_HEIGHT + PANEL_Y });
  const [hoverX, setHoverX] = useState<number | null>(null);

  // The slot takes whatever height the dock leaves over; the chart fits into it.
  useEffect(() => {
    const el = slotRef.current!;
    const ro = new ResizeObserver(([e]) => setSlot({ width: e.contentRect.width, height: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const width = Math.max(0, slot.width - PANEL_X);
  const height = Math.min(MAX_HEIGHT, Math.floor(slot.height - PANEL_Y));
  if (height < MIN_HEIGHT) return <div className="slot" ref={slotRef} />;

  // Only plot well-formed samples, so bad values can't blank the chart. A sample
  // with an invalid total falls back to the balance held at that moment.
  const points: HistoryPoint[] = [];
  for (const [t, held, total] of [
    ...history,
    [now, credits > 0 ? Math.log10(credits) : null, Math.log10(earned)] as HistoryPoint,
  ]) {
    if (!Number.isFinite(t)) continue;
    const h = Number.isFinite(held) ? held : null;
    const e = Number.isFinite(total) ? total : h;
    if (e !== null) points.push([t, h, e]);
  }

  const plotW = Math.max(50, width - M.left - M.right);
  const plotH = height - M.top - M.bottom;

  const ageLog = (age: number) => Math.log10(1 + Math.max(0, age));
  const span = ageLog(Math.max(60, now));
  const x = (t: number) => M.left + plotW * (1 - ageLog(now - t) / span);

  const maxY = Math.max(1, ...points.map((p) => p[2]));
  const yTop = Math.ceil(maxY + 0.3);
  const y = (v: number | null) => M.top + plotH - (Math.max(0, v ?? 0) / yTop) * plotH;

  const yStep = [1, 2, 5, 10, 20, 25, 50, 100].find((s) => yTop / s <= 6) ?? 100;
  const yTicks: number[] = [];
  for (let v = 0; v <= yTop; v += yStep) yTicks.push(v);
  const xTicks: [number, string][] = [];
  for (const [age, label] of AGE_TICKS) {
    if (age > Math.max(60, now)) break;
    const prev = xTicks[xTicks.length - 1];
    const fits = x(now - age) >= M.left + 16;
    if (fits && (!prev || x(now - prev[0]) - x(now - age) >= MIN_TICK_GAP)) xTicks.push([age, label]);
  }

  let heldPath = '';
  let earnedPath = '';
  points.forEach(([t, held, total], k) => {
    const cmd = k === 0 ? 'M' : 'L';
    heldPath += `${cmd}${x(t).toFixed(1)},${y(held).toFixed(1)}`;
    earnedPath += `${cmd}${x(t).toFixed(1)},${y(total).toFixed(1)}`;
  });

  // The area under the total is split by each machine's share of production at
  // that moment, rebuilt from the purchase and prestige logs; the right edge is the
  // current mix. Where the mix changes, the old mix is repeated at the same x for a
  // sharp step.
  let levels = machines.map(() => 0);
  let pools = emptyPools(machines.length);
  let bought = 0;
  let prestiged = 0;
  let mix: number[] | null = null;
  const cols: [number, number, number[]][] = [];
  for (const [t, , total] of points) {
    // A prestige is recorded as two samples at the same moment, before and after;
    // it applies from the second one, after any purchases made at that moment.
    for (;;) {
      const nextBuy = bought < purchases.length ? purchases[bought][0] : Infinity;
      const nextPrestige = prestiged < prestiges.length ? prestiges[prestiged][0] : Infinity;
      const buyDue = nextBuy <= t;
      const prestigeDue = nextPrestige < t;
      if (!buyDue && !prestigeDue) break;
      if (buyDue && (nextBuy <= nextPrestige || !prestigeDue)) {
        const i = purchases[bought++][1];
        if (i in levels) levels[i] += 1;
      } else {
        const [, pts, choice] = prestiges[prestiged++];
        pools = assign(pools, choice, pts);
        levels = machines.map(() => 0);
      }
    }
    const prod = machines.map((m, i) => m.production(levels[i]) * multiplier(pools, i, PAYOUT, levels[i]));
    const sum = prod.reduce((a, b) => a + b, 0);
    const shares = prod.map((p) => (sum > 0 ? p / sum : 0));
    if (mix && shares.some((s, i) => s !== mix![i])) cols.push([t, total, mix]);
    cols.push([t, total, shares]);
    mix = shares;
  }
  const layers = machines.map((_, i) => {
    let upper = '';
    let lower = '';
    for (const [t, total, shares] of cols) {
      const below = shares.slice(0, i).reduce((a, b) => a + b, 0);
      upper += `L${x(t).toFixed(1)},${y(total * (below + shares[i])).toFixed(1)}`;
      lower = `L${x(t).toFixed(1)},${y(total * below).toFixed(1)}` + lower;
    }
    return `M${upper.slice(1)}${lower}Z`;
  });

  // Hover: nearest sample by x position.
  let hover: HistoryPoint | null = null;
  if (hoverX !== null) {
    let best = Infinity;
    for (const p of points) {
      const dist = Math.abs(x(p[0]) - hoverX);
      if (dist < best) {
        best = dist;
        hover = p;
      }
    }
  }

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    setHoverX(px >= M.left && px <= M.left + plotW ? px : null);
  };

  // Purchase ticks hang just under the axis, above the time labels.
  const rugY = M.top + plotH + 1;

  return (
    <div className="slot" ref={slotRef}>
      <section className="panel">
        <div className="chart">
          <svg
            width={width}
            height={height}
            onPointerMove={onMove}
            onPointerLeave={() => setHoverX(null)}
            role="img"
            aria-label="Credits over time; time runs to now at the right, both axes logarithmic"
          >
            {yTicks.map((v) => (
              <g key={v}>
                <line x1={M.left} x2={M.left + plotW} y1={y(v)} y2={y(v)} className="grid" />
              </g>
            ))}
            {xTicks.map(([age, label]) => (
              <g key={age}>
                <line x1={x(now - age)} x2={x(now - age)} y1={M.top} y2={M.top + plotH} className="grid" />
                <text
                  x={x(now - age)}
                  y={M.top + plotH + RUG + 12}
                  className="tick"
                  textAnchor={age === 0 ? 'end' : 'middle'}
                >
                  {label}
                </text>
              </g>
            ))}
            <line x1={M.left} x2={M.left + plotW} y1={M.top + plotH} y2={M.top + plotH} className="axis" />
            {layers.map((d, i) => (
              <path key={i} d={d} className="share-layer" fill={`var(--series-${i + 1})`} />
            ))}
            <path d={heldPath} className="held-line" />
            <path d={earnedPath} className="earned-line" />

            {/* Purchases, one tick per level bought, in the machine's colour */}
            {purchases.map(([t, i], k) => (
              <line
                key={k}
                x1={x(t)}
                x2={x(t)}
                y1={rugY}
                y2={rugY + RUG}
                stroke={`var(--series-${i + 1})`}
                strokeWidth={2}
              >
                <title>{`${NAMES[i]}, ${formatDuration(now - t)} ago`}</title>
              </line>
            ))}

            {/* Prestiges: the run ends, the totals drop and a new run starts. */}
            {prestiges.map(([t, pts, choice], k) => (
              <g key={k} className="prestige-mark">
                <line x1={x(t)} x2={x(t)} y1={M.top} y2={M.top + plotH} />
                <path d={`M${x(t) - 4},${M.top} h8 l-4,6 z`}>
                  <title>{`Prestige, ${formatDuration(now - t)} ago: ${pts.toLocaleString('en-US')} points to ${
                    choice.kind === 'machine'
                      ? NAMES[choice.index]
                      : choice.kind === 'metric'
                        ? METRICS[choice.index]
                        : `level ${choice.index}`
                  }`}</title>
                </path>
              </g>
            ))}

            {hover && (
              <g className="crosshair">
                <line x1={x(hover[0])} x2={x(hover[0])} y1={M.top} y2={M.top + plotH} />
                <circle cx={x(hover[0])} cy={y(hover[2])} r={4} />
              </g>
            )}
          </svg>
          {hover && (
            <div
              className="tooltip"
              style={{ left: Math.min(x(hover[0]) + 12, width - 170), top: Math.max(0, y(hover[2]) - 60) }}
            >
              <div className="tooltip-k">{now - hover[0] < 1 ? 'now' : `${formatDuration(now - hover[0])} ago`}</div>
              <div>Earned {formatLog(hover[2])}</div>
              <div className="tooltip-sub">Held {hover[1] === null ? '0' : formatLog(hover[1])}</div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
