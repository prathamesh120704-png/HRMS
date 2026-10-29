import Link from 'next/link';
import { Icon } from '@/components/icons';

// Shown inside the app shell. A page you may not open (for example another person's profile link) also lands here,
// on purpose: it does not reveal whether that page exists.
export default function NotFound() {
  return (
    <div className="card" style={{ maxWidth: 560, margin: '40px auto' }}>
      <div className="empty-icon"><Icon name="info" size={26} /></div>
      <h1 style={{ textAlign: 'center', fontSize: 22 }}>We can&apos;t find that page</h1>
      <p className="hint" style={{ textAlign: 'center', margin: '8px 0 20px' }}>
        It may have moved, or you may not have access to it.
      </p>
      <div className="row" style={{ justifyContent: 'center' }}>
        <Link className="btn" href="/dashboard">Go to Home</Link>
      </div>
    </div>
  );
}
