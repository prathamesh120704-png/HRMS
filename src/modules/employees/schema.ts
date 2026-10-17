import { z } from 'zod';
import {
  aadhaarSchema, ifscSchema, isAtLeast18OnJoining, mobileSchema, panSchema, pinSchema, stateSchema, uanSchema,
} from '@/lib/validation/indian';

const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const text = (msg: string) => z.string({ message: msg }).trim().min(1, msg);
const optText = z.preprocess(blankToUndefined, z.string().trim().optional());
const isoDate = (msg: string) => z.string({ message: msg }).regex(/^\d{4}-\d{2}-\d{2}$/, msg);
const uuid = (msg: string) => z.string({ message: msg }).uuid(msg);
const account = z.preprocess(
  (v) => (typeof v === 'string' ? v.replace(/[\s-]/g, '') : v),
  z.string().regex(/^[0-9]{6,20}$/, 'Account number must be 6 to 20 digits.'),
);

export type ActionState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
  revealed?: string;
};

/** Collapse zod issues to one message per top-level field. */
export function toErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = String(i.path[0] ?? '_');
    if (!(k in out)) out[k] = i.message;
  }
  return out;
}

/** Form values safe to echo back to the browser. Aadhaar is never echoed. */
export function echoValues(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === 'string' && k !== 'aadhaar' && !k.startsWith('$')) out[k] = v;
  return out;
}

export function formToObject(fd: FormData): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) if (typeof v === 'string' && !k.startsWith('$')) o[k] = v;
  o.is_hr_admin = fd.get('is_hr_admin') === 'on';
  return o;
}

const personal = {
  full_name: text('Enter the full name.').min(2, 'Enter the full name.'),
  email: z.string({ message: 'Enter the work email.' }).trim().toLowerCase().email('Enter a valid email address.'),
  mobile: mobileSchema,
  dob: isoDate('Enter the date of birth.'),
  gender: z.enum(['female', 'male', 'other'], { message: 'Select a gender.' }),
  address_line: optText,
  city: optText,
  state: stateSchema,
  pin: pinSchema,
  emergency_name: optText,
  emergency_relation: optText,
  emergency_phone: z.preprocess(blankToUndefined, mobileSchema.optional()),
};

const job = {
  date_of_joining: isoDate('Enter the date of joining.'),
  designation: text('Enter the designation.'),
  department_id: uuid('Select a department.'),
  location_id: uuid('Select a location.'),
  reporting_manager_id: z.preprocess(blankToUndefined, z.string().uuid().optional()),
  salary_grade: optText,
  is_hr_admin: z.boolean(),
};

const statutory = {
  pan: panSchema,
  aadhaar: aadhaarSchema,
  uan: z.preprocess(blankToUndefined, uanSchema.optional()),
};

const bank = {
  account_number: account,
  ifsc: ifscSchema,
  bank_name: text('Enter the bank name.'),
};

export const employeeCreateSchema = z.object({ ...personal, ...job, ...statutory, ...bank }).superRefine((v, ctx) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v.dob) && /^\d{4}-\d{2}-\d{2}$/.test(v.date_of_joining)
      && !isAtLeast18OnJoining(v.dob, v.date_of_joining)) {
    ctx.addIssue({
      code: 'custom', path: ['dob'],
      message: `The employee must be at least 18 on the date of joining (${v.date_of_joining}).`,
    });
  }
});

/** HR edit: job fields plus optional replacement of statutory/bank values (blank = keep current). */
export const employeeUpdateSchema = z.object({
  full_name: personal.full_name,
  designation: job.designation,
  department_id: job.department_id,
  location_id: job.location_id,
  reporting_manager_id: job.reporting_manager_id,
  salary_grade: job.salary_grade,
  is_hr_admin: job.is_hr_admin,
  pan: z.preprocess(blankToUndefined, panSchema.optional()),
  aadhaar: z.preprocess(blankToUndefined, aadhaarSchema.optional()),
  uan: z.preprocess(blankToUndefined, uanSchema.optional()),
  account_number: z.preprocess(blankToUndefined, account.optional()),
  ifsc: z.preprocess(blankToUndefined, ifscSchema.optional()),
  bank_name: optText,
});

/** Self-service: contact details only (E5). */
export const contactSchema = z.object({
  mobile: personal.mobile,
  address_line: personal.address_line,
  city: personal.city,
  state: z.preprocess(blankToUndefined, stateSchema.optional()),
  pin: z.preprocess(blankToUndefined, pinSchema.optional()),
  emergency_name: personal.emergency_name,
  emergency_relation: personal.emergency_relation,
  emergency_phone: personal.emergency_phone,
});

export const deactivateSchema = z.object({
  employee_id: uuid('Missing employee.'),
  last_working_day: isoDate('Enter the last working day.'),
});
