'use client';
import { useFormStatus } from 'react-dom';

export function SubmitButton({ children, variant = 'primary', pendingLabel }: {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`btn btn-${variant}`} disabled={pending} aria-busy={pending}>
      {pending ? (pendingLabel ?? 'Saving…') : children}
    </button>
  );
}
