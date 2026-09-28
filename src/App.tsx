import { useCallback, useEffect, useRef, useState } from 'react';
import { FlowCanvas, type FlowSource, burst } from './components/FlowCanvas';
import { LockedCard, MachineCard } from './components/MachineCard';
import { TimeWarp } from './components/TimeWarp';
import { Vault } from './components/Vault';
import { buy, canBuy, clearSave, freshState, isUnlocked, loadGame, saveGame, totalRate } from './game/engine';
import { formatDuration } from './game/format';
import { MACHINES } from './game/machines';

const RENDER_INTERVAL_MS = 100;
const SAVE_INTERVAL_MS = 5000;
const LITE_KEY = 'aetherworks.lite';

function initialLite(): boolean {
  try {
    const stored = localStorage.getItem(LITE_KEY);
    if (stored !== null) return stored === '1';
  } catch {
    // storage blocked
  }
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export default function App() {
  const [boot] = useState(loadGame);
  const game = useRef(boot.state);
  const rate = useRef(totalRate(boot.state.levels));
  const speedRef = useRef(1);
  const [speed, setSpeedState] = useState(1);
  const [warpOpen, setWarpOpen] = useState(false);
  const [lite, setLiteState] = useState(initialLite);
  const liteRef = useRef(lite);
  const setLite = (v: boolean) => {
    liteRef.current = v;
    setLiteState(v);
    try {
      localStorage.setItem(LITE_KEY, v ? '1' : '0');
    } catch {
      // storage blocked
    }
  };
  const [away, setAway] = useState(boot.awayMs > 60_000 ? boot.awayMs : 0);
  const [, setFrame] = useState(0);
  const rerender = useCallback(() => setFrame((f) => f + 1), []);

  const setSpeed = (s: number) => {
    speedRef.current = s;
    setSpeedState(s);
  };

  // Main loop: credits accrue continuously, scaled by the time-warp factor.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastRender = 0;
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      game.current.credits += rate.current * dt * speedRef.current;
      if (now - lastRender > RENDER_INTERVAL_MS) {
        lastRender = now;
        rerender();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [rerender]);

  // Persistence.
  useEffect(() => {
    const save = () => saveGame(game.current);
    const id = window.setInterval(save, SAVE_INTERVAL_MS);
    const onHide = () => document.visibilityState === 'hidden' && save();
    window.addEventListener('beforeunload', save);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('beforeunload', save);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);

  const purchase = useCallback(
    (i: number) => {
      if (!buy(game.current, i)) return false;
      rate.current = totalRate(game.current.levels);
      burst(i);
      rerender();
      return true;
    },
    [rerender],
  );

  const skip = (seconds: number) => {
    game.current.credits += rate.current * seconds;
    rerender();
  };

  const reset = () => {
    clearSave();
    game.current = freshState();
    rate.current = 0;
    setSpeed(1);
    rerender();
  };

  // Keyboard: 1–8 upgrade machines, W toggles the time warp panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= MACHINES.length) purchase(n - 1);
      else if (e.key === 'w' || e.key === 'W') setWarpOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [purchase]);

  useEffect(() => {
    if (!away) return;
    const id = window.setTimeout(() => setAway(0), 7000);
    return () => window.clearTimeout(id);
  }, [away]);

  const state = game.current;
  const ready = MACHINES.map((_, i) => canBuy(state, i));
  const readyCount = ready.filter(Boolean).length;

  useEffect(() => {
    document.title = readyCount ? `(${readyCount}) Aetherworks` : 'Aetherworks';
  }, [readyCount]);

  const firstLocked = MACHINES.findIndex((_, i) => !isUnlocked(state.levels, i));
  const visible = firstLocked === -1 ? MACHINES.length : firstLocked;

  const sources = (): FlowSource[] =>
    MACHINES.map((m, i) => {
      const p = m.production(game.current.levels[i]);
      const r = p > 0 ? Math.min(7, 0.6 + Math.log10(1 + p) * 0.5) * Math.min(2, 1 + Math.log10(speedRef.current) * 0.25) * (liteRef.current ? 0.3 : 1) : 0;
      return { rate: r, hue: m.hue, hue2: m.hue2 };
    });

  return (
    <div className={`app${speed > 1 ? ' warping' : ''}${lite ? ' lite' : ''}`}>
      <div className="backdrop" aria-hidden="true">
        <div className="stars" />
        <div className="grid-floor" />
      </div>

      <header className="topbar">
        <div className="brand">
          <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true" className="brand-mark">
            <circle cx="16" cy="16" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
            {Array.from({ length: 8 }, (_, i) => (
              <rect key={i} x="14.5" y="3" width="3" height="5" rx="1" fill="currentColor" transform={`rotate(${i * 45} 16 16)`} />
            ))}
            <circle cx="16" cy="16" r="2" fill="currentColor" />
          </svg>
          <div>
            <div className="brand-name">Aetherworks</div>
            <div className="brand-sub">a foundry of impossible machines</div>
          </div>
        </div>
        <Vault credits={state.credits} />
        <div className="ready-meter" aria-live="polite">
          {MACHINES.slice(0, visible).map((m, i) => (
            <span key={m.kind} className={ready[i] ? 'on' : ''} style={{ ['--hue' as string]: m.hue }} title={m.name} />
          ))}
        </div>
      </header>

      <main className="floor">
        {MACHINES.slice(0, visible).map((m, i) => (
          <MachineCard key={m.kind} def={m} index={i} level={state.levels[i]} ready={ready[i]} warp={speed} lite={lite} onBuy={purchase} />
        ))}
        {visible < MACHINES.length && <LockedCard />}
      </main>

      <footer className="hint">
        Machines glow when they can be improved. Click or press <kbd>1</kbd>–<kbd>8</kbd>; hold to keep upgrading.
      </footer>

      {away > 0 && (
        <div className="toast" onClick={() => setAway(0)}>
          Your machines hummed on for <strong>{formatDuration(away)}</strong> while you were away.
        </div>
      )}

      <FlowCanvas sources={sources} />
      <TimeWarp open={warpOpen} onToggle={() => setWarpOpen((o) => !o)} speed={speed} setSpeed={setSpeed} skip={skip} reset={reset} lite={lite} setLite={setLite} />
    </div>
  );
}
