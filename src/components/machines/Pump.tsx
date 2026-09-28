import { type ArtProps, dur } from './common';

function wavePath(top: number, amp: number, wavelength: number): string {
  let d = `M-200,${top}`;
  for (let x = -200; x < 400; x += wavelength) {
    d += ` q${wavelength / 4},${-amp} ${wavelength / 2},0 t${wavelength / 2},0`;
  }
  return `${d} L400,200 L-200,200 Z`;
}

const BUBBLES = [
  { x: 58, r: 2.2, d: 2.6, delay: 0 },
  { x: 82, r: 1.6, d: 3.1, delay: 0.9 },
  { x: 104, r: 2.6, d: 2.2, delay: 1.7 },
  { x: 70, r: 1.4, d: 2.8, delay: 1.2 },
  { x: 116, r: 1.8, d: 3.4, delay: 0.4 },
  { x: 94, r: 1.2, d: 2.4, delay: 2.1 },
];

export function Pump({ tier, spd, hue, hue2 }: ArtProps) {
  const level = 128 - Math.min(5, tier) * 13; // tank fills up with tiers
  return (
    <svg viewBox="0 0 200 160" className="art-svg">
      <defs>
        <clipPath id="pump-tank">
          <rect x={42} y={34} width={90} height={106} rx={14} />
        </clipPath>
        <linearGradient id="pump-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={hue} stopOpacity="0.95" />
          <stop offset="1" stopColor={hue2} stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="pump-glass" x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.18" />
          <stop offset="0.2" stopColor="#fff" stopOpacity="0.02" />
          <stop offset="0.8" stopColor="#fff" stopOpacity="0.02" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id="pump-steel" x1="0" x2="1">
          <stop offset="0" stopColor="#1d2b2a" />
          <stop offset="0.5" stopColor="#7fa3a0" />
          <stop offset="1" stopColor="#152120" />
        </linearGradient>
      </defs>

      {/* Piston housing */}
      <rect x={150} y={48} width={30} height={92} rx={4} fill="url(#pump-steel)" stroke="#0a1413" />
      <g className="a-piston" style={{ animationDuration: dur(1.3, spd) }}>
        <rect x={160} y={14} width={10} height={50} fill="#9fbab8" stroke="#0a1413" />
        <rect x={152} y={60} width={26} height={10} rx={2} fill="#c8dedc" stroke="#0a1413" />
      </g>
      {/* Pipe into tank */}
      <rect x={132} y={117} width={20} height={10} fill="#4f6f6c" stroke="#0a1413" />
      <path d="M150,122 L134,122" stroke={hue} strokeWidth={3} strokeDasharray="3 6" className="a-dash-rev" style={{ animationDuration: dur(0.6, spd) }} />

      {/* Tank */}
      <g clipPath="url(#pump-tank)">
        <rect x={42} y={34} width={90} height={106} fill="#061413" />
        {tier >= 3 && (
          <g className="a-wave" style={{ animationDuration: dur(3.4, spd), animationDirection: 'reverse' }}>
            <path d={wavePath(level - 4, 5, 40)} fill={hue2} opacity={0.45} />
          </g>
        )}
        <g className="a-wave" style={{ animationDuration: dur(2.2, spd) }}>
          <path d={wavePath(level, 4, 40)} fill="url(#pump-water)" />
        </g>
        {BUBBLES.slice(0, 2 + tier).map((b, i) => (
          <circle
            key={i}
            cx={b.x}
            cy={138}
            r={b.r}
            fill="none"
            stroke="#fff"
            strokeOpacity={0.7}
            className="a-bubble"
            style={{ animationDuration: dur(b.d, spd), animationDelay: `${b.delay}s` }}
          />
        ))}
      </g>
      <rect x={42} y={34} width={90} height={106} rx={14} fill="url(#pump-glass)" stroke="#bfe" strokeOpacity={0.35} strokeWidth={1.5} />
      <rect x={38} y={28} width={98} height={10} rx={3} fill="url(#pump-steel)" />
      <rect x={38} y={138} width={98} height={10} rx={3} fill="url(#pump-steel)" />
      {[52, 66, 80].map((y) => (
        <line key={y} x1={124} x2={132} y1={y} y2={y} stroke="#bfe" strokeOpacity={0.4} />
      ))}

      {/* Pressure gauge */}
      {tier >= 4 && (
        <g transform="translate(22,60)">
          <circle r={14} fill="#0b1716" stroke="url(#pump-steel)" strokeWidth={3} />
          <path d="M-9,5 A10,10 0 1,1 9,5" fill="none" stroke={hue} strokeOpacity={0.5} strokeWidth={1.5} />
          <g className="a-needle" style={{ animationDuration: dur(1.3, spd) }}>
            <circle r={11} fill="none" />
            <line x1={0} y1={0} x2={0} y2={-10} stroke="#ff6b6b" strokeWidth={1.6} />
          </g>
          <circle r={2} fill="#ddd" />
          <path d="M14,0 L20,0 L20,62 L38,62" stroke="url(#pump-steel)" strokeWidth={4} fill="none" />
        </g>
      )}

      {/* Fountain */}
      {tier >= 5 &&
        [0, 1, 2].map((i) => (
          <circle
            key={i}
            cx={87}
            cy={26}
            r={2.5}
            fill={hue}
            className="a-fountain"
            style={{ animationDuration: dur(1.2, spd), animationDelay: `${i * 0.4}s`, ['--fx' as string]: `${(i - 1) * 16}px` }}
          />
        ))}
    </svg>
  );
}
