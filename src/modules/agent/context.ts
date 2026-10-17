import type { SupabaseClient } from '@supabase/supabase-js';
import type { Employee } from '@/lib/auth/session';
import type { ISODate } from '@/lib/time/ist';
import type { CallLimiter } from './guardrails';

/**
 * Everything a tool may use. Built on the server for ONE question from the verified session; the model never supplies
 * an employee id, a database client or a role, so it cannot widen its own access.
 */
export interface AgentContext {
  employee: Employee;
  db: SupabaseClient;
  isHr: boolean;
  isManager: boolean;
  today: ISODate;
  questionId: string;
  limiter: CallLimiter;
  /** Records one tool call in agent_log. Returns false if it could not be recorded (the call is then stopped). */
  log: (tool: string, inputs: unknown, result: unknown) => Promise<boolean>;
  /** Saves a draft for the user to confirm. Returns the draft id, or null on failure. */
  saveDraft: (kind: 'leave_request' | 'reminder_email', payload: object) => Promise<string | null>;
}

export interface DraftCard {
  id: string;
  kind: 'leave_request' | 'reminder_email';
  title: string;
  lines: string[];
  confirmLabel: string;
}

export interface ToolTrace { name: string; summary: string }

export interface AgentReply {
  answer: string;
  tools: ToolTrace[];
  drafts: DraftCard[];
  unverified: boolean;
}
