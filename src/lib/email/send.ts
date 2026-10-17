import 'server-only';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

/**
 * L6: sends queued notifications from email_log. Database functions queue a row when something happens; this sends
 * it. A failed or missing SMTP setup NEVER fails the leave action: the row stays 'pending' or becomes 'failed' and
 * the daily cron retries up to 3 times. Uses the service-role key (allowed here: server-only email module).
 */
const MAX_ATTEMPTS = 3;

function smtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.EMAIL_FROM);
}

function appUrl(): string {
  return process.env.APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export async function flushEmails(): Promise<{ sent: number; failed: number; skipped?: string }> {
  if (!smtpConfigured()) return { sent: 0, failed: 0, skipped: 'SMTP is not configured; emails stay queued' };
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { sent: 0, failed: 0, skipped: 'Supabase service key missing' };

  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: rows } = await db
    .from('email_log')
    .select('id, subject, body, kind, attempts, employees:to_employee_id(email, full_name)')
    .in('status', ['pending', 'failed'])
    .lt('attempts', MAX_ATTEMPTS)
    .order('id')
    .limit(25);
  if (!rows?.length) return { sent: 0, failed: 0 };

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT), secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  let sent = 0;
  let failed = 0;
  for (const r of rows as unknown as { id: string; subject: string; body: string; attempts: number; employees: { email: string; full_name: string } | { email: string; full_name: string }[] | null }[]) {
    const to = Array.isArray(r.employees) ? r.employees[0] : r.employees;
    if (!to?.email) { await db.from('email_log').update({ status: 'failed', attempts: r.attempts + 1 }).eq('id', r.id); failed++; continue; }
    try {
      await transport.sendMail({
        from: process.env.EMAIL_FROM, to: to.email, subject: r.subject,
        text: `Hello ${to.full_name},\n\n${r.body}\n\nOpen Tarang: ${appUrl()}\n`,
        html: `<p>Hello ${escapeHtml(to.full_name)},</p><p>${escapeHtml(r.body).replace(/\n/g, '<br>')}</p><p><a href="${appUrl()}">Open Tarang</a></p>`,
      });
      await db.from('email_log').update({ status: 'sent', attempts: r.attempts + 1, sent_at: new Date().toISOString() }).eq('id', r.id);
      sent++;
    } catch {
      await db.from('email_log').update({ status: 'failed', attempts: r.attempts + 1 }).eq('id', r.id);
      failed++;
    }
  }
  return { sent, failed };
}

/** Fire-and-forget after an action: never throws, never delays the user for long. */
export async function flushEmailsSafely(): Promise<void> {
  try { await flushEmails(); } catch { /* the queue keeps the message; the cron retries */ }
}
