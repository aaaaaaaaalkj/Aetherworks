import type { CSSProperties } from 'react';
import { nextCost } from '../game/engine';
import { MACHINES } from '../game/machines';

interface Props {
  levels: number[];
  credits: number;
  rate: number;
  onBuy: (i: number) => void;
}

/**
 * Each machine is a bar whose height is log10 of its next level's cost. The water
 * level is log10 of the credits held. A bar that is fully under water can be bought.
 * The scale slides with production: the floor sits at about one second's output.
 */
export function Tank({ levels, credits, rate, onBuy }: Props) {
  const costs = MACHINES.map((_, i) => Math.log10(nextCost(levels, i)));
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
            {MACHINES.map((m, i) => {
              const ready = water >= costs[i];
              return (
                <button
                  key={m.name}
                  className={`bar-slot${ready ? ' ready' : ''}`}
                  style={{ '--c': `var(--series-${i + 1})` } as CSSProperties}
                  disabled={!ready}
                  onClick={() => onBuy(i)}
                  aria-label={`${m.name}, level ${levels[i]}${ready ? ', can be bought' : ''}`}
                >
                  <span className="bar" style={{ height: pct(costs[i]) }} />
                </button>
              );
            })}
          </div>
          <div className="water" style={{ height: pct(water) }} />
        </div>
        <div className="bar-labels">
          {MACHINES.map((m, i) => (
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
