import { Card, PageHeader } from '@/components/ui/Card';
import { requireHr } from '@/lib/auth/session';
import { EmployeeForm } from '@/modules/employees/EmployeeForm';
import { managerOptions, referenceData } from '@/modules/employees/queries';

export default async function NewEmployee() {
  const s = await requireHr();
  const [{ departments, locations }, managers] = await Promise.all([referenceData(s.db), managerOptions(s.db)]);
  return (
    <>
      <PageHeader title="Add employee" sub="The employee code is generated automatically." />
      <Card>
        <EmployeeForm
          departments={departments.map((d) => ({ value: d.id, label: d.name }))}
          locations={locations.map((l) => ({ value: l.id, label: l.name }))}
          managers={managers}
        />
      </Card>
    </>
  );
}
