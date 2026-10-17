import { STATUS_STYLES, type StatusKey } from './statusStyles';

/** Colour is never the only signal: every badge also has an icon and a text label. */
export function StatusBadge({ status, label }: { status: StatusKey; label?: string }) {
  const s = STATUS_STYLES[status];
  return (
    <span className="badge" style={{ background: s.bg, color: s.fg }}>
      <span aria-hidden="true">{s.icon}</span>
      {label ?? status}
    </span>
  );
}

export function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'ok' | 'warn' | 'bad' }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}
