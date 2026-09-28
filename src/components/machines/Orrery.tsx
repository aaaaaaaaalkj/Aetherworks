import { type ArtProps, dur, ellipsePath, GlowFilter } from './common';

const CX = 100;
const CY = 74;

const PLANETS = [
  { rx: 30, r: 3.5, color: '#c9d6ff', period: 4, minTier: 0 },
  { rx: 48, r: 5.5, color: '#6fd3ff', period: 7, minTier: 2, moon: true },
  { rx: 66, r: 7, color: '#ffb36b', period: 11, minTier: 3, ring: true },
  { rx: 86, r: 4.5, color: '#ff7aa8', period: 16, minTier: 4 },
];

export function Orrery({ tier, spd, hue, hue2 }: ArtProps) {
  const moving = tier > 0;
  return (
    <svg viewBox="0 0 200 160" className="art-svg">
      <defs>
        <GlowFilter id="orr-glow" blur={3} />
        <radialGradient id="orr-sun">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.45" stopColor={hue2} />
          <stop offset="1" stopColor="#ff7b2e" />
        </radialGradient>
        <linearGradient id="orr-brass" x1="0" x2="1">
          <stop offset="0" stopColor="#5a3a14" />
          <stop offset="0.5" stopColor="#e6b964" />
          <stop offset="1" stopColor="#4a2e0e" />
        </linearGradient>
      </defs>

      {/* Stand */}
      <rect x={97.5} y={96} width={5} height={42} fill="url(#orr-brass)" />
      <path d="M70,150 L130,150 L118,138 L82,138 Z" fill="url(#orr-brass)" stroke="#2a1a06" />

      {/* Orbits */}
      {PLANETS.map((p) => (
        <ellipse
          key={p.rx}
          cx={CX}
          cy={CY}
          rx={p.rx}
          ry={p.rx * 0.36}
          fill="none"
          stroke={tier >= p.minTier ? hue : '#556'}
          strokeOpacity={tier >= p.minTier ? 0.45 : 0.18}
          strokeDasharray={tier >= p.minTier ? undefined : '2 4'}
        />
      ))}

      {/* Sun */}
      <g className="a-spin" style={{ animationDuration: dur(20, spd) }}>
        <circle cx={CX} cy={CY} r={22} fill="none" />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={CX + Math.cos(a) * 14}
              y1={CY + Math.sin(a) * 14}
              x2={CX + Math.cos(a) * (i % 2 ? 19 : 22)}
              y2={CY + Math.sin(a) * (i % 2 ? 19 : 22)}
              stroke={hue2}
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        })}
      </g>
      <circle cx={CX} cy={CY} r={12} fill="url(#orr-sun)" filter="url(#orr-glow)" className="a-pulse" style={{ animationDuration: dur(3, spd) }} />

      {/* Planets */}
      {PLANETS.filter((p) => tier >= p.minTier).map((p) => {
        const path = ellipsePath(CX, CY, p.rx, p.rx * 0.36);
        const d = `${(p.period / spd).toFixed(2)}s`;
        return (
          <g key={p.rx} transform={moving ? undefined : `translate(${CX + p.rx},${CY})`}>
            {moving && <animateMotion dur={d} repeatCount="indefinite" path={path} />}
            {p.ring && <ellipse rx={p.r * 2} ry={p.r * 0.6} fill="none" stroke="#ffe0b0" strokeWidth={1.2} />}
            <circle r={p.r} fill={p.color} />
            <circle r={p.r} fill="url(#orr-sun)" opacity={0.15} />
            {p.moon && tier >= 3 && (
              <g className="a-spin" style={{ animationDuration: dur(1.6, spd) }}>
                <circle r={11} fill="none" />
                <circle cx={11} r={1.6} fill="#eee" />
              </g>
            )}
          </g>
        );
      })}

      {/* Comet */}
      {tier >= 5 && (
        <g>
          <animateMotion dur={`${(9 / spd).toFixed(2)}s`} repeatCount="indefinite" rotate="auto" path="M-20,20 Q100,-10 220,50" />
          <path d="M0,0 L-22,-2 L-22,2 Z" fill={hue} opacity={0.6} />
          <circle r={2.4} fill="#fff" filter="url(#orr-glow)" />
        </g>
      )}
    </svg>
  );
}
