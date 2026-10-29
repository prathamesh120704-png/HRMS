'use client';
import Link from 'next/link';
import { Icon } from '@/components/icons';

/**
 * Error page inside the app shell (DESIGN.md section 4): says what happened in plain words, offers Try again, and shows a
 * reference so a problem can be traced. It never shows the technical message to the person.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card" role="alert" style={{ maxWidth: 560, margin: '40px auto' }}>
      <div className="empty-icon" style={{ background: '#FEE2E2', color: 'var(--danger)' }}><Icon name="alert" size={26} /></div>
      <h1 style={{ textAlign: 'center', fontSize: 22 }}>Something went wrong</h1>
      <p className="hint" style={{ textAlign: 'center', margin: '8px 0 20px' }}>
        We couldn&apos;t load this page. Your data is safe. Please try again; if it keeps happening, tell HR and quote the reference below.
      </p>
      <div className="row" style={{ justifyContent: 'center' }}>
        <button type="button" className="btn" onClick={() => reset()}>Try again</button>
        <Link className="btn btn-secondary" href="/dashboard">Go to Home</Link>
      </div>
      {error.digest && <p className="hint" style={{ textAlign: 'center', marginTop: 16 }}>Reference: {error.digest}</p>}
    </div>
  );
}
