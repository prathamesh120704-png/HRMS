export function maskPAN(pan: string): string {
  return pan.length === 10 ? `${pan.slice(0, 5)}****${pan.slice(9)}` : '**********';
}

/** Aadhaar is never shown in full anywhere. */
export function maskAadhaar(aadhaar: string): string {
  return `XXXX XXXX ${aadhaar.replace(/\D/g, '').slice(-4)}`;
}

export function maskAccount(account: string): string {
  const digits = account.replace(/\D/g, '');
  return `${'•'.repeat(Math.max(digits.length - 4, 0))}${digits.slice(-4)}`;
}
