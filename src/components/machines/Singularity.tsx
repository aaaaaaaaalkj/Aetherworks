import { type ArtProps, dur, GlowFilter } from './common';

const CX = 100;
const CY = 80;

function spiralPath(startAngle: number, turns: number, r0: number): string {
  const steps = 48;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = startAngle + t * turns * Math.PI * 2;
    const r = r0 * (1 - t) ** 1.3 + 16 * t;
    const x = CX + Math.cos(a) * r;
    const y = CY + Math.sin(a) * r * 0.36;
    d += `${i ? ' L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return d;
}

function Disk({ spd, hue, hue2, tier }: { spd: number; hue: string; hue2: string; tier: number }) {
  const rings = [
    { r: 30, w: 5, color: '#fff', period: 3, dash: '10 6' },
    { r: 42, w: 6, color: hue2, period: 5, dash: '16 10' },
    { r: 56, w: 5, color: hue, period: 8, dash: '22 14' },
    { r: 70, w: 3, color: hue, period: 13, dash: '6 18' },
  ].slice(0, 2 + Math.min(2, Math.ceil(tier / 2)));
  return (
    <g transform={`translate(${CX},${CY}) scale(1,0.36)`}>
      {rings.map((ring) => (
        <g key={ring.r} className="a-spin" style={{ animationDuration: dur(ring.period, spd) }}>
          <circle r={ring.r} fill="none" stroke={ring.color} strokeWidth={ring.w} strokeDasharray={ring.dash} opacity={0.85} />
        </g>
      ))}
    </g>
  );
}

export function Singularity({ tier, spd, hue, hue2 }: ArtProps) {
  return (
    <svg viewBox="0 0 200 160" className="art-svg">
      <defs>
        <GlowFilter id="sing-glow" blur={3} />
        <clipPath id="sing-front">
          <rect x={0} y={CY} width={200} height={80} />
        </clipPath>
        <radialGradient id="sing-halo">
          <stop offset="0.35" stopColor={hue} stopOpacity="0" />
          <stop offset="0.5" stopColor={hue} stopOpacity="0.6" />
          <stop offset="0.62" stopColor={hue2} stopOpacity="0.25" />
          <stop offset="1" stopColor={hue2} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sing-jet" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={hue} stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="sing-jet-down" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={hue} stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.9" />
        </linearGradient>
      </defs>

      {/* Relativistic jets */}
      {tier >= 3 && (
        <g className="a-jet" style={{ animationDuration: dur(1.4, spd) }}>
          <polygon points={`${CX - 4},${CY - 20} ${CX + 4},${CY - 20} ${CX + 1},0 ${CX - 1},0`} fill="url(#sing-jet)" filter="url(#sing-glow)" />
          <polygon
            points={`${CX - 4},${CY + 20} ${CX + 4},${CY + 20} ${CX + 1},160 ${CX - 1},160`}
            fill="url(#sing-jet-down)"
            filter="url(#sing-glow)"
          />
        </g>
      )}

      {/* Lensing halo */}
      <circle cx={CX} cy={CY} r={48} fill="url(#sing-halo)" className="a-pulse" style={{ animationDuration: dur(2.8, spd) }} />

      {/* Back of accretion disk */}
      <Disk spd={spd} hue={hue} hue2={hue2} tier={tier} />

      {/* Event horizon */}
      <circle cx={CX} cy={CY} r={22} fill="#000" />
      <circle cx={CX} cy={CY} r={23} fill="none" stroke="#fff" strokeOpacity={0.9} strokeWidth={1.2} filter="url(#sing-glow)" />

      {/* Front of accretion disk, drawn over the horizon */}
      <g clipPath="url(#sing-front)">
        <Disk spd={spd} hue={hue} hue2={hue2} tier={tier} />
      </g>

      {/* Infalling matter */}
      {tier >= 1 &&
        Array.from({ length: Math.min(6, tier + 1) }, (_, i) => (
          <circle key={i} r={1.8} fill="#fff" filter="url(#sing-glow)">
            <animateMotion
              dur={`${(3 / spd).toFixed(2)}s`}
              begin={`${(i * 0.5).toFixed(1)}s`}
              repeatCount="indefinite"
              path={spiralPath(i * 1.1, 1.6, 90)}
            />
            <animate attributeName="r" values="2.4;1.6;0.2" dur={`${(3 / spd).toFixed(2)}s`} begin={`${(i * 0.5).toFixed(1)}s`} repeatCount="indefinite" />
          </circle>
        ))}

      {/* Distorted background stars */}
      {tier >= 5 &&
        [
          [20, 20],
          [180, 30],
          [30, 140],
          [175, 135],
          [150, 12],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={1.4} fill="#fff" className="a-twinkle" style={{ animationDuration: dur(2, spd), animationDelay: `${i * 0.4}s` }} />
        ))}
    </svg>
  );
}
