import { type CSSProperties, Fragment, useState } from 'react';
import { canPrestige, type GameState } from '../game/engine';
import { formatLog } from '../game/format';
import { NAMES } from '../game/machines';
import {
  assign,
  type Choice,
  choosableLevels,
  describeChoice,
  METRICS,
  multiplier,
  PAYOUT,
  poolValue,
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
  const sign = metric === PAYOUT ? '×' : '÷';
  if (m < 10) return sign + m.toFixed(1);
  if (m < 10_000) return sign + Math.round(m);
  return sign + formatLog(Math.log10(m));
}

/**
 * The prestige screen. Each run locks one metric; its points go into one of the
 * 8 machines or one of the 3 highest levels, for that metric only. The heatmap
 * shows that metric's boosts (levels down, machines across); hovering or picking
 * a pool previews the change.
 */
export function PrestigePanel({ state, onPrestige }: Props) {
  const [picked, setPicked] = useState<Choice | null>(null);
  const [hovered, setHovered] = useState<Choice | null>(null);
  const [help, setHelp] = useState(false);

  const metric = state.prestigeMetric;
  const metricName = METRICS[metric];
  const levels = choosableLevels(state.bestLevel);
  const points = prestigePoints(state.upgrades);
  const ready = canPrestige(state);
  // A pick from an earlier run (another metric or levels) no longer applies.
  const pick =
    picked && picked.metric === metric && (picked.kind === 'machine' || levels.includes(picked.index)) ? picked : null;
  const preview = hovered ?? pick;
  const pools = state.pools;
  const after: Pools | null = preview && ready ? assign(pools, preview, points) : null;

  let maxLog = Math.log10(2);
  for (const L of levels)
    for (let m = 0; m < NAMES.length; m++)
      for (const p of after ? [pools, after] : [pools]) maxLog = Math.max(maxLog, Math.log10(multiplier(p, m, metric, L)));

  // Picked by clicking (again to unpick), previewed by hovering with a mouse.
  const option = (choice: Choice, extra: string) => ({
    className: `option ${extra}${sameChoice(choice, pick) ? ' on' : ''}${sameChoice(choice, hovered) ? ' hover' : ''}`,
    onClick: () => setPicked(sameChoice(choice, pick) ? null : choice),
    onPointerEnter: (e: React.PointerEvent) => e.pointerType === 'mouse' && setHovered(choice),
    onPointerLeave: () => setHovered(null),
    disabled: !ready,
  });

  const status = !levels.length
    ? `Unlocks at level ${PRESTIGE_MIN_LEVEL} (best so far: ${state.bestLevel})`
    : ready
      ? null
      : 'Buy an upgrade to earn points';

  return (
    <section className="panel prestige">
      <div className="prestige-bar">
        <span className="metric-lock" title="Drawn at random for this run">
          {metricName}
        </span>
        <span className="prestige-points">
          {status ?? (
            <>
              {state.upgrades}² = <strong>{formatPoints(points)}</strong> pts
            </>
          )}
        </span>
        <button
          className={`help-toggle${help ? ' on' : ''}`}
          onClick={() => setHelp(!help)}
          aria-expanded={help}
          aria-label="How prestige works"
        >
          ?
        </button>
        <button className="prestige-go" disabled={!ready || !pick} onClick={() => pick && onPrestige(pick)}>
          {pick ? `Prestige → ${pick.kind === 'machine' ? NAMES[pick.index] : `L${pick.index}`}` : 'Prestige'}
        </button>
      </div>

      {help ? (
        <div className="prestige-help">
          <p>
            Each run locks one metric at random; this run it is <strong>{metricName.toLowerCase()}</strong>. Prestige
            points are this run's upgrades squared. Put them all into one machine or one of your three highest levels,
            for that metric only.
          </p>
          <p>
            A cell's boost is its machine's pool × its level's pool, each 1 plus the points put in, and it acts as
            boost<sup>1/4</sup>: cost and duration are divided by it, payout multiplied.
          </p>
          <p>Prestige resets machines and credits. Levels that drop out of the top three keep their boosts.</p>
        </div>
      ) : (
        levels.length > 0 && (
          <div className="heatmap" role="grid" aria-label={`${metricName} boosts by level and machine`}>
            <div />
            {NAMES.map((name, m) => {
              const c: Choice = { kind: 'machine', index: m, metric };
              return (
                <button
                  key={name}
                  {...option(c, 'hm-machine')}
                  style={{ '--c': `var(--series-${m + 1})` } as CSSProperties}
                  title={`${name}'s ${metricName.toLowerCase()} pool: ${formatPoints(poolValue(pools, c))}`}
                >
                  <span className="chip" />
                  <span className="pts">{formatPoints(poolValue(pools, c))}</span>
                </button>
              );
            })}
            {levels.map((L) => {
              const c: Choice = { kind: 'level', index: L, metric };
              return (
                <Fragment key={L}>
                  <button
                    {...option(c, 'hm-level')}
                    title={`Level ${L}'s ${metricName.toLowerCase()} pool: ${formatPoints(poolValue(pools, c))}`}
                  >
                    L{L}
                    <span className="pts">{formatPoints(poolValue(pools, c))}</span>
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
                        title={`${name}, level ${L}: ${formatMult(now, metric) || 'no boost'}${
                          changed ? ` → ${formatMult(next, metric)}` : ''
                        }`}
                      >
                        {formatMult(next, metric)}
                      </div>
                    );
                  })}
                </Fragment>
              );
            })}
          </div>
        )
      )}
      {!help && pick && ready && (
        <p className="prestige-note">
          {formatPoints(points)} points into the {describeChoice(pick, NAMES)}. Machines and credits reset.
        </p>
      )}
    </section>
  );
}
