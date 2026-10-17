import 'server-only';
import { randomUUID } from 'node:crypto';
import { generateText, isStepCount, type ModelMessage } from 'ai';
import { google } from '@ai-sdk/google';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Employee } from '@/lib/auth/session';
import { dayOfWeek, type ISODate } from '@/lib/time/ist';
import type { AgentContext, AgentReply } from './context';
import { CallLimiter, isUnverifiedNumbers, systemPrompt, UNVERIFIED_NOTE } from './guardrails';
import { buildTools, type AgentRun } from './tools';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MAX_TOOL_CALLS = 5;
export const MAX_HISTORY = 8;
export const MAX_MESSAGE_CHARS = 1000;

export interface ChatMessage { role: 'user' | 'assistant'; content: string }

/** Test hooks only. The live app always uses the defaults below, which act as the signed-in user's own session. */
export interface AgentIo {
  log?: AgentContext['log'];
  saveDraft?: AgentContext['saveDraft'];
}

/**
 * One question to the HR assistant. The model gets only: the system prompt, the (capped) chat text, and the tools
 * allowed for this user's role. It never gets a database client, a key, or any other employee's id.
 * `generateText` runs the tool loop; stopWhen is a second safety net behind the 5-call counter in the tool wrapper.
 */
export async function runAgent(args: {
  employee: Employee; db: SupabaseClient; isHr: boolean; isManager: boolean; today: ISODate; location: string; history: ChatMessage[]; io?: AgentIo;
}): Promise<AgentReply> {
  const questionId = randomUUID();
  const ctx: AgentContext = {
    employee: args.employee, db: args.db, isHr: args.isHr, isManager: args.isManager, today: args.today,
    questionId, limiter: new CallLimiter(MAX_TOOL_CALLS),
    // Defaults call role-checking database functions with the user's own token (rule 9: no direct writes).
    log: args.io?.log ?? (async (tool, inputs, result) => {
      const { error } = await args.db.rpc('log_agent_call', { p_question: questionId, p_tool: tool, p_inputs: inputs as object, p_result: result as object });
      return !error;
    }),
    saveDraft: args.io?.saveDraft ?? (async (kind, payload) => {
      const { data, error } = await args.db.rpc('create_agent_draft', { p_kind: kind, p_payload: payload });
      return error || !data ? null : String(data);
    }),
  };
  const run: AgentRun = { traces: [], drafts: [] };

  const messages: ModelMessage[] = args.history.slice(-MAX_HISTORY).map((m) => ({
    role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS),
  }));
  const role = args.isHr ? 'HR Admin' : args.isManager ? 'Manager' : 'Employee';

  try {
    const result = await generateText({
      model: google(process.env.AI_MODEL ?? 'gemini-2.5-flash'),
      system: systemPrompt({ name: args.employee.full_name, role, location: args.location, today: args.today, weekday: DAY_NAMES[dayOfWeek(args.today)] }),
      messages,
      tools: buildTools(ctx, run),
      stopWhen: isStepCount(MAX_TOOL_CALLS + 2),
      temperature: 0,
    });
    let answer = result.text.trim() || 'I could not work out an answer. Please rephrase, or ask HR.';
    const unverified = isUnverifiedNumbers(answer, ctx.limiter.count);
    if (unverified) answer = `${answer}\n\n${UNVERIFIED_NOTE}`;
    return { answer, tools: run.traces, drafts: run.drafts, unverified };
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    const busy = /quota|rate|429|exhausted|limit/i.test(msg);
    return {
      answer: busy
        ? 'The assistant is busy right now (the free AI quota may be used up). Please try again in a minute, or use the Leave screens.'
        : 'Sorry, the assistant ran into a problem. Please try again, or use the Leave screens.',
      tools: run.traces, drafts: run.drafts, unverified: false,
    };
  }
}
