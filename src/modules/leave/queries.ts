import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface BalanceCard { code: string; name: string; available: number; quota: number }

/**
 * Available balance per type for the dashboard. The numbers come from the database function
 * `leave_available` (opening + adjustment + accrued - used - pending); nothing is computed in a component.
 * Full opening/accrued/used/pending breakdown arrives with the Leave screens (checkpoint 8).
 */
export async function balanceCards(db: SupabaseClient, employeeId: string, year: number): Promise<BalanceCard[]> {
  await db.rpc('ensure_balances', { p_emp: employeeId, p_year: year });
  const { data: types } = await db.from('leave_types').select('id, code, name, annual_quota').in('code', ['CL', 'SL', 'EL']).order('code');
  const out: BalanceCard[] = [];
  for (const t of (types ?? []) as { id: string; code: string; name: string; annual_quota: number }[]) {
    const { data } = await db.rpc('leave_available', { p_emp: employeeId, p_type: t.id, p_year: year });
    out.push({ code: t.code, name: t.name, available: Number(data ?? 0), quota: Number(t.annual_quota) });
  }
  return out;
}
