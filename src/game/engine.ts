import { MACHINES, STARTING_CREDITS } from './machines';

/** [game time in seconds, log10(credits held) or null when empty, log10(credits earned in total)] */
export type HistoryPoint = [number, number | null, number];

export interface GameState {
  credits: number;
  /** Everything ever produced, including what was spent. */
  earned: number;
  levels: number[];
  /** Game seconds since the start, including warped and skipped time. */
  time: number;
  history: HistoryPoint[];
  /** [game time, machine index] of every purchase. */
  purchases: [number, number][];
  savedAt: number;
}

const SAVE_KEY = 'aetherworks.save.v2';
const HISTORY_LIMIT = 2400;

export function freshState(): GameState {
  return {
    credits: STARTING_CREDITS,
    earned: STARTING_CREDITS,
    levels: MACHINES.map(() => 0),
    time: 0,
    history: [[0, Math.log10(STARTING_CREDITS), Math.log10(STARTING_CREDITS)]],
    purchases: [],
    savedAt: Date.now(),
  };
}

export function totalRate(levels: number[]): number {
  return MACHINES.reduce((sum, m, i) => sum + m.production(levels[i]), 0);
}

export function nextCost(levels: number[], i: number): number {
  return MACHINES[i].cost(levels[i] + 1);
}

export function canBuy(state: GameState, i: number): boolean {
  return state.credits >= nextCost(state.levels, i);
}

const logCredits = (c: number) => (c > 0 ? Math.log10(c) : null);

function spentOn(levels: number[]): number {
  let total = 0;
  levels.forEach((level, i) => {
    for (let L = 1; L <= level; L++) total += MACHINES[i].cost(L);
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

/**
 * Advances game time. With `smooth`, a long jump (skip, time away) is recorded as
 * many samples that crowd toward its end, matching the chart's age axis.
 */
export function advance(state: GameState, dt: number, rate: number, smooth = false): void {
  // Self-heal a state that predates the running total (e.g. kept alive across a hot reload).
  if (!Number.isFinite(state.earned)) state.earned = state.credits + spentOn(state.levels);
  let remaining = dt;
  while (remaining > 0) {
    const step = smooth ? Math.min(remaining, Math.max(MIN_SPACING, remaining * 0.03)) : remaining;
    state.credits += rate * step;
    state.earned += rate * step;
    state.time += step;
    remaining -= step;
    record(state);
  }
}

export function buy(state: GameState, i: number): boolean {
  if (!canBuy(state, i)) return false;
  record(state, true);
  state.credits = Math.max(0, state.credits - nextCost(state.levels, i));
  state.levels[i] += 1;
  state.purchases.push([state.time, i]);
  record(state, true);
  return true;
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

/** Loads the save and credits the time spent away. */
export function loadGame(): { state: GameState; awaySeconds: number } {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as GameState;
      const levels = MACHINES.map((_, i) => Math.max(0, Math.floor(s.levels?.[i] ?? 0)));
      const credits = Number.isFinite(s.credits) ? s.credits : STARTING_CREDITS;
      const state: GameState = {
        credits,
        // Older saves lack a running total; it is recoverable from what was bought.
        earned: Number.isFinite(s.earned) ? s.earned : credits + spentOn(levels),
        levels,
        time: s.time ?? 0,
        history: Array.isArray(s.history) ? cleanHistory(s.history) : [],
        purchases: Array.isArray(s.purchases) ? s.purchases : [],
        savedAt: s.savedAt ?? Date.now(),
      };
      const awaySeconds = Math.max(0, (Date.now() - state.savedAt) / 1000);
      advance(state, awaySeconds, totalRate(state.levels), true);
      return { state, awaySeconds };
    }
  } catch {
    // Unreadable save or blocked storage: start fresh.
  }
  return { state: freshState(), awaySeconds: 0 };
}

export function saveGame(state: GameState): void {
  state.savedAt = Date.now();
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
