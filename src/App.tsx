import { useCallback, useEffect, useRef, useState } from 'react';
import { CreditChart } from './components/CreditChart';
import { PrestigePanel } from './components/PrestigePanel';
import { Tank } from './components/Tank';
import {
  advance,
  buy,
  canBuy,
  clearSave,
  freshState,
  type IdleReport,
  loadGame,
  machinesOf,
  nextCost,
  periodsOf,
  prestige,
  pulseProgress,
  saveGame,
  sync,
  totalRate,
} from './game/engine';
import { formatDuration } from './game/format';
import { NAMES } from './game/machines';
import type { Choice } from './game/prestige';

const RENDER_INTERVAL_MS = 100;
const SAVE_INTERVAL_MS = 5000;

const SPEEDS = [1, 10, 100, 1_000, 10_000, 100_000];
const SKIPS: [string, number][] = [
  ['+1m', 60],
  ['+10m', 600],
  ['+1h', 3600],
  ['+8h', 8 * 3600],
  ['+1d', 86_400],
  ['+1w', 604_800],
];
// Testing: pretend the app was idle for this long (goes through the real idle path).
const AWAY: [string, number][] = [
  ['30m', 1800],
  ['1h', 3600],
  ['2h', 7200],
  ['8h', 8 * 3600],
];
const speedLabel = (s: number) => (s >= 1000 ? `${s / 1000}k×` : `${s}×`);
const NOTICE_MS = 12_000;
/** A pulse that would rise faster than this (in real seconds) is a blur; don't draw it. */
const MIN_VISIBLE_PULSE_S = 0.5;
const NOTICE_MIN_IDLE_S = 60;

export default function App() {
  const [boot] = useState(loadGame);
  const game = useRef(boot);
  const rate = useRef(totalRate(boot));
  const [away, setAway] = useState<IdleReport | null>(null);
  const [view, setView] = useState<'history' | 'prestige' | 'cheats'>('history');
  const speedRef = useRef(1);
  const [speed, setSpeedState] = useState(1);
  const [, setFrame] = useState(0);
  const rerender = useCallback(() => setFrame((f) => f + 1), []);

  const setSpeed = (s: number) => {
    speedRef.current = s;
    setSpeedState(s);
  };

  // Main loop. sync() compares wall-clock time with how far the game has been
  // simulated: short gaps are active play, long ones (app closed, tab in the
  // background, machine asleep) are idle time. While the tab is hidden nothing is
  // simulated, so the whole hidden stretch becomes idle time on return.
  useEffect(() => {
    let raf = 0;
    let lastRender = 0;
    const loop = (now: number) => {
      if (!document.hidden) {
        const idle = sync(game.current, speedRef.current, Date.now());
        if (idle && idle.idleSeconds >= NOTICE_MIN_IDLE_S) setAway(idle);
      }
      if (now - lastRender > RENDER_INTERVAL_MS) {
        lastRender = now;
        rerender();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [rerender]);

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

  // Read by the tank every animation frame, outside React renders.
  const pulses = useCallback(() => {
    const s = game.current;
    const periods = periodsOf(s);
    return pulseProgress(s).map((p, i) => (periods[i] / speedRef.current < MIN_VISIBLE_PULSE_S ? null : p));
  }, []);

  const purchase = useCallback(
    (i: number) => {
      if (!buy(game.current, i)) return;
      rate.current = totalRate(game.current);
      rerender();
    },
    [rerender],
  );

  const doPrestige = (choice: Choice) => {
    if (!prestige(game.current, choice)) return;
    rate.current = totalRate(game.current);
    saveGame(game.current);
    // Straight to the chart, where the drop shows.
    setView('history');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= NAMES.length) purchase(n - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [purchase]);

  useEffect(() => {
    if (!away) return;
    const id = window.setTimeout(() => setAway(null), NOTICE_MS);
    return () => window.clearTimeout(id);
  }, [away]);

  const simulateAway = (seconds: number) => {
    game.current.syncedAt -= seconds * 1000;
  };

  const skip = (seconds: number) => {
    advance(game.current, seconds, true);
    rerender();
  };

  const reset = () => {
    if (!window.confirm('Reset all progress?')) return;
    clearSave();
    game.current = freshState();
    rate.current = 0;
    setSpeed(1);
    rerender();
  };

  const s = game.current;
  const readyCount = NAMES.filter((_, i) => canBuy(s, i)).length;
  useEffect(() => {
    document.title = readyCount ? `(${readyCount}) Aetherworks` : 'Aetherworks';
  }, [readyCount]);

  return (
    <div className="app">
      <header className="toolbar">
        <h1>Aetherworks</h1>
        <span className="clock" title="Game time since start">
          {formatDuration(s.time)}
          {speed > 1 && <span className="warp"> {speedLabel(speed)}</span>}
        </span>
        {/* History and cheats share the space above the machines. */}
        <div className="view-toggle" role="group" aria-label="Show">
          <button className={view === 'history' ? 'on' : ''} onClick={() => setView('history')}>
            History
          </button>
          <button className={view === 'prestige' ? 'on' : ''} onClick={() => setView('prestige')}>
            Prestige
          </button>
          <button className={view === 'cheats' ? 'on' : ''} onClick={() => setView('cheats')}>
            Cheats
          </button>
        </div>
        {away && (
          <button className="notice" onClick={() => setAway(null)}>
            Welcome back. You were away for <strong>{formatDuration(away.idleSeconds)}</strong>, which counts as{' '}
            <strong>{formatDuration(away.gameSeconds)}</strong> of production.
          </button>
        )}
      </header>

      {/* Content grows up from the bottom; the clickable machines stay docked there. */}
      <main className="layout">
        {view === 'history' ? (
          <CreditChart
            machines={machinesOf(s)}
            history={s.history}
            purchases={s.purchases}
            prestiges={s.prestiges}
            now={s.time}
            credits={s.credits}
            earned={s.earned}
          />
        ) : view === 'prestige' ? (
          <div className="slot scroll-slot">
            <PrestigePanel state={s} onPrestige={doPrestige} />
          </div>
        ) : (
          <div className="slot scroll-slot">
            <section className="panel controls" aria-label="Cheats">
              <div className="group">
                {SPEEDS.map((v) => (
                  <button key={v} className={v === speed ? 'on' : ''} onClick={() => setSpeed(v)}>
                    {speedLabel(v)}
                  </button>
                ))}
              </div>
              <div className="group">
                {SKIPS.map(([label, secs]) => (
                  <button key={label} onClick={() => skip(secs)}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="group" title="Simulate being away (idle time is squared)">
                <span className="group-label">Away</span>
                {AWAY.map(([label, secs]) => (
                  <button key={label} onClick={() => simulateAway(secs)}>
                    {label}
                  </button>
                ))}
              </div>
              <button className="reset" onClick={reset}>
                Reset
              </button>
            </section>
          </div>
        )}
        <div className="dock">
          <Tank
            machines={machinesOf(s)}
            levels={s.levels}
            nextCosts={NAMES.map((_, i) => nextCost(s, i))}
            periods={periodsOf(s)}
            credits={s.credits}
            rate={rate.current}
            pulses={pulses}
            onBuy={purchase}
          />
        </div>
      </main>
    </div>
  );
}
