/**
 * Seed script: 2 locations, 4 departments, 20 employees (1 HR Admin, 3 managers), holidays for the current
 * year, leave types, opening balances and policy text. Server-only: uses the service-role key.
 *
 *   npm run seed          (reads .env.local; idempotent upserts, never deletes anything)
 *
 * Test logins: employees get emails derived from SEED_EMAIL_BASE using plus-addressing, e.g.
 *   SEED_EMAIL_BASE=you@gmail.com  ->  you+hr@gmail.com, you+mgr1@gmail.com, you+emp1@gmail.com ...
 * Create those users in Clerk (invite-only) so they link on first sign-in. Without SEED_EMAIL_BASE the
 * emails use @konkancoastal.example and nobody can sign in with them (useful for CI only).
 * Aadhaar/PAN/bank values below are fake and for development only.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');

const db = createClient(url, key, { auth: { persistSession: false } });
const year = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric' }).format(new Date()));

function email(tag: string): string {
  const base = process.env.SEED_EMAIL_BASE;
  if (!base) return `${tag}@konkancoastal.example`;
  const [local, domain] = base.split('@');
  return `${local}+${tag}@${domain}`.toLowerCase();
}

// Untyped on purpose: the seed has no generated DB types. Throws on any Supabase error.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function must(res: { data: any; error: { message: string } | null }, what: string): any {
  if (res.error || res.data === null) throw new Error(`${what}: ${res.error?.message ?? 'no data'}`);
  return res.data;
}

async function main() {
  const locations = must(await db.from('locations').upsert([
    { name: 'Panaji Head Office', city: 'Panaji', state: 'Goa', weekly_off_days: [0, 6] },
    { name: 'Verna Plant', city: 'Verna', state: 'Goa', weekly_off_days: [0] },
  ], { onConflict: 'name' }).select(), 'locations');
  const panaji = locations.find((l: { city: string; id: string }) => l.city === 'Panaji')!.id;
  const verna = locations.find((l: { city: string; id: string }) => l.city === 'Verna')!.id;

  const depts = must(await db.from('departments').upsert(
    ['Human Resources', 'Finance', 'Production', 'Sales'].map((name) => ({ name })), { onConflict: 'name' }).select(), 'departments');
  const dept = (n: string) => depts.find((d: { name: string; id: string }) => d.name === n)!.id;

  // Every row lists every column: a bulk upsert sends missing keys as null, which would break NOT NULL defaults.
  const lt = (o: {
    code: string; name: string; annual_quota: number; accrual_method: string; carry_forward_max?: number;
    half_day_allowed: boolean; requires_certificate_after_days?: number | null; eligible_gender?: string; counts_calendar_days?: boolean;
  }) => ({
    carry_forward_max: 0, requires_certificate_after_days: null, eligible_gender: 'any', counts_calendar_days: false, ...o,
  });
  const types = must(await db.from('leave_types').upsert([
    lt({ code: 'CL', name: 'Casual Leave', annual_quota: 8, accrual_method: 'upfront', half_day_allowed: true }),
    lt({ code: 'SL', name: 'Sick Leave', annual_quota: 7, accrual_method: 'upfront', half_day_allowed: true, requires_certificate_after_days: 2 }),
    lt({ code: 'EL', name: 'Earned Leave', annual_quota: 15, accrual_method: 'monthly', carry_forward_max: 30, half_day_allowed: false }),
    lt({ code: 'ML', name: 'Maternity Leave', annual_quota: 182, accrual_method: 'on_request', half_day_allowed: false, eligible_gender: 'female', counts_calendar_days: true }),
    lt({ code: 'PL', name: 'Paternity Leave', annual_quota: 5, accrual_method: 'on_request', half_day_allowed: false, eligible_gender: 'male', counts_calendar_days: true }),
    lt({ code: 'LOP', name: 'Loss of Pay', annual_quota: 0, accrual_method: 'none', half_day_allowed: true }),
  ], { onConflict: 'code' }).select(), 'leave_types');

  const d = (m: number, day: number) => `${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const nat = (loc: string) => [
    { location_id: loc, date: d(1, 26), name: 'Republic Day', type: 'National' },
    { location_id: loc, date: d(8, 15), name: 'Independence Day', type: 'National' },
    { location_id: loc, date: d(10, 2), name: 'Gandhi Jayanti', type: 'National' },
    { location_id: loc, date: d(5, 1), name: 'May Day', type: 'State' },
    { location_id: loc, date: d(5, 30), name: 'Goa Statehood Day', type: 'State' },
    { location_id: loc, date: d(12, 19), name: 'Goa Liberation Day', type: 'State' },
    { location_id: loc, date: d(11, 9), name: 'Optional: Regional festival A', type: 'Optional' },
    { location_id: loc, date: d(3, 14), name: 'Optional: Regional festival B', type: 'Optional' },
    { location_id: loc, date: d(9, 18), name: 'Optional: Regional festival C', type: 'Optional' },
  ];
  must(await db.from('holidays').upsert(
    [...nat(panaji), ...nat(verna), { location_id: verna, date: d(4, 24), name: 'Verna Plant Foundation Day', type: 'State' }],
    { onConflict: 'location_id,date' }).select(), 'holidays');

  must(await db.from('policy_documents').upsert([
    { slug: 'leave', title: 'Leave policy', body:
`Leave year is January to December. Casual Leave (CL) 8 days, credited on 1 January, pro-rated for joiners, lapses on 31 December, half day allowed.
Sick Leave (SL) 7 days, credited on 1 January, pro-rated for joiners, lapses on 31 December, half day allowed. Sick leave of more than 2 consecutive days needs a medical certificate.
Earned Leave (EL) 15 days a year, accrued 1.25 days per completed month, carry forward up to 30 days, no half day.
Maternity leave follows the Maternity Benefit Act: 26 weeks for the first two children, 12 weeks after that. Paternity leave is 5 days (company policy).
Loss of Pay (LOP) is unlimited and half days are allowed.
Only working days count as leave. Weekly offs and holidays inside a leave period are not counted; there is no sandwich rule.
You cannot apply with insufficient balance; the excess can be converted to LOP. Leave cannot be applied for dates more than 30 days in the past.` },
    { slug: 'attendance', title: 'Attendance policy', body:
`All times are in IST. Head office (Panaji) works Monday to Friday; Saturday and Sunday are weekly offs. The plant (Verna) works Monday to Saturday; Sunday is the weekly off.
Worked 8 hours or more is Present. 4 hours to under 8 hours is a Half Day. Under 4 hours or no punch is Absent.
Check-in after 10:15 AM is Late. Every three Late marks in a calendar month convert into one half day of Loss of Pay.
A day with approved leave is On Leave even if the employee also punched in. Work from home counts as Present.
A missed punch can be corrected by a regularisation request within 30 days, approved by the manager.` },
    { slug: 'holidays', title: 'Holiday policy', body:
`National and State holidays are set per location. Optional holidays are chosen by the employee, up to 2 a year, from the Optional holidays of their own location. An Optional holiday that is not chosen is a normal working day.` },
  ], { onConflict: 'slug' }).select(), 'policy_documents');

  // ---- employees: 1 HR admin, 3 managers, 16 staff
  type E = { tag: string; name: string; gender: 'male' | 'female'; dept: string; loc: string; desig: string; join: string; mgr?: string; hr?: boolean };
  const staff: E[] = [
    { tag: 'hr', name: 'Rohan Kamat', gender: 'male', dept: 'Human Resources', loc: panaji, desig: 'HR Manager', join: '2021-04-05', hr: true },
    { tag: 'mgr1', name: 'Savita Desai', gender: 'female', dept: 'Finance', loc: panaji, desig: 'Finance Manager', join: '2021-06-14', mgr: 'hr' },
    { tag: 'mgr2', name: 'Anand Prabhu', gender: 'male', dept: 'Production', loc: verna, desig: 'Plant Manager', join: '2020-09-01', mgr: 'hr' },
    { tag: 'mgr3', name: 'Neha Shirodkar', gender: 'female', dept: 'Sales', loc: panaji, desig: 'Sales Manager', join: '2022-01-10', mgr: 'hr' },
    ...[
      ['Asha Naik', 'female', 'Finance', panaji, 'Accountant', '2022-03-07', 'mgr1'],
      ['Ravi Dessai', 'male', 'Finance', panaji, 'Accounts Executive', '2023-05-15', 'mgr1'],
      ['Meera Fernandes', 'female', 'Finance', panaji, 'Analyst', '2024-02-01', 'mgr1'],
      ['Sanjay Gaonkar', 'male', 'Production', verna, 'Line Supervisor', '2021-11-22', 'mgr2'],
      ['Prakash Volvoikar', 'male', 'Production', verna, 'Machine Operator', '2022-08-08', 'mgr2'],
      ['Lata Parab', 'female', 'Production', verna, 'Quality Inspector', '2023-01-16', 'mgr2'],
      ['Dinesh Kerkar', 'male', 'Production', verna, 'Packing Operator', '2024-06-03', 'mgr2'],
      ['Fatima Shaikh', 'female', 'Production', verna, 'Packing Operator', '2025-01-20', 'mgr2'],
      ['Joel Pereira', 'male', 'Sales', panaji, 'Sales Executive', '2022-10-10', 'mgr3'],
      ['Tanvi Borkar', 'female', 'Sales', panaji, 'Sales Executive', '2023-07-24', 'mgr3'],
      ['Kunal Sawant', 'male', 'Sales', panaji, 'Territory Manager', '2024-09-09', 'mgr3'],
      ['Divya Mapari', 'female', 'Sales', panaji, 'Sales Coordinator', '2025-04-14', 'mgr3'],
      ['Suresh Naik', 'male', 'Production', verna, 'Maintenance Technician', '2021-03-01', 'mgr2'],
      ['Pooja Kamat', 'female', 'Human Resources', panaji, 'HR Executive', '2023-11-06', 'hr'],
      ['Imran Khan', 'male', 'Finance', panaji, 'Payroll Coordinator', '2026-01-12', 'mgr1'],
      // Joined on 1 July of the current year: used to test pro-rated CL and SL.
      ['Aditi Joshi', 'female', 'Sales', panaji, 'Sales Executive', `${year}-07-01`, 'mgr3'],
    ].map(([name, gender, dp, loc, desig, join, mgr], i): E => ({
      tag: `emp${i + 1}`, name: name as string, gender: gender as 'male' | 'female', dept: dp as string, loc: loc as string,
      desig: desig as string, join: join as string, mgr: mgr as string,
    })),
  ];

  const idByTag = new Map<string, string>();
  for (const [i, s] of staff.entries()) {
    const row = must(await db.from('employees').upsert({
      full_name: s.name, email: email(s.tag), mobile: `98${String(50000000 + i * 7919).padStart(8, '0')}`.slice(0, 10),
      dob: `${1985 + (i % 12)}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
      gender: s.gender, address_line: `${10 + i}, Main Road`, city: s.loc === panaji ? 'Panaji' : 'Verna', state: 'Goa', pin: s.loc === panaji ? '403001' : '403722',
      date_of_joining: s.join, designation: s.desig, department_id: dept(s.dept), location_id: s.loc,
      salary_grade: `G${(i % 5) + 1}`, is_hr_admin: !!s.hr,
      emergency_name: 'Family Contact', emergency_relation: 'Relative', emergency_phone: '9876500000',
    }, { onConflict: 'email', ignoreDuplicates: false }).select().single(), `employee ${s.tag}`);
    idByTag.set(s.tag, row.id);
  }
  for (const s of staff) {
    if (!s.mgr) continue;
    must(await db.from('employees').update({ reporting_manager_id: idByTag.get(s.mgr) }).eq('id', idByTag.get(s.tag)!).select(), `manager ${s.tag}`);
  }

  for (const [i, s] of staff.entries()) {
    const id = idByTag.get(s.tag)!;
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    must(await db.from('employee_statutory').upsert({
      employee_id: id,
      pan: `${letters[i % 26]}${letters[(i + 3) % 26]}${letters[(i + 7) % 26]}PX${String(1000 + i * 37).slice(0, 4)}${letters[(i + 11) % 26]}`,
      aadhaar: String(200000000000 + i * 1234567891).slice(0, 12),
      uan: i % 3 === 0 ? null : String(100000000000 + i * 987654).slice(0, 12),
    }).select(), `statutory ${s.tag}`);
    must(await db.from('employee_bank').upsert({
      employee_id: id, account_number: String(50100000000000 + i * 31337).slice(0, 14), ifsc: 'HDFC0001234', bank_name: 'HDFC Bank',
    }).select(), `bank ${s.tag}`);
    for (const t of types) {
      must(await db.from('leave_balances').upsert(
        { employee_id: id, leave_type_id: t.id, year, opening: t.code === 'EL' && i % 4 === 0 ? 5 : 0, adjustment: 0 },
        { onConflict: 'employee_id,leave_type_id,year' }).select(), `balance ${s.tag}/${t.code}`);
    }
  }
  console.log(`Seeded ${staff.length} employees, ${locations.length} locations, ${depts.length} departments for ${year}.`);
  console.log('HR Admin:', email('hr'), '| Managers:', email('mgr1'), email('mgr2'), email('mgr3'), '| Employee:', email('emp1'));
}

main().catch((e) => { console.error(e); process.exit(1); });
