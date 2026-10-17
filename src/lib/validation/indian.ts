import { z } from 'zod';

export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const AADHAAR_RE = /^[0-9]{12}$/;
export const UAN_RE = /^[0-9]{12}$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const MOBILE_RE = /^[6-9][0-9]{9}$/;
export const PIN_RE = /^[0-9]{6}$/;

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
] as const;

/**
 * True when dob + 18 years <= joining date (both 'YYYY-MM-DD').
 * Matches the database check `date_of_joining >= (dob + interval '18 years')::date`, under which a
 * 29 Feb birthday turns 18 on 28 Feb of a non-leap year.
 */
export function isAtLeast18OnJoining(dob: string, joining: string): boolean {
  const [y, m, d] = dob.split('-').map(Number);
  const leap = (yr: number) => (yr % 4 === 0 && yr % 100 !== 0) || yr % 400 === 0;
  const day = m === 2 && d === 29 && !leap(y + 18) ? 28 : d;
  const eighteenth = `${y + 18}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return eighteenth <= joining;
}

const upper = (s: unknown) => (typeof s === 'string' ? s.trim().toUpperCase() : s);
const digits = (s: unknown) => (typeof s === 'string' ? s.replace(/[\s-]/g, '') : s);

export const panSchema = z.preprocess(upper, z.string().regex(PAN_RE, 'PAN must be 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F).'));
export const aadhaarSchema = z.preprocess(digits, z.string().regex(AADHAAR_RE, 'Aadhaar must be exactly 12 digits.'));
export const uanSchema = z.preprocess(digits, z.string().regex(UAN_RE, 'UAN must be exactly 12 digits.'));
export const ifscSchema = z.preprocess(upper, z.string().regex(IFSC_RE, 'IFSC must be 4 letters, then 0, then 6 letters or digits (e.g. HDFC0001234).'));
export const mobileSchema = z.preprocess(digits, z.string().regex(MOBILE_RE, 'Enter 10 digits starting with 6, 7, 8 or 9.'));
export const pinSchema = z.preprocess(digits, z.string().regex(PIN_RE, 'PIN code must be exactly 6 digits.'));
export const stateSchema = z.enum(INDIAN_STATES, { message: 'Pick a state or union territory from the list.' });
