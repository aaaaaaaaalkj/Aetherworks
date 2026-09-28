import { useMemo } from 'react';
import { type ArtProps, boltPath, dur } from './common';

export function Coil({ tier, spd, hue, hue2 }: ArtProps) {
  const bolts = useMemo(() => {
    const targets: [number, number][] = [
      [38, 30], [162, 26], [22, 70], [178, 66], [60, 12], [140, 10], [100, 4], [30, 44], [170, 44],
    ];
    const n = Math.min(targets.length, 2 + tier * 2);
    return targets.slice(0, n).map(([x, y], i) => ({ d: boltPath(100, 48, x, y, 17 + i * 31, 8), delay: (i * 0.37) % 1.4 }));
  }, [tier]);

  const windings = Array.from({ length: 13 }, (_, k) => 130 - k * 5.8);

  return (
    <svg viewBox="0 0 200 160" className="art-svg">
      <defs>
        <linearGradient id="coil-metal" x1="0" x2="1">
          <stop offset="0" stopColor="#2a3446" />
          <stop offset="0.45" stopColor="#8a97b3" />
          <stop offset="1" stopColor="#1c2332" />
        </linearGradient>
        <linearGradient id="coil-copper" x1="0" x2="1">
          <stop offset="0" stopColor="#6b3514" />
          <stop offset="0.5" stopColor="#f0a45c" />
          <stop offset="1" stopColor="#5a2a0e" />
        </linearGradient>
        <radialGradient id="coil-core">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.35" stopColor={hue} />
          <stop offset="1" stopColor={hue} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Side electrodes appear at higher tiers */}
      {tier >= 2 && (
        <g>
          {[30, 170].map((x) => (
            <g key={x}>
              <rect x={x - 2} y={80} width={4} height={58} fill="url(#coil-metal)" />
              <circle cx={x} cy={76} r={7} fill="url(#coil-metal)" stroke={hue} strokeOpacity={0.4} />
            </g>
          ))}
          {[30, 170].map((x, i) => (
            <path
              key={`arc${x}`}
              d={boltPath(100, 52, x, 76, 900 + i * 7, 6)}
              className="a-flicker"
              style={{ animationDuration: dur(1.1, spd), animationDelay: `${i * 0.5}s` }}
              stroke={hue2}
              strokeWidth={1.6}
              fill="none"
            />
          ))}
        </g>
      )}

      {/* Base */}
      <ellipse cx={100} cy={146} rx={58} ry={7} fill="#000" opacity={0.45} />
      <path d="M52,140 L148,140 L140,128 L60,128 Z" fill="url(#coil-metal)" stroke="#0b0f18" />
      <rect x={84} y={60} width={32} height={70} rx={4} fill="#11151f" />

      {/* Copper windings */}
      {windings.map((y, k) => (
        <ellipse key={k} cx={100} cy={y} rx={17} ry={3.2} fill="none" stroke="url(#coil-copper)" strokeWidth={2.6} />
      ))}

      {/* Toroid top load */}
      <ellipse cx={100} cy={52} rx={36} ry={11} fill="url(#coil-metal)" stroke="#0b0f18" />
      <ellipse cx={100} cy={49} rx={24} ry={5} fill="#0b0f18" opacity={0.6} />
      <circle cx={100} cy={46} r={18} fill="url(#coil-core)" className="a-pulse" style={{ animationDuration: dur(1.6, spd) }} />

      {/* Lightning: a wide faint stroke under a thin bright one fakes a glow cheaply */}
      {bolts.map((b, i) => (
        <g
          key={i}
          className="a-flicker"
          style={{ animationDuration: dur(1.4, spd), animationDelay: `${b.delay}s` }}
          stroke={i % 3 === 2 ? hue2 : hue}
          fill="none"
        >
          <path d={b.d} strokeWidth={5} strokeOpacity={0.25} />
          <path d={b.d} strokeWidth={1.4} />
          <path d={b.d} strokeWidth={0.5} stroke="#fff" />
        </g>
      ))}

      {/* Orbiting motes at high tiers */}
      {tier >= 4 && (
        <g className="a-spin" style={{ animationDuration: dur(4, spd) }}>
          <circle cx={100} cy={46} r={46} fill="none" />
          {Array.from({ length: tier === 5 ? 6 : 3 }, (_, i) => {
            const a = (i / (tier === 5 ? 6 : 3)) * Math.PI * 2;
            return <circle key={i} cx={100 + Math.cos(a) * 46} cy={46 + Math.sin(a) * 46} r={2.4} fill="#fff" />;
          })}
        </g>
      )}
      {tier >= 3 && (
        <ellipse cx={100} cy={52} rx={44} ry={14} fill="none" stroke={hue} strokeOpacity={0.35} strokeDasharray="3 6"
          className="a-dash" style={{ animationDuration: dur(2, spd) }} />
      )}
    </svg>
  );
}
