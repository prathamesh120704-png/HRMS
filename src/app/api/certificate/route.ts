import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// {employee uuid}/{uuid}/{file}: the only shape we ever store.
const PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,80}$/i;

/**
 * Medical certificates are health data. The bucket is private; this makes a 60-second signed link and redirects.
 * The storage policy lets only the owner, their manager and HR read the object, so asking for someone else's
 * file simply fails (404).
 */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const path = req.nextUrl.searchParams.get('path') ?? '';
  if (!PATH.test(path)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { data, error } = await s.db.storage.from('leave-certificates').createSignedUrl(path, 60);
  if (error || !data?.signedUrl) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.redirect(data.signedUrl, 302);
}
