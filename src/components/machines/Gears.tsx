import { type ArtProps, dur, gearPath } from './common';

interface GearSpec {
  cx: number;
  cy: number;
  r: number;
  teeth: number;
  dir: 1 | -1;
  minTier: number;
  phase: number;
}

// Positioned so neighbouring gears mesh; speed is inversely proportional to tooth count.
const GEARS: GearSpec[] = [
  { cx: 82, cy: 90, r: 38, teeth: 16, dir: 1, minTier: 0, phase: 0 },
  { cx: 133, cy: 70, r: 22, teeth: 9, dir: -1, minTier: 0, phase: 20 },
  { cx: 147, cy: 99, r: 15, teeth: 7, dir: 1, minTier: 2, phase: 10 },
  { cx: 35, cy: 56, r: 25, teeth: 11, dir: -1, minTier: 3, phase: 16 },
  { cx: 44, cy: 121, r: 16, teeth: 7, dir: -1, minTier: 4, phase: 5 },
];

function Gear({ g, spd, fill, accent, gold }: { g: GearSpec; spd: number; fill: string; accent: string; gold: boolean }) {
  const period = (g.teeth / 16) * 7;
  return (
    <g transform={`translate(${g.cx},${g.cy}) rotate(${g.phase})`}>
      <g
        className="a-spin"
        style={{ animationDuration: dur(period, spd), animationDirection: g.dir === 1 ? 'normal' : 'reverse' }}
      >
        <circle r={g.r} fill="none" />
        <path d={gearPath(g.r, g.teeth, g.r > 20 ? 6 : 4.5)} fill={fill} stroke="#1a0e04" strokeWidth={1.2} />
        <circle r={g.r * 0.72} fill="none" stroke={accent} strokeOpacity={0.5} strokeWidth={1} />
        {Array.from({ length: g.r > 20 ? 5 : 3 }, (_, i) => {
          const n = g.r > 20 ? 5 : 3;
          const a = (i / n) * Math.PI * 2;
          return (
            <circle key={i} cx={Math.cos(a) * g.r * 0.45} cy={Math.sin(a) * g.r * 0.45} r={g.r * 0.16} fill="#120a05" />
          );
        })}
        <circle r={g.r * 0.2} fill={gold ? '#ffe7a3' : accent} stroke="#1a0e04" />
        <circle r={g.r * 0.07} fill="#120a05" />
      </g>
    </g>
  );
}

export function Gears({ tier, spd, hue, hue2 }: ArtProps) {
  const gold = tier >= 5;
  return (
    <svg viewBox="0 0 200 160" className="art-svg">
      <defs>
        <linearGradient id="gear-brass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={gold ? '#fff0b8' : '#ffd08a'} />
          <stop offset="0.5" stopColor={hue} />
          <stop offset="1" stopColor="#7a3b10" />
        </linearGradient>
        <radialGradient id="gear-steam">
          <stop offset="0" stopColor="#fff" stopOpacity="0.7" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Back plate with rivets */}
      <rect x={14} y={30} width={172} height={116} rx={10} fill="#1b1410" stroke="#3a2a1c" />
      {[22, 178].flatMap((x) => [38, 138].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r={2.2} fill="#5a4330" />))}

      {/* Chimney + steam */}
      {tier >= 2 && (
        <g>
          <rect x={160} y={6} width={14} height={34} fill="#2b1f16" stroke="#4a3526" />
          <rect x={157} y={4} width={20} height={5} fill="#3a2a1c" />
          {Array.from({ length: tier >= 4 ? 4 : 2 }, (_, i) => (
            <circle
              key={i}
              cx={167}
              cy={2}
              r={7}
              fill="url(#gear-steam)"
              className="a-steam"
              style={{ animationDuration: dur(2.4, spd), animationDelay: `${i * 0.6}s` }}
            />
          ))}
        </g>
      )}

      {GEARS.filter((g) => tier >= g.minTier).map((g, i) => (
        <Gear key={i} g={g} spd={spd} fill="url(#gear-brass)" accent={hue2} gold={gold} />
      ))}

    </svg>
  );
}
