import { SignOutButton } from '@clerk/nextjs';
import { Logo } from '@/components/Logo';

export default function AccessDenied() {
  return (
    <main id="main" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 16 }}>
      <div className="card" style={{ maxWidth: 480 }}>
        <Logo />
        <h1>Access denied</h1>
        <p>
          Your account isn&apos;t active or isn&apos;t linked to an employee record. If you think this is a mistake,
          contact HR.
        </p>
        <SignOutButton redirectUrl="/sign-in">
          <button className="btn btn-secondary" type="button">Sign out</button>
        </SignOutButton>
      </div>
    </main>
  );
}
