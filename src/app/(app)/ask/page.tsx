import { PageHeader } from '@/components/ui/Card';
import { requireEmployee } from '@/lib/auth/session';
import { AskHr } from '@/modules/agent/AskHr';

export default async function Ask() {
  const s = await requireEmployee();
  const configured = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  return (
    <>
      <PageHeader title="Ask HR" sub="The assistant checks the real system. It can prepare a leave request, but only you can confirm it." />
      {!configured && <div className="alert alert-info" role="status">The assistant is not switched on yet. Ask your administrator to add the AI key.</div>}
      <div className="card"><AskHr isManager={s.isManager} isHr={s.isHr} /></div>
    </>
  );
}
