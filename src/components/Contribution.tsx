import { MACHINES } from '../game/machines';

/** Share of total production per machine, as one proportional horizontal bar. */
export function Contribution({ levels }: { levels: number[] }) {
  const prod = MACHINES.map((m, i) => m.production(levels[i]));
  const total = prod.reduce((a, b) => a + b, 0);
  const shares = prod.map((p) => (total > 0 ? p / total : 0));

  return (
    <section className="panel">
      <h2>Share of production</h2>
      <div className="share-bar" role="img" aria-label="Share of production by machine">
        {total === 0 && <div className="share-empty" />}
        {shares.map((s, i) =>
          s >= 0.001 ? (
            <div
              key={i}
              className="share-seg"
              style={{ flexGrow: s, background: `var(--series-${i + 1})` }}
              title={MACHINES[i].name}
            />
          ) : null,
        )}
      </div>
      <ul className="legend">
        {MACHINES.map((m, i) => (
          <li key={m.name} className={shares[i] > 0 ? '' : 'idle'}>
            <span className="swatch" style={{ background: `var(--series-${i + 1})` }} />
            {m.name}
          </li>
        ))}
      </ul>
    </section>
  );
}
