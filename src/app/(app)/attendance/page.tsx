import { Card, PageHeader } from '@/components/ui/Card';
import { requireEmployee } from '@/lib/auth/session';
import { addDays, todayIST } from '@/lib/time/ist';
import { MonthCalendar } from '@/modules/attendance/MonthCalendar';
import { RegularisationForm } from '@/modules/attendance/RegularisationForm';
import { monthFor } from '@/modules/attendance/queries';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export default async function MyAttendance({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const s = await requireEmployee();
  const today = todayIST();
  const { month: m } = await searchParams;
  const month = m && MONTH.test(m) ? m : today.slice(0, 7);
  const days = await monthFor(s.db, s.employee, month, today);
  const lateCount = days.filter((d) => d.result.isLate && d.result.status !== 'On Leave').length;

  return (
    <>
      <PageHeader title="My attendance" sub="Times are in IST. Weekly offs and holidays follow your work location." />
      <Card>
        <MonthCalendar days={days} month={month} today={today} basePath="/attendance" />
        <p className="hint" style={{ marginTop: 12 }}>
          Late marks this month: {lateCount}. Every 3 Late marks convert into one half day of Loss of Pay.
        </p>
      </Card>
      <Card title="Missed a punch? Request a correction">
        <p className="hint" style={{ marginBottom: 12 }}>Your manager must approve it before your attendance changes. Allowed for the last 30 days.</p>
        <RegularisationForm defaultDate={addDays(today, -1)} />
      </Card>
    </>
  );
}
