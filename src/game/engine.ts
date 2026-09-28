import { MACHINES, STARTING_CREDITS } from './machines';

export interface GameState {
  credits: number;
  levels: number[];
  savedAt: number;
}

const SAVE_KEY = 'aetherworks.save.v1';

export function freshState(): GameState {
  return { credits: STARTING_CREDITS, levels: MACHINES.map(() => 0), savedAt: Date.now() };
}

export function totalRate(levels: number[]): number {
  return MACHINES.reduce((sum, m, i) => sum + m.production(levels[i] ?? 0), 0);
}

export function isUnlocked(levels: number[], i: number): boolean {
  return i === 0 || levels[i - 1] >= 1;
}

export function nextCost(levels: number[], i: number): number {
  return MACHINES[i].cost(levels[i] + 1);
}

export function canBuy(state: GameState, i: number): boolean {
  return isUnlocked(state.levels, i) && state.credits >= nextCost(state.levels, i);
}

export function buy(state: GameState, i: number): boolean {
  if (!canBuy(state, i)) return false;
  state.credits -= nextCost(state.levels, i);
  state.levels[i] += 1;
  return true;
}

/** Loads the save and credits the time spent away. Returns the away duration in ms. */
export function loadGame(): { state: GameState; awayMs: number } {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GameState;
      const levels = MACHINES.map((_, i) => Math.max(0, Math.floor(parsed.levels?.[i] ?? 0)));
      const state: GameState = {
        credits: Number.isFinite(parsed.credits) ? parsed.credits : STARTING_CREDITS,
        levels,
        savedAt: parsed.savedAt ?? Date.now(),
      };
      const awayMs = Math.max(0, Date.now() - state.savedAt);
      state.credits += (totalRate(levels) * awayMs) / 1000;
      state.savedAt = Date.now();
      return { state, awayMs };
    }
  } catch {
    // Unreadable save or blocked storage: start fresh.
  }
  return { state: freshState(), awayMs: 0 };
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
