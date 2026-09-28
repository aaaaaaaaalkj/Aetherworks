import { splitCredits } from '../game/format';

/** The credit balance, rendered as a bank of glowing nixie tubes. */
export function Vault({ credits }: { credits: number }) {
  const { digits, suffix } = splitCredits(credits);
  return (
    <div className="vault" id="vault" aria-label="Credits">
      <div className="vault-flash" />
      <div className="vault-label">Credits</div>
      <div className="tubes" role="img" aria-label={`${digits}${suffix}`}>
        {[...digits].map((ch, i) =>
          ch === ',' || ch === '.' ? (
            <span key={i} className="tube-sep">
              {ch === '.' ? '.' : ','}
            </span>
          ) : (
            <span key={i} className="tube">
              <span className="tube-ghost">8</span>
              <span className="tube-digit">{ch}</span>
            </span>
          ),
        )}
        {suffix && (
          <span className="tube tube-suffix">
            <span className="tube-digit">{suffix}</span>
          </span>
        )}
      </div>
    </div>
  );
}
