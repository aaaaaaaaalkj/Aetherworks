// Every machine is fully described by two functions of its level:
//   cost(L)       credits needed to go from level L-1 to level L   (L >= 1)
//   production(L) credits per second produced at level L           (production(0) = 0)
//
// Economy design
// --------------
// Each machine climbs a very steep cost ladder: on average every level costs
// 10^5.5 (~300,000x) more than the one before. A level pays for itself within
// minutes to hours, but a machine's own output needs months to years to afford
// its next level. Progress therefore comes from combining machines: the ladders
// all share the same average step, and their offsets are interleaved so that
// the union of all next levels forms a dense ladder (on average ~5x apart, never
// more than ~14x). There is always some machine whose next level is within reach
// of the combined production.
//
// Each ladder wobbles around the common average step in its own bounded pattern,
// and each machine has its own efficiency, so which machine dominates production
// keeps shifting.
//
// Payback time grows slowly with scale (production ~ cost^(1-k)), so the game
// starts with purchases every minute or two and settles into hours, then days.
//
// Each new game deals the eight ladders out to the eight slots in a random
// order, so buying the cheapest upgrade doesn't sweep the slots left to right.
// The ladders themselves stay as tuned, so every game paces the same.

export interface MachineDef {
  name: string;
  cost: (level: number) => number;
  production: (level: number) => number;
}

/** Average number of decades between consecutive levels of one machine. */
const STEP = 5.5;

interface Ladder {
  offset: number;
  wobble: (n: number) => number;
  paybackBase: number;
  scaleDrag: number;
}

function machine(name: string, { offset, wobble, paybackBase, scaleDrag }: Ladder): MachineDef {
  const logCost = (L: number) => offset + STEP * (L - 1) + wobble(L - 1);
  return {
    name,
    cost: (L) => 10 ** logCost(L),
    production: (L) => (L <= 0 ? 0 : 10 ** (logCost(L) * (1 - scaleDrag)) / paybackBase),
  };
}

/** Slot names, left to right; colours and keys 1–8 follow the slot. */
export const NAMES = ['Coil', 'Mill', 'Reactor', 'Pump', 'Loom', 'Engine', 'Orrery', 'Press'];

// Offsets were found by searching for the arrangement that minimises the largest
// gap in the combined ladder over the first ~240 decades of cost.
const LADDERS: Ladder[] = [
  { offset: 0, wobble: () => 0, paybackBase: 8, scaleDrag: 0.02 },
  { offset: 1.14, wobble: () => 0, paybackBase: 16, scaleDrag: 0.021 },
  { offset: 2.03, wobble: (n) => [0, -0.25, -0.5, 0.25][n % 4], paybackBase: 18, scaleDrag: 0.021 },
  { offset: 2.58, wobble: (n) => 0.35 * (n % 2), paybackBase: 22, scaleDrag: 0.019 },
  { offset: 3.34, wobble: (n) => 0.4 * Math.sin(n * 0.33), paybackBase: 28, scaleDrag: 0.017 },
  { offset: 3.91, wobble: (n) => 0.6 * ((n * 0.37) % 1) - 0.3, paybackBase: 20, scaleDrag: 0.022 },
  { offset: 4.39, wobble: (n) => 0.35 * Math.sin(n * 1.9 + 1), paybackBase: 24, scaleDrag: 0.02 },
  { offset: 4.76, wobble: (n) => 0.4 * Math.sin(n * 0.9), paybackBase: 26, scaleDrag: 0.018 },
];

/** Which ladder each slot gets. Saves from before the shuffle use this one. */
export const IDENTITY_ORDER = LADDERS.map((_, i) => i);

export function randomOrder(): number[] {
  const order = [...IDENTITY_ORDER];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function isOrder(order: unknown): order is number[] {
  return Array.isArray(order) && order.length === LADDERS.length && IDENTITY_ORDER.every((i) => order.includes(i));
}

const built = new Map<string, MachineDef[]>();

/** The machines for a given deal of ladders to slots. */
export function machinesFor(order: number[]): MachineDef[] {
  const key = order.join();
  let machines = built.get(key);
  if (!machines) {
    machines = order.map((ladder, slot) => machine(NAMES[slot], LADDERS[ladder]));
    built.set(key, machines);
  }
  return machines;
}

/** Exactly enough to build the cheapest first level. */
export const STARTING_CREDITS = 1;

/**
 * Default seconds between a slot's pulses at level 1, left (fast) to right (slow).
 * Credits pile up inside a machine and reach the balance when its pulse tops out;
 * the period only changes when credits arrive, never how many.
 */
export const DEFAULT_BASE_PERIODS = [5, 10, 20, 40, 75, 150, 300, 600];

/** Every level after the first makes a machine's pulse this much longer. */
export const PERIOD_GROWTH = 1.5;

/** Seconds per pulse for a machine with the given level-1 period at the given level. */
export function pulsePeriod(basePeriod: number, level: number): number {
  return basePeriod * PERIOD_GROWTH ** Math.max(0, level - 1);
}
