const SPEEDS = [1, 10, 100, 1_000, 10_000, 100_000];
const SKIPS: [string, number][] = [
  ['+1 min', 60],
  ['+10 min', 600],
  ['+1 hour', 3600],
  ['+8 hours', 8 * 3600],
  ['+1 day', 86400],
  ['+1 week', 7 * 86400],
];

const speedLabel = (s: number) => (s >= 1000 ? `${s / 1000}k×` : `${s}×`);

interface Props {
  open: boolean;
  onToggle: () => void;
  speed: number;
  setSpeed: (s: number) => void;
  skip: (seconds: number) => void;
  reset: () => void;
  lite: boolean;
  setLite: (lite: boolean) => void;
}

/** Testing tool: fast-forward the flow of time. */
export function TimeWarp({ open, onToggle, speed, setSpeed, skip, reset, lite, setLite }: Props) {
  return (
    <div className={`warp${open ? ' open' : ''}${speed > 1 ? ' active' : ''}`}>
      {open && (
        <div className="warp-panel" role="dialog" aria-label="Time warp">
          <div className="warp-title">Time Warp</div>
          <div className="warp-sub">Speed of time</div>
          <div className="warp-row">
            {SPEEDS.map((s) => (
              <button key={s} className={s === speed ? 'on' : ''} onClick={() => setSpeed(s)}>
                {speedLabel(s)}
              </button>
            ))}
          </div>
          <div className="warp-sub">Leap forward</div>
          <div className="warp-row">
            {SKIPS.map(([label, secs]) => (
              <button key={label} onClick={() => skip(secs)}>
                {label}
              </button>
            ))}
          </div>
          <div className="warp-sub">Visual effects</div>
          <div className="warp-row warp-row-2">
            <button className={lite ? '' : 'on'} onClick={() => setLite(false)}>
              Full
            </button>
            <button className={lite ? 'on' : ''} onClick={() => setLite(true)} title="Machines animate only while hovered">
              Lite
            </button>
          </div>
          <button
            className="warp-reset"
            onClick={() => {
              if (window.confirm('Dismantle every machine and start over?')) reset();
            }}
          >
            Reset progress
          </button>
        </div>
      )}
      <button className="warp-toggle" onClick={onToggle} title="Time warp (W)">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M6 2h12M6 22h12M7 2c0 6 10 6 10 10S7 16 7 22M17 2c0 6-10 6-10 10s10 4 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span>{speed > 1 ? speedLabel(speed) : 'Warp'}</span>
      </button>
    </div>
  );
}
