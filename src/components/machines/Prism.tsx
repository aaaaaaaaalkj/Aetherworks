import { type ArtProps, dur } from './common';

const SPECTRUM = ['#ff4d4d', '#ff9f43', '#ffe14d', '#4dff88', '#4dc3ff', '#6b6bff', '#c74dff'];

export function Prism({ tier, spd, hue, hue2 }: ArtProps) {
  const bands = Math.min(7, 3 + tier);
  const colors = Array.from({ length: bands }, (_, i) => SPECTRUM[Math.round((i * 6) / (bands - 1))]);
  const exitX = 116;
  const exitY = 82;
  const spread = 44;
  return (
    <svg viewBox="0 0 200 160" className="art-svg">
      <defs>
        <linearGradient id="prism-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="0.5" stopColor={hue2} stopOpacity="0.18" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.35" />
        </linearGradient>
      </defs>

      {/* Loom frame */}
      <rect x={160} y={30} width={32} height={108} fill="none" stroke="#4a3f66" strokeWidth={3} />
      {Array.from({ length: 7 }, (_, i) => (
        <line key={i} x1={164 + i * 4} x2={164 + i * 4} y1={32} y2={136} stroke="#8a7fb0" strokeOpacity={0.45} strokeWidth={0.8} />
      ))}
      {/* Woven cloth grows with tier */}
      {colors.map((c, i) =>
        i < tier + 1 ? (
          <rect key={c} x={162} y={136 - (i + 1) * 12} width={28} height={10} fill={c} opacity={0.55} rx={1} />
        ) : null,
      )}
      {/* Shuttle */}
      <g className="a-shuttle" style={{ animationDuration: dur(1.6, spd) }}>
        <rect x={158} y={60} width={36} height={4} rx={2} fill={hue2} />
      </g>

      {/* Incoming beam */}
      <line x1={0} y1={104} x2={86} y2={80} stroke="#fff" strokeWidth={9} opacity={0.12} />
      <line x1={0} y1={104} x2={86} y2={80} stroke="#fff" strokeWidth={3} opacity={0.9} />
      <line x1={0} y1={104} x2={86} y2={80} stroke={hue} strokeWidth={1.2} strokeDasharray="6 12" className="a-dash" style={{ animationDuration: dur(0.5, spd) }} />

      {/* Spectrum fan */}
      {colors.map((c, i) => {
        const y0 = 34 + (i * (2 * spread + 8)) / bands;
        const y1 = y0 + (2 * spread) / bands;
        return (
          <polygon
            key={c}
            points={`${exitX},${exitY - 2 + i * 0.6} ${exitX},${exitY + i * 0.6} 160,${y1} 160,${y0}`}
            fill={c}
            className="a-shimmer"
            style={{ animationDuration: dur(1.8, spd), animationDelay: `${(i * 0.23).toFixed(2)}s` }}
          />
        );
      })}

      {/* Prism */}
      {tier >= 3 && (
        <g className="a-spin" style={{ animationDuration: dur(12, spd) }}>
          <circle cx={100} cy={82} r={48} fill="none" stroke={hue2} strokeOpacity={0.35} strokeDasharray="1 7" strokeWidth={2} />
        </g>
      )}
      <polygon points="100,34 64,116 136,116" fill="url(#prism-glass)" stroke="#fff" strokeOpacity={0.8} strokeWidth={1.5} />
      <polygon points="100,34 88,116 64,116" fill="#fff" opacity={0.08} />
      <circle cx={100} cy={82} r={6} fill="#fff" className="a-pulse" style={{ animationDuration: dur(2, spd) }} />

      {/* Stand */}
      <path d="M60,116 L140,116 L132,128 L68,128 Z" fill="#2a2440" stroke="#4a3f66" />
      <rect x={94} y={128} width={12} height={16} fill="#2a2440" />
      <rect x={72} y={144} width={56} height={6} rx={2} fill="#3a3258" />

      {/* Sparkles at the top tiers */}
      {tier >= 4 &&
        [
          [40, 40],
          [70, 20],
          [130, 22],
          [30, 130],
          [145, 140],
        ].map(([x, y], i) => (
          <path
            key={i}
            d={`M${x},${y - 5} L${x + 1.2},${y - 1.2} L${x + 5},${y} L${x + 1.2},${y + 1.2} L${x},${y + 5} L${x - 1.2},${y + 1.2} L${x - 5},${y} L${x - 1.2},${y - 1.2} Z`}
            fill="#fff"
            className="a-twinkle"
            style={{ animationDuration: dur(2.2, spd), animationDelay: `${i * 0.45}s` }}
          />
        ))}
    </svg>
  );
}
