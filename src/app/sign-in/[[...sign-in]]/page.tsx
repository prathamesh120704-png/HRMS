import { SignIn } from '@clerk/nextjs';
import { Logo } from '@/components/Logo';

export default function SignInPage() {
  return (
    <main id="main" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', gap: 16, padding: 16 }}>
      <div style={{ textAlign: 'center' }}>
        <Logo size={40} />
        <p className="sub">Sign in with your work email. Accounts are created by HR.</p>
      </div>
      <SignIn />
    </main>
  );
}
