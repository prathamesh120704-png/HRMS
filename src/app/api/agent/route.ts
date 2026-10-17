import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { todayIST } from '@/lib/time/ist';
import { MAX_HISTORY, MAX_MESSAGE_CHARS, runAgent } from '@/modules/agent/run';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const body = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(MAX_MESSAGE_CHARS) })).min(1).max(MAX_HISTORY),
});

/** Questions per minute per person. The free AI tier is small, so this also protects the shared quota. */
const PER_MINUTE = 12;

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return NextResponse.json({ error: 'The assistant is not configured yet. Ask your administrator to add the AI key.' }, { status: 503 });
  }
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Send between 1 and 8 messages of up to 1000 characters.' }, { status: 400 });
  // The last message must come from the user; earlier turns are context only.
  if (parsed.data.messages.at(-1)?.role !== 'user') return NextResponse.json({ error: 'The last message must be yours.' }, { status: 400 });

  // Own agent_log rows are readable through RLS, so the user's own session can count its recent calls.
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await s.db.from('agent_log').select('id', { count: 'exact', head: true }).gte('created_at', since);
  if ((count ?? 0) >= PER_MINUTE * 3) return NextResponse.json({ error: 'Too many questions. Please wait a minute.' }, { status: 429 });

  const { data: loc } = await s.db.from('locations').select('name').eq('id', s.employee.location_id).maybeSingle();
  const reply = await runAgent({
    employee: s.employee, db: s.db, isHr: s.isHr, isManager: s.isManager, today: todayIST(),
    location: loc?.name ?? 'your location', history: parsed.data.messages,
  });
  return NextResponse.json(reply);
}
