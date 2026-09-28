import { type ArtProps, dur } from './common';

const CX = 100;
const CY = 78;

function PetalRing({ n, len, width, dist, fill, opacity }: { n: number; len: number; width: number; dist: number; fill: string; opacity: number }) {
  return (
    <>
      <circle cx={CX} cy={CY} r={dist + len} fill="none" />
      {Array.from({ length: n }, (_, i) => (
        <ellipse
          key={i}
          cx={CX}
          cy={CY - dist - len / 2}
          rx={width}
          ry={len / 2}
          fill={fill}
          opacity={opacity}
          transform={`rotate(${(i * 360) / n} ${CX} ${CY})`}
        />
      ))}
    </>
  );
}

export function Bloom({ tier, spd, hue, hue2 }: ArtProps) {
  return (
    <svg viewBox="0 0 200 160" className="art-svg">
      <defs>
        <radialGradient id="bloom-core">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.4" stopColor={hue2} />
          <stop offset="1" stopColor={hue} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bloom-petal" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={hue2} />
          <stop offset="1" stopColor={hue} />
        </linearGradient>
        <linearGradient id="bloom-petal2" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={hue} stopOpacity="0.9" />
          <stop offset="1" stopColor="#6a1b9a" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      {/* Containment pedestal */}
      <path d="M66,150 L134,150 L122,132 L78,132 Z" fill="#1d1422" stroke="#3b2645" />
      <rect x={96} y={112} width={8} height={22} fill="#2e1f37" />

      {/* Containment ring */}
      <circle cx={CX} cy={CY} r={56} fill="none" stroke={hue} strokeOpacity={0.25} strokeWidth={1} />
      <g className="a-spin" style={{ animationDuration: dur(14, spd) }}>
        <circle cx={CX} cy={CY} r={56} fill="none" stroke={hue} strokeOpacity={0.7} strokeWidth={2} strokeDasharray="2 12" />
      </g>

      {/* Petal layers — more layers open as the reactor grows */}
      {tier >= 3 && (
        <g className="a-spin" style={{ animationDuration: dur(40, spd), animationDirection: 'reverse' }}>
          <PetalRing n={16} len={24} width={3.5} dist={26} fill={hue2} opacity={0.35} />
        </g>
      )}
      {tier >= 2 && (
        <g className="a-spin" style={{ animationDuration: dur(26, spd) }}>
          <PetalRing n={8} len={34} width={9} dist={8} fill="url(#bloom-petal2)" opacity={0.75} />
        </g>
      )}
      <g className="a-breathe" style={{ animationDuration: dur(3.2, spd) }}>
        <g className="a-spin" style={{ animationDuration: dur(18, spd), animationDirection: 'reverse' }}>
          <PetalRing n={6} len={30} width={9} dist={4} fill="url(#bloom-petal)" opacity={0.95} />
        </g>
      </g>

      {/* Core */}
      <circle cx={CX} cy={CY} r={20} fill="url(#bloom-core)" className="a-pulse" style={{ animationDuration: dur(1.6, spd) }} />
      <circle cx={CX} cy={CY} r={5} fill="#fff" />

      {/* Orbiting sparks */}
      {tier >= 1 && (
        <g className="a-spin" style={{ animationDuration: dur(5, spd) }}>
          <circle cx={CX} cy={CY} r={48} fill="none" />
          {Array.from({ length: Math.min(8, tier * 2) }, (_, i) => {
            const a = (i / Math.min(8, tier * 2)) * Math.PI * 2;
            return <circle key={i} cx={CX + Math.cos(a) * 48} cy={CY + Math.sin(a) * 48} r={2} fill="#fff" />;
          })}
        </g>
      )}

      {/* Field arcs */}
      {tier >= 4 &&
        [0, 1].map((i) => (
          <ellipse
            key={i}
            cx={CX}
            cy={CY}
            rx={70}
            ry={20}
            fill="none"
            stroke={i ? hue2 : hue}
            strokeWidth={1.2}
            strokeDasharray="30 200"
            className="a-dash-long"
            style={{ animationDuration: dur(2.6, spd), animationDelay: `${i * 1.3}s` }}
            transform={`rotate(${i ? 30 : -30} ${CX} ${CY})`}
          />
        ))}
    </svg>
  );
}
