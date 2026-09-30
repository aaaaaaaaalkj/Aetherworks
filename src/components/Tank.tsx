import { type CSSProperties, useEffect, useRef } from 'react';
import { formatDuration } from '../game/format';
import type { MachineDef } from '../game/machines';

interface Props {
  machines: MachineDef[];
  levels: number[];
  /** Each machine's next level cost, after prestige boosts. */
  nextCosts: number[];
  periods: number[];
  credits: number;
  rate: number;
  /** Each machine's pulse height (0..1), or null to hide it. Polled every frame. */
  pulses: () => (number | null)[];
  onBuy: (i: number) => void;
}

/** Bars shorter than this (px) have no room for a visible pulse. */
const MIN_PULSE_BAR_PX = 24;

/**
 * Each machine is a bar whose height is log10 of its next level's cost. The water
 * level is log10 of the credits held. A bar that is fully under water can be bought.
 * The scale slides with production: the floor sits at about one second's output.
 *
 * A pulse climbs each built machine's bar; when it reaches the top, what the
 * machine made during that pulse lands in the balance.
 */
export function Tank({ machines, levels, nextCosts, periods, credits, rate, pulses, onBuy }: Props) {
  const tracks = useRef<(HTMLSpanElement | null)[]>([]);

  // Pulses move every frame, so they are placed directly rather than re-rendered.
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      const progress = pulses();
      const heights = tracks.current.map((el) => el?.clientHeight ?? 0);
      tracks.current.forEach((el, i) => {
        const p = progress[i];
        if (!el) return;
        const show = p !== null && p !== undefined && heights[i] >= MIN_PULSE_BAR_PX;
        el.classList.toggle('pulsing', show);
        if (show) el.style.setProperty('--p', `${Math.min(1, p) * 100}%`);
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [pulses]);

  const costs = nextCosts.map((c) => Math.log10(c));
  const floor = rate > 0 ? Math.log10(rate) - 0.5 : Math.min(...costs) - 1;
  const ceil = Math.max(Math.max(...costs) + 0.4, floor + 3);
  const span = ceil - floor;
  const pct = (v: number) => `${Math.min(100, Math.max(0, ((v - floor) / span) * 100))}%`;
  const water = credits > 0 ? Math.log10(credits) : -Infinity;

  const every = span > 16 ? 2 : 1;
  const grid: number[] = [];
  for (let d = Math.ceil(floor / every) * every; d < ceil; d += every) grid.push(d);

  return (
    <section className="panel">
      <div className="tank">
        <div className="tank-plot">
          {grid.map((d) => (
            <div key={d} className="gridline" style={{ bottom: pct(d) }} />
          ))}
          <div className="bars">
            {machines.map((m, i) => {
              const ready = water >= costs[i];
              return (
                <button
                  key={m.name}
                  className={`bar-slot${ready ? ' ready' : ''}`}
                  style={{ '--c': `var(--series-${i + 1})` } as CSSProperties}
                  disabled={!ready}
                  onClick={() => onBuy(i)}
                  aria-label={`${m.name}, level ${levels[i]}${ready ? ', can be bought' : ''}`}
                  title={`${m.name} · pulses every ${formatDuration(periods[i])}`}
                >
                  <span className="bar" style={{ height: pct(costs[i]) }} />
                  <span
                    className="pulse-track"
                    ref={(el) => {
                      tracks.current[i] = el;
                    }}
                    style={{ height: pct(costs[i]) }}
                  >
                    <span className="pulse" />
                  </span>
                </button>
              );
            })}
          </div>
          <div className="water" style={{ height: pct(water) }} />
        </div>
        <div className="bar-labels">
          {machines.map((m, i) => (
            <div key={m.name} className="bar-label">
              <span className="badge" style={{ background: `var(--series-${i + 1})` }} title={m.name}>
                {levels[i]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
