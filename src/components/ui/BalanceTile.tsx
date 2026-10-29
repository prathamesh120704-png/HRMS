/**
 * One leave type's balance: the available number big, and a bar for how much of the year's allowance is still left.
 * The bar is a visual aid only: the number and the sentence carry the meaning, so colour is never the only signal.
 */
const fmt = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(Math.round(n * 100) / 100));

export function BalanceTile({ code, name, available, total, detail }: {
  code: string; name?: string; available: number; total: number; detail?: string;
}) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (available / total) * 100)) : 0;
  const tone = available <= 0 ? 'low' : pct < 25 ? 'low' : pct < 50 ? 'warn' : 'ok';
  const words = tone === 'low' ? (available <= 0 ? 'none left' : 'running low') : tone === 'warn' ? 'less than half left' : '';
  return (
    <div className="tile">
      <div className="tile-top"><span className="tile-code">{code}</span>{name && <span className="tile-name">{name}</span>}</div>
      <div className="tile-num">{fmt(available)}</div>
      <div className="tile-sub">available{total > 0 ? ` of ${fmt(total)}` : ''}{words ? ` · ${words}` : ''}</div>
      {total > 0 && (
        <div className={`bar ${tone === 'ok' ? '' : tone}`} role="img" aria-label={`${fmt(available)} of ${fmt(total)} days available`}>
          <span style={{ width: `${pct}%` }} />
        </div>
      )}
      {detail && <div className="tile-detail">{detail}</div>}
    </div>
  );
}
