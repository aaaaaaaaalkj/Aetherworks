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

export interface MachineDef {
  name: string;
  cost: (level: number) => number;
  production: (level: number) => number;
}

/** Average number of decades between consecutive levels of one machine. */
const STEP = 5.5;

function machine(
  name: string,
  offset: number,
  wobble: (n: number) => number,
  paybackBase: number,
  scaleDrag: number,
): MachineDef {
  const logCost = (L: number) => offset + STEP * (L - 1) + wobble(L - 1);
  return {
    name,
    cost: (L) => 10 ** logCost(L),
    production: (L) => (L <= 0 ? 0 : 10 ** (logCost(L) * (1 - scaleDrag)) / paybackBase),
  };
}

// Offsets were found by searching for the arrangement that minimises the largest
// gap in the combined ladder over the first ~240 decades of cost.
export const MACHINES: MachineDef[] = [
  machine('Coil', 0, () => 0, 8, 0.02),
  machine('Mill', 1.14, () => 0, 16, 0.021),
  machine('Reactor', 2.03, (n) => [0, -0.25, -0.5, 0.25][n % 4], 18, 0.021),
  machine('Pump', 2.58, (n) => 0.35 * (n % 2), 22, 0.019),
  machine('Loom', 3.34, (n) => 0.4 * Math.sin(n * 0.33), 28, 0.017),
  machine('Engine', 3.91, (n) => 0.6 * ((n * 0.37) % 1) - 0.3, 20, 0.022),
  machine('Orrery', 4.39, (n) => 0.35 * Math.sin(n * 1.9 + 1), 24, 0.02),
  machine('Press', 4.76, (n) => 0.4 * Math.sin(n * 0.9), 26, 0.018),
];

/** Exactly enough to build the first Coil. */
export const STARTING_CREDITS = 1;
