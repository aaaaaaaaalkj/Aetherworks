import { type CSSProperties, memo, useEffect, useRef } from 'react';
import type { MachineDef } from '../game/machines';
import { tierOf } from './machines/common';
import { MACHINE_ART } from './machines';

interface Props {
  def: MachineDef;
  index: number;
  level: number;
  ready: boolean;
  warp: number;
  /** Lite effects: the drawing only animates while hovered. */
  lite: boolean;
  onBuy: (index: number) => boolean;
}

export const MachineCard = memo(function MachineCard({ def, index, level, ready, warp, lite, onBuy }: Props) {
  const Art = MACHINE_ART[def.kind];
  const tier = tierOf(level);
  const spd = (1 + Math.log2(1 + level) * 0.22) * Math.min(3, 1 + Math.log10(warp) * 0.5);
  const hold = useRef<{ timeout?: number; interval?: number }>({});
  const cardRef = useRef<HTMLElement>(null);
  const motion = useRef({ visible: true, hovered: false, lite });
  motion.current.lite = lite;

  // Freeze the drawing when it can't be seen (scrolled away), or in lite mode unless hovered.
  // Done imperatively so hovering never re-renders the SVG.
  const applyMotion = () => {
    const card = cardRef.current;
    if (!card) return;
    const { visible, hovered, lite: isLite } = motion.current;
    const run = visible && (!isLite || hovered);
    card.classList.toggle('frozen', !run);
    const svg = card.querySelector('svg');
    if (run) svg?.unpauseAnimations();
    else svg?.pauseAnimations();
  };

  useEffect(() => {
    const io = new IntersectionObserver(([entry]) => {
      motion.current.visible = entry.isIntersecting;
      applyMotion();
    });
    io.observe(cardRef.current!);
    return () => io.disconnect();
  }, []);

  useEffect(applyMotion, [lite, tier]);

  const stopHold = () => {
    window.clearTimeout(hold.current.timeout);
    window.clearInterval(hold.current.interval);
    hold.current = {};
  };
  useEffect(() => stopHold, []);

  // Press and hold to keep upgrading while the machine stays ready.
  const startHold = () => {
    if (!onBuy(index)) return;
    hold.current.timeout = window.setTimeout(() => {
      hold.current.interval = window.setInterval(() => {
        if (!onBuy(index)) stopHold();
      }, 110);
    }, 380);
  };

  const built = level > 0;
  const style = { '--hue': def.hue, '--hue2': def.hue2 } as CSSProperties;

  return (
    <article
      ref={cardRef}
      className={`card${ready ? ' ready' : ''}${built ? '' : ' blueprint'}`}
      style={style}
      onPointerEnter={() => {
        motion.current.hovered = true;
        applyMotion();
      }}
      onPointerLeave={() => {
        motion.current.hovered = false;
        applyMotion();
      }}
    >
      <div className="card-inner">
        <div className="art" id={`art-${index}`}>
          <Art tier={tier} spd={spd} hue={def.hue} hue2={def.hue2} />
          {!built && <div className="blueprint-grid" />}
        </div>
        <header className="card-head">
          <div>
            <h2>{def.name}</h2>
            <p className="epithet">{def.epithet}</p>
          </div>
          <div className="mark" title="Machine level">
            <span className="mark-label">Mk</span>
            <span className="mark-num" key={level}>
              {built ? level : '—'}
            </span>
          </div>
        </header>
        <div className="tier-pips" aria-label={`Form ${tier} of 5`}>
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className={i < tier ? 'on' : ''} />
          ))}
        </div>
        <button
          className="buy"
          disabled={!ready}
          onPointerDown={(e) => {
            if (e.button === 0) startHold();
          }}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onBuy(index);
            }
          }}
        >
          <span className="buy-light" />
          <span className="buy-text">
            {built ? (ready ? 'Upgrade ready' : 'Upgrade') : ready ? 'Assemble' : 'Blueprint'}
          </span>
          <kbd>{index + 1}</kbd>
        </button>
      </div>
    </article>
  );
});

export function LockedCard() {
  return (
    <article className="card locked">
      <div className="card-inner">
        <div className="art locked-art">
          <span>?</span>
        </div>
        <header className="card-head">
          <div>
            <h2>Undiscovered</h2>
            <p className="epithet">Assemble the previous machine to reveal it</p>
          </div>
        </header>
      </div>
    </article>
  );
}
