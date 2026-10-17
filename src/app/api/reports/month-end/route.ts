import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { buildMonthEndCsv } from '@/lib/csv';
import { todayIST } from '@/lib/time/ist';
import { monthEnd } from '@/modules/reports/queries';

export const dynamic = 'force-dynamic';
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** L8: month-end CSV. Server-side role check: managers get their team, HR gets everyone, everyone else gets 403. */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (!s.isHr && !s.isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const month = req.nextUrl.searchParams.get('month') ?? '';
  const today = todayIST();
  if (!MONTH.test(month) || month > today.slice(0, 7)) return NextResponse.json({ error: 'Pick a valid month' }, { status: 400 });

  const { rows, leaveCodes } = await monthEnd(s.db, s.employee, s.isHr, month, today);
  return new NextResponse(buildMonthEndCsv(rows, leaveCodes), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="tarang-month-end-${month}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
