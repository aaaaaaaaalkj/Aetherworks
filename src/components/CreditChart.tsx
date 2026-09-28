import { useEffect, useRef, useState } from 'react';
import type { HistoryPoint } from '../game/engine';
import { decadeLabel, formatDuration, formatLog } from '../game/format';
import { MACHINES } from '../game/machines';

interface Props {
  history: HistoryPoint[];
  purchases: [number, number][];
  now: number;
  credits: number;
  earned: number;
}

const HEIGHT = 260;
const M = { top: 12, right: 16, bottom: 44, left: 52 };
const RUG = 10;

const TIME_TICKS: [number, string][] = [
  [1, '1s'],
  [10, '10s'],
  [60, '1m'],
  [600, '10m'],
  [3600, '1h'],
  [21_600, '6h'],
  [86_400, '1d'],
  [604_800, '1w'],
  [2_592_000, '30d'],
  [31_536_000, '1y'],
  [315_360_000, '10y'],
];

/** Credits (log) against time since the start (log, so the past compresses). */
export function CreditChart({ history, purchases, now, credits, earned }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [hoverX, setHoverX] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Only plot well-formed samples, so bad values can't blank the chart. A sample
  // with an invalid total falls back to the balance held at that moment.
  const points: HistoryPoint[] = [];
  for (const [t, held, total] of [...history, [now, credits > 0 ? Math.log10(credits) : null, Math.log10(earned)] as HistoryPoint]) {
    if (!Number.isFinite(t)) continue;
    const h = Number.isFinite(held) ? held : null;
    const e = Number.isFinite(total) ? total : h;
    if (e !== null) points.push([t, h, e]);
  }

  const plotW = Math.max(50, width - M.left - M.right);
  const plotH = HEIGHT - M.top - M.bottom;

  const tMax = Math.max(60, now);
  const xLog = (t: number) => Math.log10(Math.max(1, t));
  const x = (t: number) => M.left + (xLog(t) / xLog(tMax)) * plotW;

  const maxY = Math.max(1, ...points.map((p) => p[2]));
  const yTop = Math.ceil(maxY + 0.3);
  const y = (v: number | null) => M.top + plotH - (Math.max(0, v ?? 0) / yTop) * plotH;

  const yStep = [1, 2, 5, 10, 20, 25, 50, 100].find((s) => yTop / s <= 6) ?? 100;
  const yTicks: number[] = [];
  for (let v = 0; v <= yTop; v += yStep) yTicks.push(v);
  const xTicks = TIME_TICKS.filter(([t]) => t <= tMax);

  // Samples sit a few percent apart in time; a far wider gap means lost data, so the
  // line breaks there instead of bridging it.
  let heldPath = '';
  let earnedPath = '';
  points.forEach(([t, held, total], k) => {
    const cmd = k === 0 || t > points[k - 1][0] * 3 + 60 ? 'M' : 'L';
    heldPath += `${cmd}${x(t).toFixed(1)},${y(held).toFixed(1)}`;
    earnedPath += `${cmd}${x(t).toFixed(1)},${y(total).toFixed(1)}`;
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

  const rugY = HEIGHT - M.bottom + 22;

  return (
    <section className="panel">
      <div className="chart-head">
        <h2>Credits over time</h2>
        <ul className="legend">
          <li>
            <span className="line-key earned" />
            Earned in total
          </li>
          <li>
            <span className="line-key held" />
            Held
          </li>
        </ul>
      </div>
      <div className="chart" ref={wrapRef}>
        <svg width={width} height={HEIGHT} onPointerMove={onMove} onPointerLeave={() => setHoverX(null)} role="img" aria-label="Credits over time, both axes logarithmic">
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={M.left} x2={M.left + plotW} y1={y(v)} y2={y(v)} className="grid" />
              <text x={M.left - 8} y={y(v)} className="tick" textAnchor="end" dominantBaseline="middle">
                {decadeLabel(v)}
              </text>
            </g>
          ))}
          {xTicks.map(([t, label]) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={M.top} y2={M.top + plotH} className="grid" />
              <text x={x(t)} y={M.top + plotH + 14} className="tick" textAnchor="middle">
                {label}
              </text>
            </g>
          ))}
          <line x1={M.left} x2={M.left + plotW} y1={M.top + plotH} y2={M.top + plotH} className="axis" />
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
              <title>{`${MACHINES[i].name} bought at ${formatDuration(t)}`}</title>
            </line>
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
            <div className="tooltip-k">{formatDuration(hover[0])}</div>
            <div>Earned {formatLog(hover[2])}</div>
            <div className="tooltip-sub">Held {hover[1] === null ? '0' : formatLog(hover[1])}</div>
          </div>
        )}
      </div>
    </section>
  );
}
