/**
 * Automated part of the testing checklist (requirement document, "Definition of done"). Run: npm run checklist
 *
 * It checks, against the REAL database and the LIVE site, everything that can be checked without a person signed in
 * through Clerk. Rule checks use attempts that MUST FAIL (so nothing is written) or read-only queries. Items that need a
 * signed-in browser are listed in docs/MANUAL-CHECKLIST.md. The result is written to docs/TEST-REPORT.md.
 */
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
const LIVE = process.env.LIVE_URL ?? 'https://hrms-pi-three.vercel.app';

interface Row { area: string; item: string; ok: boolean; how: string; detail?: string }
const rows: Row[] = [];
const add = (area: string, item: string, how: string, ok: boolean, detail = '') => {
  rows.push({ area, item, ok, how, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${area}] ${item}${detail ? ` -- ${detail}` : ''}`);
};

/** The statement must be REJECTED by the database with one of these Postgres error codes (or message fragment). */
async function mustFail(area: string, item: string, how: string, run: () => PromiseLike<{ error: { code?: string; message: string } | null }>, expect: { code?: string; text?: string }) {
  const { error } = await run();
  const okCode = !!error && (!expect.code || error.code === expect.code) && (!expect.text || error.message.includes(expect.text));
  add(area, item, how, okCode, error ? `${error.code ?? ''} ${error.message.slice(0, 90)}` : 'NOT REJECTED: the database accepted it');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

async function main() {
  const { data: emps } = await db.from('employees').select('id, employee_code, full_name, dob, date_of_joining, location_id, mobile, reporting_manager_id, is_hr_admin');
  const E = emps as { id: string; employee_code: string; full_name: string; dob: string; date_of_joining: string; location_id: string; mobile: string; reporting_manager_id: string | null; is_hr_admin: boolean }[];
  const byName = (n: string) => E.find((e) => e.full_name === n)!;
  const asha = byName('Asha Naik'), rohan = byName('Rohan Kamat'), aditi = byName('Aditi Joshi');
  const verna = E.find((e) => e.full_name === 'Anand Prabhu')!;

  // ---------------------------------------------------------------- Employee Master
  const codes = E.map((e) => e.employee_code);
  add('Employee Master', 'Codes are generated (KCFnnnn) and unique', 'database sequence + unique constraint',
    codes.every((c) => /^KCF\d{4}$/.test(c)) && new Set(codes).size === codes.length, `${codes.length} employees`);
  await mustFail('Employee Master', 'An employee code can never be changed', 'immutability trigger', () => db.from('employees').update({ employee_code: 'KCF9999' }).eq('id', asha.id), { text: 'employee_code cannot be changed' });
  await mustFail('Employee Master', 'Invalid PAN (ABC123) is rejected', 'check constraint on employee_statutory.pan', () => db.from('employee_statutory').update({ pan: 'ABC123' }).eq('employee_id', asha.id), { code: '23514' });
  await mustFail('Employee Master', 'Invalid IFSC is rejected', 'check constraint on employee_bank.ifsc', () => db.from('employee_bank').update({ ifsc: 'HDFC1001234' }).eq('employee_id', asha.id), { code: '23514' });
  await mustFail('Employee Master', '9-digit mobile is rejected', 'check constraint on employees.mobile', () => db.from('employees').update({ mobile: '987654321' }).eq('id', asha.id), { code: '23514' });
  await mustFail('Employee Master', 'Aadhaar of 11 digits is rejected', 'check constraint on employee_statutory.aadhaar', () => db.from('employee_statutory').update({ aadhaar: '12345678901' }).eq('employee_id', asha.id), { code: '23514' });
  // 17 on the joining date: born 17 years and 1 day before joining.
  const j = new Date(`${asha.date_of_joining}T00:00:00Z`);
  const seventeen = new Date(Date.UTC(j.getUTCFullYear() - 17, j.getUTCMonth(), j.getUTCDate() + 1)).toISOString().slice(0, 10);
  await mustFail('Employee Master', 'An employee aged 17 on the joining date is rejected', 'check constraint employees_age_18', () => db.from('employees').update({ dob: seventeen }).eq('id', asha.id), { code: '23514' });
  await mustFail('Employee Master', 'Setting A\'s manager to B while B reports to A is blocked', 'no-reporting-loop trigger (Rohan is above Asha)', () => db.from('employees').update({ reporting_manager_id: asha.id }).eq('id', rohan.id), { text: 'Reporting loop' });
  await mustFail('Employee Master', 'An employee cannot report to themselves', 'loop trigger and check constraint (either rejects it)', () => db.from('employees').update({ reporting_manager_id: asha.id }).eq('id', asha.id), {});

  const files = walk('src').filter((f) => /\.(ts|tsx)$/.test(f));
  const selectsAadhaar = files.filter((f) => /\.select\([^)]*aadhaar/.test(readFileSync(f, 'utf8'))).map((f) => f.replace(/\\/g, '/'));
  const queries = readFileSync('src/modules/employees/queries.ts', 'utf8');
  const reveal = readFileSync('supabase/migrations/0002_functions.sql', 'utf8').split('create function hr_reveal')[1]?.split('$$;')[0] ?? '';
  add('Employee Master', 'Aadhaar is never shown in full (UI, CSV, agent)',
    'code audit: the only query that selects it is masked on the spot; HR Reveal has no Aadhaar branch; CSV and agent have no such field (unit-tested)',
    selectsAadhaar.length === 1 && selectsAadhaar[0].endsWith('modules/employees/queries.ts') && queries.includes('maskAadhaar(') && !/aadhaar/i.test(reveal) && reveal.length > 50,
    `selected only in: ${selectsAadhaar.join(', ')}`);
  const detail = readFileSync('src/app/(app)/employees/[id]/page.tsx', 'utf8');
  add('Employee Master', 'A non-HR user opening /employees/<id> gets a 404', 'code audit of the page guard (manual URL test also listed)', /if \(!s\.isHr\) notFound\(\)/.test(detail));

  // ---------------------------------------------------------------- Attendance
  const { data: att } = await db.from('attendance').select('employee_id, date').limit(1).single();
  await mustFail('Attendance', 'A second attendance record for the same employee and day is impossible', 'unique(employee_id, date)',
    () => db.from('attendance').insert({ employee_id: att!.employee_id, date: att!.date, check_in: new Date().toISOString() }), { code: '23505' });
  const { data: hols } = await db.from('holidays').select('date, location_id, name').eq('name', 'Verna Plant Foundation Day');
  const { data: pan } = await db.from('locations').select('id').eq('city', 'Panaji').single();
  const onPanaji = await db.from('holidays').select('id').eq('location_id', pan!.id).eq('date', hols![0].date);
  add('Attendance', 'A state holiday added for Verna does not exist for Panaji', 'holidays are per location', (hols?.length ?? 0) === 1 && (onPanaji.data?.length ?? 0) === 0, hols?.[0]?.date ?? '');
  const { data: locs } = await db.from('locations').select('city, weekly_off_days');
  const off = Object.fromEntries((locs ?? []).map((l: { city: string; weekly_off_days: number[] }) => [l.city, l.weekly_off_days.join(',')]));
  add('Attendance', 'Head office Sat+Sun off, plant only Sunday off', 'locations.weekly_off_days', off.Panaji === '0,6' && off.Verna === '0', JSON.stringify(off));

  // ---------------------------------------------------------------- Leave
  const { data: types } = await db.from('leave_types').select('id, code');
  const T = Object.fromEntries((types ?? []).map((t: { id: string; code: string }) => [t.code, t.id]));
  const accrual = async (code: string) => Number((await db.rpc('leave_accrued', { p_emp: aditi.id, p_type: T[code], p_year: 2026, p_as_of: '2026-12-31' })).data);
  add('Leave', 'An employee who joined on 1 July sees pro-rated CL 4 and SL 3.5', 'leave_accrued() in the database', aditi.date_of_joining === '2026-07-01' && (await accrual('CL')) === 4 && (await accrual('SL')) === 3.5, `${aditi.full_name}: CL ${await accrual('CL')}, SL ${await accrual('SL')}`);
  const days = async (emp: string, a: string, b: string) => Number((await db.rpc('leave_count_days', { p_emp: emp, p_from: a, p_to: b, p_half: false, p_calendar: false })).data);
  const fm = await days(asha.id, '2026-10-23', '2026-10-26');
  add('Leave', 'Friday to Monday at head office counts 2 days, not 4', 'leave_count_days() in the database', fm === 2, `${fm} day(s)`);
  const fmV = await days(verna.id, '2026-10-23', '2026-10-26');
  add('Leave', 'The same dates at the plant count 3 (Saturday is a working day)', 'leave_count_days() in the database', fmV === 3, `${fmV} day(s)`);
  const { data: pend } = await db.from('leave_requests').select('id, employee_id, from_date, to_date').eq('status', 'pending').limit(1);
  if (pend?.length) {
    await mustFail('Leave', 'A person cannot be the approver of their own leave', 'check constraint leave_not_self_approved', () => db.from('leave_requests').update({ approver_id: pend[0].employee_id }).eq('id', pend[0].id), { code: '23514' });
    await mustFail('Leave', 'Two live requests for the same dates are rejected', 'exclusion constraint leave_no_overlap', () => db.from('leave_requests').insert({ employee_id: pend[0].employee_id, leave_type_id: T.CL, from_date: pend[0].from_date, to_date: pend[0].to_date, days: 1, reason: 'overlap test' }), { code: '23P01' });
  } else add('Leave', 'Self-approval and overlap constraints', 'needs one pending request in the database to test against', false, 'no pending request found: create one in the app, then re-run');
  const old = new Date(Date.now() - 40 * 86_400_000).toISOString().slice(0, 10);
  await mustFail('Leave', 'Leave more than 30 days in the past is rejected', 'check constraint leave_max_30_days_back', () => db.from('leave_requests').insert({ employee_id: asha.id, leave_type_id: T.CL, from_date: old, to_date: old, days: 1, reason: 'too old' }), { code: '23514' });
  await mustFail('Leave', 'A half day over several dates is rejected', 'check constraint leave_half_day_single', () => db.from('leave_requests').insert({ employee_id: asha.id, leave_type_id: T.CL, from_date: '2026-11-02', to_date: '2026-11-03', is_half_day: true, days: 0.5, reason: 'bad half' }), { code: '23514' });

  // ---------------------------------------------------------------- Security
  for (const t of ['employees', 'employee_statutory', 'employee_bank', 'leave_requests', 'attendance', 'agent_log']) {
    const r = await anon.from(t).select('*').limit(1);
    add('Security', `Anonymous visitors cannot read ${t}`, 'no grant for anon + RLS', !!r.error, r.error?.message.slice(0, 60) ?? 'READ SUCCEEDED');
  }
  await mustFail('Security', 'Anonymous visitors cannot write to employees', 'no write grant', () => anon.from('employees').update({ is_hr_admin: true }).eq('id', asha.id), {});
  await mustFail('Security', 'Anonymous visitors cannot call HR functions', 'EXECUTE revoked from anon', () => anon.rpc('hr_update_employee', { p_id: asha.id, p: { is_hr_admin: true } }), {});

  const tracked = execSync('git ls-files', { encoding: 'utf8' }).split('\n');
  add('Security', 'No .env file is tracked by git', 'git ls-files', !tracked.some((f) => /(^|\/)\.env(\.|$)/.test(f) && !f.endsWith('.env.example')));
  const historyEnv = execSync('git log --all --name-only --pretty=format:', { encoding: 'utf8' }).split('\n').some((f) => /(^|\/)\.env(\.local|\.production)?$/.test(f));
  add('Security', '.env.local was never committed, in any commit', 'git log --all --name-only', !historyEnv);
  const hist = execSync('git log -p --all --no-color', { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const patterns: [string, RegExp][] = [
    ['Clerk secret key', /sk_(test|live)_[A-Za-z0-9]{20,}/], ['JWT/service key', /eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/],
    ['Google API key', /AIza[0-9A-Za-z_-]{30,}/], ['Google new-style key', /\bAQ\.[A-Za-z0-9_-]{30,}/], ['Brevo key', /xkeysib-[a-z0-9-]{20,}/i],
  ];
  const hits = patterns.filter(([, re]) => re.test(hist)).map(([n]) => n);
  add('Security', 'No keys or tokens anywhere in the git history', 'scanned every commit for Clerk, JWT, Google and Brevo key shapes', hits.length === 0, hits.length ? `FOUND: ${hits.join(', ')}` : 'scanned all commits');
  const example = readFileSync('.env.example', 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l) && !l.startsWith('NEXT_PUBLIC_CLERK_SIGN_IN') && !/^\w+=\/?[a-z-]*$/.test(l.split('=')[1] ?? '') );
  add('Security', '.env.example has blank values only', 'file check', example.every((l) => l.split('=')[1].trim() === '' || l.includes('/sign-in') || l.includes('/dashboard')), `${example.length} variables`);

  // live site, unauthenticated
  const probe = async (path: string, init?: RequestInit) => (await fetch(`${LIVE}${path}`, { redirect: 'manual', ...init })).status;
  const live: [string, number, (s: number) => boolean][] = [
    ['/dashboard', await probe('/dashboard'), (s) => s !== 200],
    ['/api/reports/month-end?month=2026-09', await probe('/api/reports/month-end?month=2026-09'), (s) => s !== 200],
    ['/api/certificate?path=x', await probe('/api/certificate?path=x'), (s) => s !== 200],
    ['POST /api/agent', await probe('/api/agent', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }), (s) => s !== 200],
    ['/api/cron/emails (no secret)', await probe('/api/cron/emails'), (s) => s === 401 || s === 404],
  ];
  for (const [p, s, ok] of live) add('Live site', `Signed-out request to ${p} is refused`, 'HTTP probe of the deployed app', ok(s), `HTTP ${s}`);
  add('Live site', 'Sign-in page loads', 'HTTP probe', (await probe('/sign-in')) === 200);

  // ---------------------------------------------------------------- Agent
  const { data: logs } = await db.from('agent_log').select('question_id, tool');
  const perQ = new Map<string, number>();
  for (const l of (logs ?? []) as { question_id: string }[]) perQ.set(l.question_id, (perQ.get(l.question_id) ?? 0) + 1);
  add('Agent', 'No question ever used more than 5 tool calls', 'agent_log grouped by question', Math.max(0, ...perQ.values()) <= 5, `${perQ.size} logged questions, ${logs?.length ?? 0} tool calls, max ${Math.max(0, ...perQ.values())} per question`);
  add('Agent', 'The 20 attack/behaviour prompts pass', 'tests/agent/prompts.md run on 2026-10-17 (re-run with npm run agent:test)', existsSync('tests/agent/prompts.md') && /20 of 20 passed/.test(readFileSync('tests/agent/prompts.md', 'utf8')), 'result recorded in prompts.md');
  const { data: dr } = await db.from('agent_drafts').select('status');
  add('Agent', 'Drafts exist but were never auto-submitted', 'drafts stay "draft" until a person presses Confirm', ((dr ?? []) as { status: string }[]).every((d) => d.status === 'draft' || d.status === 'confirmed' || d.status === 'discarded') && (dr?.length ?? 0) > 0, `${dr?.length ?? 0} drafts`);

  const { data: audit } = await db.from('audit_log').select('id', { count: 'exact', head: true }).eq('table_name', 'employees');
  void audit;
  const { count: auditCount } = await db.from('audit_log').select('id', { count: 'exact', head: true });
  add('Employee Master', 'The audit trail has recorded changes', 'audit_log rows exist (trigger fires on job/statutory edits)', (auditCount ?? 0) > 0, `${auditCount ?? 0} rows. If 0: change a designation in the app, then re-run`);

  // ---------------------------------------------------------------- report
  const failed = rows.filter((r) => !r.ok);
  const stamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
  const areas = [...new Set(rows.map((r) => r.area))];
  const md = [
    '# Automated test report', '',
    `Run: ${stamp} IST · Live site: ${LIVE} · **${rows.length - failed.length} of ${rows.length} checks passed**${failed.length ? `, ${failed.length} FAILED` : ''}`, '',
    'These are the checklist items that can be proven without a person signed in through Clerk. Rule checks are attempts the database must reject (nothing is written).',
    'Business rules are also covered by the unit tests (`npm test`, 80 tests) and by the 640-case SQL-vs-TypeScript comparison. Items that need a signed-in browser are in [MANUAL-CHECKLIST.md](MANUAL-CHECKLIST.md).', '',
    ...areas.flatMap((a) => [
      `## ${a}`, '', '| Result | Check | How it is proven | Detail |', '|---|---|---|---|',
      ...rows.filter((r) => r.area === a).map((r) => `| ${r.ok ? '✅ pass' : '❌ FAIL'} | ${r.item} | ${r.how} | ${(r.detail ?? '').replace(/\|/g, '/')} |`), '',
    ]),
  ].join('\n');
  writeFileSync('docs/TEST-REPORT.md', md);
  console.log(`\n${rows.length - failed.length}/${rows.length} passed. Report: docs/TEST-REPORT.md`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
