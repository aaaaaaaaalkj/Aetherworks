import {
  DEFAULT_BASE_PERIODS,
  IDENTITY_ORDER,
  isOrder,
  type MachineDef,
  machinesFor,
  NAMES,
  pulsePeriod,
  randomOrder,
  STARTING_CREDITS,
} from './machines';
import {
  assign,
  type Choice,
  COST,
  DURATION,
  emptyPools,
  isChoice,
  METRICS,
  multiplier,
  PAYOUT,
  type Pools,
  PRESTIGE_MIN_LEVEL,
  prestigePoints,
  randomMetric,
} from './prestige';

/** [game time in seconds, log10(credits held) or null when empty, log10(credits earned this run)] */
export type HistoryPoint = [number, number | null, number];

export interface GameState {
  credits: number;
  /** Everything deposited this run, including what was spent. */
  earned: number;
  levels: number[];
  /** Each machine's seconds per pulse at level 1; per machine so it can be changed later. */
  basePeriods: number[];
  /** Seconds into each machine's current pulse. */
  phases: number[];
  /** Credits each machine has produced this pulse, not yet in the balance. */
  pending: number[];
  /** Which cost ladder each slot got, dealt at random when the game starts. */
  order: number[];
  /** Game seconds since the start, including warped and skipped time. */
  time: number;
  history: HistoryPoint[];
  /** [game time, machine index] of every purchase. */
  purchases: [number, number][];
  /** Upgrades bought this run; squared, they are the prestige points. */
  upgrades: number;
  /** Highest level any machine has reached, over all runs. */
  bestLevel: number;
  /** Prestige points put into each machine and level, per metric. */
  pools: Pools;
  /** The metric this run's prestige can improve, drawn when the run starts. */
  prestigeMetric: number;
  /** [game time, points, choice] of every prestige; null for ones from before metrics were locked. */
  prestiges: [number, number, Choice | null][];
  /** Wall-clock time (ms) up to which the game has been simulated. */
  syncedAt: number;
}

const SAVE_KEY = 'aetherworks.save.v2';
const HISTORY_LIMIT = 2400;

export function freshState(): GameState {
  return {
    credits: STARTING_CREDITS,
    earned: STARTING_CREDITS,
    levels: NAMES.map(() => 0),
    basePeriods: [...DEFAULT_BASE_PERIODS],
    phases: NAMES.map(() => 0),
    pending: NAMES.map(() => 0),
    order: randomOrder(),
    time: 0,
    history: [[0, Math.log10(STARTING_CREDITS), Math.log10(STARTING_CREDITS)]],
    purchases: [],
    upgrades: 0,
    bestLevel: 0,
    pools: emptyPools(NAMES.length),
    prestigeMetric: randomMetric(),
    prestiges: [],
    syncedAt: Date.now(),
  };
}

/** A gap in wall-clock time longer than this counts as idle (closed, hidden, asleep). */
export const IDLE_THRESHOLD_S = 5;

/** Idle time is squared in hours: 0.5h -> 0.25h, 1h -> 1h, 2h -> 4h of game time. */
export function idleToGameSeconds(idleSeconds: number): number {
  return (idleSeconds * idleSeconds) / 3600;
}

/** How long to stay away to get this much game time. */
export function gameToIdleSeconds(gameSeconds: number): number {
  return Math.sqrt(gameSeconds * 3600);
}

export interface IdleReport {
  idleSeconds: number;
  gameSeconds: number;
}

/**
 * Brings the game up to the given wall-clock time. Short gaps are active play,
 * scaled by the warp speed. A long gap means the app was closed, in the
 * background or the machine was asleep; it is converted with the idle rule and
 * reported so the player can be told.
 */
export function sync(state: GameState, speed: number, nowMs: number): IdleReport | null {
  const gap = (nowMs - state.syncedAt) / 1000;
  state.syncedAt = nowMs;
  if (!(gap > 0)) return null;
  if (gap > IDLE_THRESHOLD_S) {
    const gameSeconds = idleToGameSeconds(gap);
    advance(state, gameSeconds, true);
    return { idleSeconds: gap, gameSeconds };
  }
  advance(state, gap * speed);
  return null;
}

export function machinesOf(state: GameState): MachineDef[] {
  return machinesFor(state.order);
}

/** Credits to take machine i to level L, after prestige boosts. */
export function costOf(state: GameState, i: number, L: number): number {
  return machinesOf(state)[i].cost(L) / multiplier(state.pools, i, COST, L);
}

/** Credits per second machine i makes at its current level, after prestige boosts. */
export function productionOf(state: GameState, i: number): number {
  const L = state.levels[i];
  return L > 0 ? machinesOf(state)[i].production(L) * multiplier(state.pools, i, PAYOUT, L) : 0;
}

export function totalRate(state: GameState): number {
  return NAMES.reduce((sum, _, i) => sum + productionOf(state, i), 0);
}

export function nextCost(state: GameState, i: number): number {
  return costOf(state, i, state.levels[i] + 1);
}

export function canBuy(state: GameState, i: number): boolean {
  return state.credits >= nextCost(state, i);
}

const logCredits = (c: number) => (c > 0 ? Math.log10(c) : null);

function spentOn(levels: number[], machines: MachineDef[]): number {
  let total = 0;
  levels.forEach((level, i) => {
    for (let L = 1; L <= level; L++) total += machines[i].cost(L);
  });
  return total;
}

/** Finest spacing between samples, in game seconds. */
const MIN_SPACING = 0.25;
/** An old sample survives thinning if it is at least this fraction of its age from its newer neighbour. */
const THIN_RATIO = 0.02;
const THIN_TRIGGER = 1500;

function record(state: GameState, force = false): void {
  const last = state.history[state.history.length - 1];
  if (!force && last && state.time - last[0] < MIN_SPACING) return;
  state.history.push([state.time, logCredits(state.credits), Math.log10(state.earned)]);
  if (state.history.length > THIN_TRIGGER) thin(state);
}

/**
 * The chart shows age on a log scale: recent history expanded, the distant past
 * compressed. Detail is kept in proportion to age, so the newest samples stay
 * dense and older ones thin out (about 115 samples per decade of age).
 */
function thin(state: GameState): void {
  const h = state.history;
  const now = state.time;
  const kept: HistoryPoint[] = [h[h.length - 1]];
  for (let k = h.length - 2; k > 0; k--) {
    const newer = kept[kept.length - 1];
    if (newer[0] - h[k][0] >= THIN_RATIO * (now - h[k][0])) kept.push(h[k]);
  }
  kept.push(h[0]);
  state.history = kept.reverse();
}

/** Seconds per pulse of each machine at its current level. */
export function periodsOf(state: GameState): number[] {
  return state.basePeriods.map(
    (base, i) => pulsePeriod(base, state.levels[i]) / multiplier(state.pools, i, DURATION, state.levels[i]),
  );
}

/** How far each machine's pulse has risen (0..1), or null for a machine not yet built. */
export function pulseProgress(state: GameState): (number | null)[] {
  const periods = periodsOf(state);
  return state.levels.map((level, i) => (level > 0 ? state.phases[i] / periods[i] : null));
}

/**
 * Runs every built machine for `dt` seconds. Production collects in the machine
 * and is deposited whenever its pulse reaches the top, so the total over time is
 * unchanged; only when it arrives depends on the period.
 */
function runMachines(state: GameState, prod: number[], periods: number[], dt: number): void {
  prod.forEach((rate, i) => {
    if (state.levels[i] <= 0) return;
    const period = periods[i];
    const t = state.phases[i] + dt;
    const pulses = Math.floor(t / period);
    if (pulses > 0) {
      // Everything produced up to the last pulse boundary goes into the balance.
      const deposit = state.pending[i] + rate * (pulses * period - state.phases[i]);
      state.credits += deposit;
      state.earned += deposit;
      state.phases[i] = t - pulses * period;
      state.pending[i] = rate * state.phases[i];
    } else {
      state.phases[i] = t;
      state.pending[i] += rate * dt;
    }
  });
}

/**
 * Advances game time. With `smooth`, a long jump (skip, time away) is recorded as
 * many samples that crowd toward its end, matching the chart's age axis.
 */
export function advance(state: GameState, dt: number, smooth = false): void {
  const machines = machinesOf(state);
  // Self-heal a state that predates the running total (e.g. kept alive across a hot reload).
  if (!Number.isFinite(state.earned)) state.earned = state.credits + spentOn(state.levels, machines);
  if (!state.basePeriods) Object.assign(state, { basePeriods: [...DEFAULT_BASE_PERIODS] });
  if (!state.phases) Object.assign(state, { phases: NAMES.map(() => 0), pending: NAMES.map(() => 0) });
  if (!state.pools) Object.assign(state, freshPrestige(state));
  const prod = machines.map((_, i) => productionOf(state, i));
  const periods = periodsOf(state);
  let remaining = dt;
  while (remaining > 0) {
    const step = smooth ? Math.min(remaining, Math.max(MIN_SPACING, remaining * 0.03)) : remaining;
    runMachines(state, prod, periods, step);
    state.time += step;
    remaining -= step;
    record(state);
  }
}

export function buy(state: GameState, i: number): boolean {
  if (!canBuy(state, i)) return false;
  record(state, true);
  state.credits = Math.max(0, state.credits - nextCost(state, i));
  state.levels[i] += 1;
  state.upgrades += 1;
  state.bestLevel = Math.max(state.bestLevel, state.levels[i]);
  state.purchases.push([state.time, i]);
  record(state, true);
  return true;
}

/** Prestige fields for a state that predates prestige. */
function freshPrestige(state: Pick<GameState, 'levels' | 'purchases'>) {
  return {
    upgrades: state.purchases.length,
    bestLevel: Math.max(0, ...state.levels),
    pools: emptyPools(NAMES.length),
    prestigeMetric: randomMetric(),
    prestiges: [] as [number, number, Choice | null][],
  };
}

export function canPrestige(state: GameState): boolean {
  return state.bestLevel >= PRESTIGE_MIN_LEVEL && state.upgrades > 0;
}

/**
 * Puts this run's points into the chosen pool of the locked metric and starts a
 * new run with a newly drawn metric: every machine back to level 0, credits back
 * to the starting amount. Game time, the history, the slot deal and all prestige
 * pools carry over.
 */
export function prestige(state: GameState, choice: Choice): boolean {
  if (!canPrestige(state) || choice.metric !== state.prestigeMetric) return false;
  const points = prestigePoints(state.upgrades);
  record(state, true);
  state.pools = assign(state.pools, choice, points);
  state.prestiges.push([state.time, points, choice]);
  state.levels = NAMES.map(() => 0);
  state.phases = NAMES.map(() => 0);
  state.pending = NAMES.map(() => 0);
  state.credits = STARTING_CREDITS;
  state.earned = STARTING_CREDITS;
  state.upgrades = 0;
  state.prestigeMetric = randomMetric();
  record(state, true);
  return true;
}

/**
 * Game seconds until the balance reaches `cost` with nothing bought meanwhile,
 * or null if nothing is being produced. Credits arrive in pulses, so this finds
 * the pulse that tips it over rather than dividing by the rate.
 */
export function timeToAfford(state: GameState, cost: number): number | null {
  const need = cost - state.credits;
  if (need <= 0) return 0;
  const periods = periodsOf(state);
  const built = NAMES.map((_, i) => i).filter((i) => state.levels[i] > 0);
  const prod = built.map((i) => productionOf(state, i));
  const rate = prod.reduce((a, b) => a + b, 0);
  if (!(rate > 0)) return null;
  // Credits deposited within t seconds: every finished pulse pays what was made up to it.
  const depositedBy = (t: number) =>
    built.reduce((sum, i, k) => {
      const pulses = Math.floor((state.phases[i] + t) / periods[i]);
      return pulses > 0 ? sum + state.pending[i] + prod[k] * (pulses * periods[i] - state.phases[i]) : sum;
    }, 0);
  let hi = need / rate + Math.max(...built.map((i) => periods[i]));
  while (depositedBy(hi) < need) hi *= 2;
  let lo = 0;
  for (let k = 0; k < 50 && hi - lo > 0.01; k++) {
    const mid = (lo + hi) / 2;
    if (depositedBy(mid) >= need) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** Game seconds until the cheapest next upgrade is affordable (0 if one already is), or null if never. */
export function timeToNextUpgrade(state: GameState): number | null {
  return timeToAfford(state, Math.min(...NAMES.map((_, i) => nextCost(state, i))));
}

/** Buys the cheapest affordable upgrade until none is left. Returns how many were bought. */
export function autoBuy(state: GameState): number {
  let bought = 0;
  for (;;) {
    let cheapest = -1;
    let cost = Infinity;
    NAMES.forEach((_, i) => {
      const c = nextCost(state, i);
      if (c <= state.credits && c < cost) {
        cost = c;
        cheapest = i;
      }
    });
    if (cheapest < 0 || !buy(state, cheapest)) return bought;
    bought++;
  }
}

function cleanPools(p: unknown): Pools {
  const pools = emptyPools(NAMES.length);
  const o = (p ?? {}) as Partial<Pools>;
  // Pools from before metrics were locked had no per-metric rows; they can't be
  // translated and start over.
  if (!Array.isArray(o.machine?.[0]) || !Array.isArray(o.level)) return pools;
  const num = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
  pools.machine = pools.machine.map((row, k) => row.map((_, i) => num(o.machine?.[k]?.[i])));
  pools.level = pools.level.map((_, k) => {
    const row: Record<number, number> = {};
    for (const [L, v] of Object.entries(o.level?.[k] ?? {})) if (num(v) > 0) row[Number(L)] = num(v);
    return row;
  });
  return pools;
}

/** Drops unusable samples and fills in a missing total from the held balance. */
function cleanHistory(history: unknown[]): HistoryPoint[] {
  const out: HistoryPoint[] = [];
  for (const p of history) {
    if (!Array.isArray(p) || !Number.isFinite(p[0])) continue;
    const held = Number.isFinite(p[1]) ? (p[1] as number) : null;
    const earned = Number.isFinite(p[2]) ? (p[2] as number) : held;
    if (earned !== null) out.push([p[0], held, earned]);
  }
  return out;
}

/** Loads the save. Time spent away is applied by the first sync(). */
export function loadGame(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as GameState;
      const levels = NAMES.map((_, i) => Math.max(0, Math.floor(s.levels?.[i] ?? 0)));
      // Saves from before the shuffle keep the original left-to-right ladders.
      const order = isOrder(s.order) ? s.order : IDENTITY_ORDER;
      const credits = Number.isFinite(s.credits) ? s.credits : STARTING_CREDITS;
      const nums = (a: unknown, fallback: number[], min: number) =>
        NAMES.map((_, i) => {
          const v = Array.isArray(a) ? Number(a[i]) : NaN;
          return Number.isFinite(v) && v >= min ? v : fallback[i];
        });
      // Saves from before levels slowed pulses stored the level-1 periods as `periods`.
      const legacy = s as { periods?: unknown };
      const basePeriods = nums(s.basePeriods ?? legacy.periods, DEFAULT_BASE_PERIODS, 0.001);
      const zeros = NAMES.map(() => 0);
      const state: GameState = {
        credits,
        // Older saves lack a running total; it is recoverable from what was bought.
        earned: Number.isFinite(s.earned) ? s.earned : credits + spentOn(levels, machinesFor(order)),
        levels,
        // Older saves had continuous production; their machines start a fresh pulse.
        basePeriods,
        phases: nums(s.phases, zeros, 0).map((p, i) => Math.min(p, pulsePeriod(basePeriods[i], levels[i]))),
        pending: nums(s.pending, zeros, 0),
        order,
        time: s.time ?? 0,
        history: Array.isArray(s.history) ? cleanHistory(s.history) : [],
        purchases: Array.isArray(s.purchases) ? s.purchases : [],
        ...freshPrestige({ levels, purchases: Array.isArray(s.purchases) ? s.purchases : [] }),
        // Older saves stored the save time as savedAt.
        syncedAt: s.syncedAt ?? (s as { savedAt?: number }).savedAt ?? Date.now(),
      };
      if ('pools' in s) {
        state.upgrades = Number.isFinite(s.upgrades) ? s.upgrades : state.upgrades;
        state.bestLevel = Math.max(state.bestLevel, Number.isFinite(s.bestLevel) ? s.bestLevel : 0);
        state.pools = cleanPools(s.pools);
        if (Number.isInteger(s.prestigeMetric) && s.prestigeMetric >= 0 && s.prestigeMetric < METRICS.length)
          state.prestigeMetric = s.prestigeMetric;
        // Older prestiges keep their place on the chart but no longer count for anything.
        state.prestiges = Array.isArray(s.prestiges)
          ? s.prestiges
              .filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
              .map(([t, pts, c]) => [t, pts, isChoice(c) ? c : null])
          : [];
      }
      return state;
    }
  } catch {
    // Unreadable save or blocked storage: start fresh.
  }
  return freshState();
}

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable; the game still runs, it just won't persist.
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
