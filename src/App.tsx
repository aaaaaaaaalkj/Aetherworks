import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { CreditChart } from './components/CreditChart';
import { Flight, type FlightMemory } from './components/Flight';
import { PrestigePanel } from './components/PrestigePanel';
import { Tank } from './components/Tank';
import {
  advance,
  autoBuy,
  buy,
  canBuy,
  clearSave,
  freshState,
  gameToIdleSeconds,
  type IdleReport,
  loadGame,
  machinesOf,
  nextCost,
  periodsOf,
  prestige,
  pulseProgress,
  saveGame,
  sync,
  timeToNextUpgrade,
  totalRate,
} from './game/engine';
import { formatCompact, formatDuration } from './game/format';
import { NAMES } from './game/machines';
import { type Choice, describeChoice, METRICS, PRESTIGE_MIN_LEVEL, prestigePoints } from './game/prestige';

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
const MESSAGE_MS = 12_000;
/** A pulse that would rise faster than this (in real seconds) is a blur; don't draw it. */
const MIN_VISIBLE_PULSE_S = 0.5;
/** Coming back after at least this long gets a welcome-back message and pauses auto. */
const NOTICE_MIN_IDLE_S = 60;

// History is kept but has no tab for now; Flight replaces it.
type View = 'flight' | 'history' | 'prestige' | 'cheats';

/** 20×20 line icons for the tabs. */
const ICONS: Record<'flight' | 'prestige' | 'cheats' | 'auto', ReactNode> = {
  // A rising path ending in a dot.
  flight: (
    <>
      <path d="M2 16c4 0 5-6 9-7s4-4 5-5" />
      <circle cx="16.5" cy="4" r="2" className="fill" />
    </>
  ),
  // Coming round again.
  prestige: (
    <>
      <path d="M16 10a6 6 0 1 1-2-4.5" />
      <path d="M15 2.5v3.5h-3.5" />
    </>
  ),
  // Fast forward.
  cheats: <path d="M3 5l6 5-6 5zM10 5l6 5-6 5z" />,
  // A bolt: buys on its own.
  auto: <path d="M11 2L4 11h5l-1 7 7-9h-5z" />,
};
interface Message {
  id: number;
  body: ReactNode;
}

/** Shown for waits longer than this: how long to stay away instead, since idle time is squared. */
const SHOW_IDLE_AFTER_S = 3600;

function useFullscreen() {
  const [on, setOn] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const update = () => setOn(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => {});
  };
  // iPhone Safari has no fullscreen for pages; the button is hidden there.
  return { supported: !!document.fullscreenEnabled, on, toggle };
}

export default function App() {
  const [boot] = useState(loadGame);
  const game = useRef(boot);
  const rate = useRef(totalRate(boot));
  const [message, setMessage] = useState<Message | null>(null);
  const [view, setView] = useState<View>('flight');
  const speedRef = useRef(1);
  const [speed, setSpeedState] = useState(1);
  const autoRef = useRef(true);
  const [auto, setAutoState] = useState(true);
  const [, setFrame] = useState(0);
  const rerender = useCallback(() => setFrame((f) => f + 1), []);

  const setSpeed = (s: number) => {
    speedRef.current = s;
    setSpeedState(s);
  };
  const setAuto = useCallback((on: boolean) => {
    autoRef.current = on;
    setAutoState(on);
  }, []);
  const say = useCallback((body: ReactNode) => setMessage({ id: Date.now(), body }), []);

  // Main loop. sync() compares wall-clock time with how far the game has been
  // simulated: short gaps are active play, long ones (app closed, tab in the
  // background, machine asleep) are idle time. While the tab is hidden nothing is
  // simulated, so the whole hidden stretch becomes idle time on return. Coming
  // back from a long absence pauses auto, so the player can spend it themselves.
  useEffect(() => {
    let raf = 0;
    let lastRender = 0;
    const loop = (now: number) => {
      if (!document.hidden) {
        const idle = sync(game.current, speedRef.current, Date.now());
        if (idle && idle.idleSeconds >= NOTICE_MIN_IDLE_S) {
          setAuto(false);
          say(
            <>
              Welcome back. <strong>{formatDuration(idle.idleSeconds)}</strong> away counted as{' '}
              <strong>{formatDuration(idle.gameSeconds)}</strong>. Auto is paused.
            </>,
          );
        }
        if (autoRef.current && autoBuy(game.current) > 0) rate.current = totalRate(game.current);
      }
      if (now - lastRender > RENDER_INTERVAL_MS) {
        lastRender = now;
        rerender();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [rerender, say, setAuto]);

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
    const points = prestigePoints(game.current.upgrades);
    if (!prestige(game.current, choice)) return;
    rate.current = totalRate(game.current);
    saveGame(game.current);
    say(
      <>
        Prestige: <strong>{points.toLocaleString('en-US')}</strong> points into the {describeChoice(choice, NAMES)}.
        Next run locks <strong>{METRICS[game.current.prestigeMetric].toLowerCase()}</strong>.
      </>,
    );
    // Straight to the flight, where the prestige lands.
    setView('flight');
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
    if (!message) return;
    const id = window.setTimeout(() => setMessage(null), MESSAGE_MS);
    return () => window.clearTimeout(id);
  }, [message]);

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
    setMessage(null);
    rerender();
  };

  const s = game.current;
  const fullscreen = useFullscreen();
  const wait = timeToNextUpgrade(s);

  // Announce prestige the moment it unlocks.
  const best = useRef(s.bestLevel);
  useEffect(() => {
    if (best.current < PRESTIGE_MIN_LEVEL && s.bestLevel >= PRESTIGE_MIN_LEVEL)
      say(<>A machine reached level {PRESTIGE_MIN_LEVEL}: prestige is unlocked.</>);
    best.current = s.bestLevel;
  }, [s.bestLevel, say]);

  const readyCount = NAMES.filter((_, i) => canBuy(s, i)).length;
  useEffect(() => {
    document.title = readyCount ? `(${readyCount}) Aetherworks` : 'Aetherworks';
  }, [readyCount]);

  const icon = (name: keyof typeof ICONS) => (
    <svg viewBox="0 0 20 20" width="22" height="22" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
  const tab = (v: View & keyof typeof ICONS, label: string) => (
    <button
      className={view === v ? 'on' : ''}
      onClick={() => setView(v)}
      aria-pressed={view === v}
      aria-label={label}
      title={label}
    >
      {icon(v)}
    </button>
  );
  const flightMemory = useRef<FlightMemory | null>(null);
  const getGame = useCallback(() => game.current, []);
  const getRate = useCallback(() => rate.current, []);

  return (
    <div className={`app${fullscreen.on ? ' fs' : ''}`}>
      {/* Title and game age, or whatever the game has to say right now. */}
      <header className={`toolbar${message ? ' has-message' : ''}`}>
        <h1>Aetherworks</h1>
        {/* Nothing while an upgrade is affordable. Long waits also show the idle time that would cover them. */}
        <span className="estimate">
          <span className="next" title="Until the next upgrade can be bought, at the current speed">
            {wait !== null && wait > 0 && `next ${formatCompact(wait / speed)}`}
            {speed > 1 && <span className="warp"> {speedLabel(speed)}</span>}
          </span>
          {wait !== null && wait > SHOW_IDLE_AFTER_S && (
            <span className="idle" title="Or stay away this long: idle time is squared">
              idle {formatCompact(gameToIdleSeconds(wait))}
            </span>
          )}
        </span>
        {message && (
          <button key={message.id} className="message" onClick={() => setMessage(null)} title="Dismiss">
            {message.body}
          </button>
        )}
        {fullscreen.supported && (
          <button
            className="fullscreen"
            onClick={fullscreen.toggle}
            aria-label={fullscreen.on ? 'Leave full screen' : 'Full screen'}
            title={fullscreen.on ? 'Leave full screen' : 'Full screen'}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path
                d={
                  fullscreen.on
                    ? 'M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4'
                    : 'M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4'
                }
              />
            </svg>
          </button>
        )}
      </header>

      {/* Content grows up from the bottom; the machines and the tabs stay docked there. */}
      <main className="layout">
        {view === 'flight' ? (
          <Flight game={getGame} rate={getRate} pulses={pulses} memory={flightMemory} />
        ) : view === 'history' ? (
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
            <section className="panel cheats" aria-label="Cheats">
              <span className="cheat-label">Speed</span>
              <div className="group">
                {SPEEDS.map((v) => (
                  <button key={v} className={v === speed ? 'on' : ''} onClick={() => setSpeed(v)}>
                    {speedLabel(v)}
                  </button>
                ))}
              </div>
              <span className="cheat-label">Skip</span>
              <div className="group">
                {SKIPS.map(([label, secs]) => (
                  <button key={label} onClick={() => skip(secs)}>
                    {label}
                  </button>
                ))}
              </div>
              <span className="cheat-label" title="Simulate being away (idle time is squared)">
                Away
              </span>
              <div className="cheat-row">
                <div className="group">
                  {AWAY.map(([label, secs]) => (
                    <button key={label} onClick={() => simulateAway(secs)}>
                      {label}
                    </button>
                  ))}
                </div>
                <button className="reset" onClick={reset} title="Reset all progress">
                  Reset
                </button>
              </div>
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
          <nav className="tabs" aria-label="Views">
            {tab('flight', 'Flight')}
            {tab('prestige', 'Prestige')}
            {tab('cheats', 'Cheats')}
            <button
              className={`auto${auto ? ' on' : ''}`}
              onClick={() => setAuto(!auto)}
              aria-pressed={auto}
              aria-label={`Auto ${auto ? 'on' : 'off'}`}
              title={`Auto ${auto ? 'on' : 'off'}: buys the cheapest upgrade it can afford`}
            >
              {icon('auto')}
            </button>
          </nav>
        </div>
      </main>
    </div>
  );
}
