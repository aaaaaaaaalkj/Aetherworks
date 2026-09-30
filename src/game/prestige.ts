// Prestige
// --------
// A run's upgrades, squared, become prestige points. Each prestige puts all of
// its points into one of 14 pools: one of the 8 machines, one of the 3 metrics,
// or one of the 3 highest levels reached so far. The boost for a metric of a
// machine at a level is the product of the three pools that meet there:
//
//   boost(machine, metric, level) = machinePts × metricPts × levelPts
//
// A boost only exists where all three pools are filled. Its effect is
//
//   multiplier = (1 + boost) ^ BOOST_EXPONENT
//
// Since a boost is points cubed, the exponent 1/6 makes this the square root of
// the three pools' geometric mean: three prestiges of 500 points give ×22, three
// of 8,000 give ×90. Payout is multiplied by it; cost and pulse duration are
// divided by it. A boost stays in force for that level even once the level is no
// longer among the three highest and can't be chosen any more.

export const METRICS = ['Cost', 'Payout', 'Duration'] as const;
export const COST = 0;
export const PAYOUT = 1;
export const DURATION = 2;

export const BOOST_EXPONENT = 1 / 6;

/** Prestige unlocks once some machine has reached this level, so there are three levels to pick from. */
export const PRESTIGE_MIN_LEVEL = 3;

export type Choice = { kind: 'machine' | 'metric' | 'level'; index: number };

export interface Pools {
  machine: number[];
  metric: number[];
  /** Points per level; keys are levels. */
  level: Record<number, number>;
}

export function emptyPools(machines: number): Pools {
  return { machine: Array(machines).fill(0), metric: METRICS.map(() => 0), level: {} };
}

export function assign(pools: Pools, choice: Choice, points: number): Pools {
  const next: Pools = { machine: [...pools.machine], metric: [...pools.metric], level: { ...pools.level } };
  if (choice.kind === 'machine') next.machine[choice.index] += points;
  else if (choice.kind === 'metric') next.metric[choice.index] += points;
  else next.level[choice.index] = (next.level[choice.index] ?? 0) + points;
  return next;
}

export function boost(pools: Pools, machine: number, metric: number, level: number): number {
  return pools.machine[machine] * pools.metric[metric] * (pools.level[level] ?? 0);
}

export function multiplier(pools: Pools, machine: number, metric: number, level: number): number {
  return (1 + boost(pools, machine, metric, level)) ** BOOST_EXPONENT;
}

/** The three levels that can still take points, highest first. */
export function choosableLevels(bestLevel: number): number[] {
  return bestLevel < PRESTIGE_MIN_LEVEL ? [] : [bestLevel, bestLevel - 1, bestLevel - 2];
}

export function prestigePoints(upgrades: number): number {
  return upgrades * upgrades;
}

export function sameChoice(a: Choice | null, b: Choice | null): boolean {
  return !!a && !!b && a.kind === b.kind && a.index === b.index;
}

export function isChoice(c: unknown): c is Choice {
  const o = c as Choice;
  return !!o && ['machine', 'metric', 'level'].includes(o.kind) && Number.isInteger(o.index) && o.index >= 0;
}
