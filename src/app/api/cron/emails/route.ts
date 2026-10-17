import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { flushEmails } from '@/lib/email/send';

export const dynamic = 'force-dynamic';

/**
 * Daily job (Vercel cron, 00:30 IST): retries queued emails. It also touches the database, which keeps the free
 * Supabase project from pausing. Vercel sends `Authorization: Bearer $CRON_SECRET`; anything else gets 401.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    await createClient(url, key, { auth: { persistSession: false } }).from('locations').select('id').limit(1);
  }
  return NextResponse.json(await flushEmails());
}
