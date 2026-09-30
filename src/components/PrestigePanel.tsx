import { type CSSProperties, Fragment, useState } from 'react';
import { canPrestige, type GameState } from '../game/engine';
import { formatLog } from '../game/format';
import { NAMES } from '../game/machines';
import {
  assign,
  BOOST_EXPONENT,
  type Choice,
  choosableLevels,
  METRICS,
  multiplier,
  type Pools,
  PRESTIGE_MIN_LEVEL,
  prestigePoints,
  sameChoice,
} from '../game/prestige';

interface Props {
  state: GameState;
  onPrestige: (choice: Choice) => void;
}

const formatPoints = (p: number) => (p < 1e6 ? Math.round(p).toLocaleString('en-US') : formatLog(Math.log10(p)));

/** "×2.4", "÷120"; blank when there is no boost. */
function formatMult(m: number, metric: number): string {
  if (m < 1.005) return '';
  const sign = metric === 1 ? '×' : '÷';
  if (m < 10) return sign + m.toFixed(1);
  if (m < 10_000) return sign + Math.round(m);
  return sign + formatLog(Math.log10(m));
}

const choiceLabel = (c: Choice) =>
  c.kind === 'machine' ? NAMES[c.index] : c.kind === 'metric' ? METRICS[c.index] : `level ${c.index}`;

/**
 * The prestige screen: 14 pools to put this run's points into, and a heatmap of
 * the boosts on the three highest levels (metrics × levels down, machines across).
 * Hovering or picking a pool previews its effect in the heatmap.
 */
export function PrestigePanel({ state, onPrestige }: Props) {
  const [picked, setPicked] = useState<Choice | null>(null);
  const [hovered, setHovered] = useState<Choice | null>(null);

  const levels = choosableLevels(state.bestLevel);
  if (levels.length === 0) {
    return (
      <section className="panel prestige">
        <p className="prestige-intro">
          Prestige unlocks when a machine reaches level {PRESTIGE_MIN_LEVEL}. Your best so far is level{' '}
          {state.bestLevel}.
        </p>
      </section>
    );
  }

  const points = prestigePoints(state.upgrades);
  const ready = canPrestige(state);
  const preview = hovered ?? picked;
  const after: Pools | null = preview && ready ? assign(state.pools, preview, points) : null;
  const pools = state.pools;

  // Heat is scaled to the strongest boost on screen, before or after the preview.
  let maxLog = Math.log10(2);
  for (let metric = 0; metric < METRICS.length; metric++)
    for (const L of levels)
      for (let m = 0; m < NAMES.length; m++)
        for (const p of after ? [pools, after] : [pools]) maxLog = Math.max(maxLog, Math.log10(multiplier(p, m, metric, L)));

  // A pool is picked by clicking and previewed by hovering; all its buttons light up together.
  const option = (choice: Choice, extra = '') => ({
    className: `option ${extra}${sameChoice(choice, picked) ? ' on' : ''}${sameChoice(choice, hovered) ? ' hover' : ''}`,
    onClick: () => setPicked(sameChoice(choice, picked) ? null : choice),
    onPointerEnter: () => setHovered(choice),
    onPointerLeave: () => setHovered(null),
    disabled: !ready,
  });

  return (
    <section className="panel prestige">
      <div className="prestige-bar">
        <p className="prestige-intro">
          {ready ? (
            <>
              {state.upgrades} upgrades this run = <strong>{formatPoints(points)} points</strong>. Pick where they go:
              a machine, a metric or a level.
            </>
          ) : (
            <>Buy an upgrade this run to earn prestige points.</>
          )}
        </p>
        <button className="prestige-go" disabled={!ready || !picked} onClick={() => picked && onPrestige(picked)}>
          {picked ? `Prestige: ${formatPoints(points)} to ${choiceLabel(picked)}` : 'Prestige'}
        </button>
      </div>

      <div className="heatmap" role="grid" aria-label="Prestige boosts by metric, level and machine">
        <div className="hm-corner" />
        {NAMES.map((name, m) => (
          <button
            key={name}
            {...option({ kind: 'machine', index: m })}
            style={{ '--c': `var(--series-${m + 1})` } as CSSProperties}
            title={`${name}: ${formatPoints(pools.machine[m])} points`}
          >
            <span className="chip" />
            <span className="pts">{formatPoints(pools.machine[m])}</span>
          </button>
        ))}

        {METRICS.map((metricName, metric) => (
          <Fragment key={metricName}>
            <button
              {...option({ kind: 'metric', index: metric }, 'hm-metric')}
              style={{ gridRow: `span ${levels.length}` }}
              title={`${metricName}: ${formatPoints(pools.metric[metric])} points`}
            >
              {metricName}
              <span className="pts">{formatPoints(pools.metric[metric])}</span>
            </button>
            {levels.map((L) => (
              <Fragment key={L}>
                <button
                  {...option({ kind: 'level', index: L }, 'hm-level')}
                  title={`Level ${L}: ${formatPoints(pools.level[L] ?? 0)} points`}
                >
                  L{L}
                  <span className="pts">{formatPoints(pools.level[L] ?? 0)}</span>
                </button>
                {NAMES.map((name, m) => {
                  const now = multiplier(pools, m, metric, L);
                  const next = after ? multiplier(after, m, metric, L) : now;
                  const heat = Math.log10(next) / maxLog;
                  const changed = next > now * 1.0001;
                  return (
                    <div
                      key={name}
                      role="gridcell"
                      className={`hm-cell${changed ? ' changed' : ''}${heat > 0.55 ? ' strong' : ''}`}
                      style={{ '--heat': `${Math.round(heat * 100)}%` } as CSSProperties}
                      title={`${name}, level ${L}, ${metricName.toLowerCase()}: ${formatMult(now, metric) || 'no boost'}${
                        changed ? ` → ${formatMult(next, metric)}` : ''
                      }`}
                    >
                      {formatMult(next, metric)}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </Fragment>
        ))}
      </div>
      <p className="prestige-foot">
        Boost = machine × metric × level points; effect (1 + boost)
        <sup>1/{Math.round(1 / BOOST_EXPONENT)}</sup>. Cost and duration are divided by it, payout multiplied. Prestige resets machines and credits; lower levels keep their boosts.
      </p>
    </section>
  );
}
