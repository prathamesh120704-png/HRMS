import { Card, PageHeader } from '@/components/ui/Card';
import { requireEmployee } from '@/lib/auth/session';
import { todayIST } from '@/lib/time/ist';
import { ApplyLeaveForm, type FormType } from '@/modules/leave/ApplyLeaveForm';
import { applyContext, balancesFor } from '@/modules/leave/queries';

export default async function ApplyLeave({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const s = await requireEmployee();
  const { type } = await searchParams;
  const today = todayIST();
  const year = Number(today.slice(0, 4));
  const [balances, ctx] = await Promise.all([balancesFor(s.db, s.employee, year, today), applyContext(s.db, s.employee, today)]);

  const types: FormType[] = balances.map(({ type: t, balance }) => ({
    code: t.code, name: t.name, halfDayAllowed: t.halfDayAllowed, certificateAfterDays: t.certificateAfterDays,
    eligibleGender: t.eligibleGender, countsCalendarDays: t.countsCalendarDays,
    available: balance.available, unlimited: t.accrualMethod === 'none',
  }));

  return (
    <>
      <PageHeader title="Apply leave" sub="Working days are counted for your location: weekly offs and holidays are never charged." />
      <Card>
        <ApplyLeaveForm types={types} cal={ctx.cal} existing={ctx.existing} today={today} gender={s.employee.gender} defaultType={type} />
      </Card>
    </>
  );
}
