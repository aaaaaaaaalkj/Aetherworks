// Prestige
// --------
// A run's upgrades, squared, become prestige points. Every run draws one metric
// at random (cost, payout or pulse duration) and locks it: that run's prestige
// can only improve that metric. The points all go into one of 11 pools for the
// locked metric: one of the 8 machines, or one of the 3 highest levels reached
// so far. Every pool starts at 1 and grows by the points put into it. The boost
// for a metric of a machine at a level is the product of the two pools of that
// metric that meet there:
//
//   boost(machine, metric, level) = machine pool[metric] × level pool[metric]
//
// It is 1 everywhere at the start, so the first prestige already has an effect.
// The effect is
//
//   multiplier = boost ^ BOOST_EXPONENT
//
// Since a boost is a product of two pools, the exponent 1/4 makes this the
// square root of their geometric mean: one prestige of 500 points gives ×4.7 to
// everything it touches, one each into a machine and a level of 500 gives ×22
// where they meet, 8,000 each gives ×90. Payout is multiplied by it; cost and
// pulse duration are divided by it. A level's boost stays in force even once the
// level is no longer among the three highest and can't be chosen any more.

export const METRICS = ['Cost', 'Payout', 'Duration'] as const;
export const COST = 0;
export const PAYOUT = 1;
export const DURATION = 2;

export const BOOST_EXPONENT = 1 / 4;

/** Prestige unlocks once some machine has reached this level, so there are three levels to pick from. */
export const PRESTIGE_MIN_LEVEL = 3;

/** A pool of the run's locked metric: a machine or a level. */
export type Choice = { kind: 'machine' | 'level'; index: number; metric: number };

/** Points put into each pool, per metric. A pool's value is 1 plus its points. */
export interface Pools {
  /** [metric][machine] */
  machine: number[][];
  /** [metric] -> level -> points */
  level: Record<number, number>[];
}

export function emptyPools(machines: number): Pools {
  return {
    machine: METRICS.map(() => Array(machines).fill(0)),
    level: METRICS.map(() => ({})),
  };
}

export function randomMetric(): number {
  return Math.floor(Math.random() * METRICS.length);
}

/** What a pool counts for in a boost: 1 plus the points put into it. */
export function poolValue(pools: Pools, choice: Choice): number {
  const pts =
    choice.kind === 'machine'
      ? pools.machine[choice.metric][choice.index]
      : (pools.level[choice.metric][choice.index] ?? 0);
  return 1 + pts;
}

export function assign(pools: Pools, choice: Choice, points: number): Pools {
  const next: Pools = {
    machine: pools.machine.map((row) => [...row]),
    level: pools.level.map((row) => ({ ...row })),
  };
  if (choice.kind === 'machine') next.machine[choice.metric][choice.index] += points;
  else next.level[choice.metric][choice.index] = (next.level[choice.metric][choice.index] ?? 0) + points;
  return next;
}

export function boost(pools: Pools, machine: number, metric: number, level: number): number {
  return (
    poolValue(pools, { kind: 'machine', index: machine, metric }) *
    poolValue(pools, { kind: 'level', index: level, metric })
  );
}

export function multiplier(pools: Pools, machine: number, metric: number, level: number): number {
  return boost(pools, machine, metric, level) ** BOOST_EXPONENT;
}

/** The three levels that can still take points, highest first. */
export function choosableLevels(bestLevel: number): number[] {
  return bestLevel < PRESTIGE_MIN_LEVEL ? [] : [bestLevel, bestLevel - 1, bestLevel - 2];
}

export function prestigePoints(upgrades: number): number {
  return upgrades * upgrades;
}

export function sameChoice(a: Choice | null, b: Choice | null): boolean {
  return !!a && !!b && a.kind === b.kind && a.index === b.index && a.metric === b.metric;
}

export function isChoice(c: unknown): c is Choice {
  const o = c as Choice;
  return (
    !!o &&
    (o.kind === 'machine' || o.kind === 'level') &&
    Number.isInteger(o.index) &&
    o.index >= 0 &&
    Number.isInteger(o.metric) &&
    o.metric >= 0 &&
    o.metric < METRICS.length
  );
}

export function describeChoice(c: Choice, names: readonly string[]): string {
  const where = c.kind === 'machine' ? names[c.index] : `level ${c.index}`;
  return `${METRICS[c.metric].toLowerCase()} of ${where}`;
}
