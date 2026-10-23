import 'server-only';

interface PgError { message: string; code?: string }

/**
 * Maps a Postgres/PostgREST error to a message a person can act on. Our own `raise exception` texts
 * (code P0001) are already written for users; constraint violations get a plain-language rewrite.
 */
export function friendlyDbError(e: PgError): string {
  const m = e.message ?? '';
  if (e.code === '42501') return 'You are not allowed to do that.';
  // PostgREST says "function not found" when the app is newer than the database (a migration has not been run).
  if (e.code === 'PGRST202') return 'This feature needs a database update that has not been applied yet. Ask the administrator to run the latest migration.';
  if (e.code === '23505') {
    if (m.includes('email')) return 'An employee with this email already exists.';
    if (m.includes('leave_no_overlap')) return 'You already have leave on some of these dates.';
    if (m.includes('holidays')) return 'That location already has a holiday on this date.';
    return 'That record already exists.';
  }
  if (e.code === '23514') {
    if (m.includes('employees_age_18')) return 'The employee must be at least 18 on the date of joining.';
    if (m.includes('pan')) return 'PAN must be 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F).';
    if (m.includes('ifsc')) return 'IFSC must be 4 letters, then 0, then 6 letters or digits.';
    return 'One of the values is not allowed. Please check the form.';
  }
  if (e.code === '23503') return 'A selected value no longer exists. Refresh the page and try again.';
  if (e.code === 'P0001') return m.replace(/^Reporting loop:.*/, 'That reporting line would create a loop (someone would end up reporting to themselves).');
  return 'Something went wrong. Please try again.';
}
