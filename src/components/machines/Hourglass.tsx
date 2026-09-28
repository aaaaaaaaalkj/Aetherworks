import { type ArtProps, dur } from './common';

const CX = 100;
const CY = 80;

export function Hourglass({ tier, spd, hue, hue2 }: ArtProps) {
  const cycle = dur(6, spd);
  const frame = tier >= 5 ? '#ffe39a' : '#8a5a34';
  return (
    <svg viewBox="0 0 200 160" className="art-svg">
      <defs>
        <linearGradient id="hg-sand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={hue} />
          <stop offset="1" stopColor={hue2} />
        </linearGradient>
        <clipPath id="hg-top">
          <path d="M72,30 L128,30 C128,56 106,68 102,78 L98,78 C94,68 72,56 72,30 Z" />
        </clipPath>
        <clipPath id="hg-bottom">
          <path d="M98,82 L102,82 C106,92 128,104 128,130 L72,130 C72,104 94,92 98,82 Z" />
        </clipPath>
      </defs>

      {/* Clock face behind the glass */}
      {tier >= 2 && (
        <g opacity={0.8}>
          <circle cx={CX} cy={CY} r={66} fill="none" stroke={hue} strokeOpacity={0.3} strokeWidth={1} />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return (
              <line
                key={i}
                x1={CX + Math.cos(a) * 60}
                y1={CY + Math.sin(a) * 60}
                x2={CX + Math.cos(a) * 66}
                y2={CY + Math.sin(a) * 66}
                stroke={hue}
                strokeOpacity={0.6}
                strokeWidth={i % 3 === 0 ? 2.5 : 1}
              />
            );
          })}
        </g>
      )}
      {tier >= 3 && (
        <>
          <g className="a-spin" style={{ animationDuration: dur(8, spd) }}>
            <circle cx={CX} cy={CY} r={58} fill="none" />
            <line x1={CX} y1={CY} x2={CX} y2={CY - 56} stroke={hue2} strokeWidth={1.5} strokeOpacity={0.7} />
          </g>
          <g className="a-spin" style={{ animationDuration: dur(96, spd) }}>
            <circle cx={CX} cy={CY} r={58} fill="none" />
            <line x1={CX} y1={CY} x2={CX + 38} y2={CY} stroke={hue2} strokeWidth={3} strokeOpacity={0.6} />
          </g>
        </>
      )}

      {/* The flipping hourglass */}
      <g className="a-hg-flip" style={{ animationDuration: cycle }}>
        <circle cx={CX} cy={CY} r={62} fill="none" />
        {/* Sand, top bulb draining */}
        <g clipPath="url(#hg-top)">
          <g className="a-hg-drain" style={{ animationDuration: cycle }}>
            <path d="M60,80 L140,80 L140,48 Q100,68 60,48 Z" fill="url(#hg-sand)" />
          </g>
        </g>
        {/* Sand, bottom bulb filling */}
        <g clipPath="url(#hg-bottom)">
          <g className="a-hg-fill" style={{ animationDuration: cycle }}>
            <path d="M60,130 L140,130 L140,112 Q100,92 60,112 Z" fill="url(#hg-sand)" />
          </g>
        </g>
        {/* Falling stream */}
        <line
          x1={CX}
          y1={78}
          x2={CX}
          y2={128}
          stroke={hue}
          strokeWidth={1.6}
          strokeDasharray="2 3"
          className="a-hg-stream"
          style={{ animationDuration: cycle }}
        />
        {/* Glass */}
        <path
          d="M72,30 L128,30 C128,56 106,68 102,80 C106,92 128,104 128,130 L72,130 C72,104 94,92 98,80 C94,68 72,56 72,30 Z"
          fill="#fff"
          fillOpacity={0.06}
          stroke="#fff"
          strokeOpacity={0.55}
          strokeWidth={1.4}
        />
        <path d="M78,36 C78,52 90,62 96,72" stroke="#fff" strokeOpacity={0.35} strokeWidth={2} fill="none" />
        {/* Frame */}
        <rect x={62} y={22} width={76} height={9} rx={3} fill={frame} stroke="#2a1608" />
        <rect x={62} y={129} width={76} height={9} rx={3} fill={frame} stroke="#2a1608" />
        {[66, 134].map((x) => (
          <rect key={x} x={x - 2.5} y={31} width={5} height={98} rx={2} fill={frame} stroke="#2a1608" />
        ))}
        {tier >= 4 &&
          [26, 134].map((y) => <circle key={y} cx={CX} cy={y} r={3} fill={hue} />)}
      </g>

      {/* Drifting time motes */}
      {tier >= 4 &&
        Array.from({ length: tier === 5 ? 6 : 3 }, (_, i) => (
          <circle
            key={i}
            cx={40 + i * 24}
            cy={148}
            r={1.6}
            fill={hue}
            className="a-bubble"
            style={{ animationDuration: dur(3.5 + (i % 3) * 0.7, spd), animationDelay: `${i * 0.6}s` }}
          />
        ))}
    </svg>
  );
}
