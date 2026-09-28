// Every machine is fully described by two hidden functions of its level:
//   cost(L)       credits needed to go from level L-1 to level L   (L >= 1)
//   production(L) credits per second produced at level L           (L >= 0, production(0) = 0)
// None of these values are ever shown to the player.

export type MachineKind =
  | 'coil'
  | 'gears'
  | 'bloom'
  | 'pump'
  | 'prism'
  | 'hourglass'
  | 'orrery'
  | 'singularity';

export interface MachineDef {
  kind: MachineKind;
  name: string;
  epithet: string;
  hue: string;
  hue2: string;
  cost: (level: number) => number;
  production: (level: number) => number;
}

const zeroAtZero =
  (f: (level: number) => number) =>
  (level: number): number =>
    level <= 0 ? 0 : f(level);

export const MACHINES: MachineDef[] = [
  {
    kind: 'coil',
    name: 'Spark Coil',
    epithet: 'Lightning in a jar',
    hue: '#5ee7ff',
    hue2: '#b18cff',
    cost: (L) => 10 * 1.13 ** (L - 1),
    production: zeroAtZero((L) => L * 1.6 ** Math.floor(L / 25)),
  },
  {
    kind: 'gears',
    name: 'Gear Mill',
    epithet: 'Teeth that never tire',
    hue: '#ffb547',
    hue2: '#ff7a3d',
    cost: (L) => 140 * 1.15 ** (L - 1),
    production: zeroAtZero((L) => 7 * L * 2 ** Math.floor(L / 10)),
  },
  {
    kind: 'bloom',
    name: 'Bloom Reactor',
    epithet: 'A flower of fusion',
    hue: '#ff5fa2',
    hue2: '#ffd36e',
    cost: (L) => 6_000 * 1.16 ** (L - 1) * (1 + L / 12),
    production: zeroAtZero((L) => 50 * L ** 1.45),
  },
  {
    kind: 'pump',
    name: 'Tide Pump',
    epithet: 'Draws the sea from nowhere',
    hue: '#3ddc97',
    hue2: '#2f9bff',
    cost: (L) => 3e5 * 1.18 ** (L - 1),
    production: zeroAtZero((L) => 330 * L ** 1.2 * 1.025 ** L),
  },
  {
    kind: 'prism',
    name: 'Prism Loom',
    epithet: 'Weaves light into value',
    hue: '#f5f0ff',
    hue2: '#9d7bff',
    cost: (L) => 9e6 * 1.2 ** (L - 1),
    production: zeroAtZero((L) => 2_400 * L * 3 ** Math.floor(L / 15)),
  },
  {
    kind: 'hourglass',
    name: 'Hourglass Engine',
    epithet: 'Sells borrowed seconds',
    hue: '#ffd98a',
    hue2: '#e0864a',
    cost: (L) => 4e8 * 1.11 ** (L - 1) * L ** 1.6,
    production: zeroAtZero((L) => 1.6e4 * L ** 1.85),
  },
  {
    kind: 'orrery',
    name: 'Grand Orrery',
    epithet: 'Rents out the planets',
    hue: '#8fb8ff',
    hue2: '#ffcf5a',
    cost: (L) => 2e10 * 1.23 ** (L - 1),
    production: zeroAtZero((L) => 1.3e5 * L * 1.07 ** L),
  },
  {
    kind: 'singularity',
    name: 'Singularity Press',
    epithet: 'Compresses nothing into everything',
    hue: '#c77dff',
    hue2: '#ff4d6d',
    cost: (L) => 3e11 * 1.28 ** (L - 1),
    production: zeroAtZero((L) => 1.1e6 * L ** 2.4),
  },
];

export const STARTING_CREDITS = 10;
