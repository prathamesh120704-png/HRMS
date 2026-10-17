'use client';
import { useRef, useState, useTransition } from 'react';
import type { AgentReply, DraftCard, ToolTrace } from './context';
import { confirmDraftAction, discardDraftAction, type DraftResult } from './actions';

interface Msg { role: 'user' | 'assistant'; content: string; tools?: ToolTrace[]; drafts?: DraftCard[]; unverified?: boolean }

const EXAMPLES = [
  'Kitni CL bachi hai?',
  'How many days if I take Friday to Monday?',
  'Can I carry forward earned leave?',
  'Kal ki chutti chahiye, kitni CL bachi hai?',
];

/** Chat panel (DESIGN.md 2.11): answers, the tools called under each answer, and Confirm buttons for drafts. */
export function AskHr({ isManager, isHr }: { isManager: boolean; isHr: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  async function send(q: string) {
    const content = q.trim();
    if (!content || busy) return;
    setErr('');
    const next: Msg[] = [...msgs, { role: 'user', content }];
    setMsgs(next);
    setText('');
    setBusy(true);
    try {
      // Only role and text are sent. Tool traces and drafts stay on the server's side of trust.
      const res = await fetch('/api/agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.map(({ role, content: c }) => ({ role, content: c })).slice(-8) }),
      });
      const json = await res.json();
      if (!res.ok) { setErr(json.error ?? 'Something went wrong.'); return; }
      const r = json as AgentReply;
      setMsgs([...next, { role: 'assistant', content: r.answer, tools: r.tools, drafts: r.drafts, unverified: r.unverified }]);
    } catch {
      setErr('Could not reach the assistant. Check your connection and try again.');
    } finally {
      setBusy(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }

  const examples = [...EXAMPLES, ...(isManager || isHr ? ['Who is absent today?', 'Any pending approvals?'] : []), ...(isHr ? ['Run the month-end check'] : [])];

  return (
    <div className="chat-wrap">
      <div className="chat-log" role="log" aria-live="polite" aria-label="Conversation">
        {msgs.length === 0 && (
          <div className="empty">
            <p><strong>Ask me about your leave, holidays or policy.</strong></p>
            <p className="hint">I check the real system before I answer, and I can prepare a leave request for you to confirm. English, Hindi and Hinglish all work.</p>
            <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
              {examples.map((e) => <button key={e} type="button" className="btn btn-secondary btn-sm" onClick={() => send(e)}>{e}</button>)}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role === 'user' ? 'me' : 'bot'}`}>
            <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
            {m.unverified && <div className="hint" style={{ color: '#78350F', marginTop: 4 }}>⚠ Not checked by a tool</div>}
            {m.tools && m.tools.length > 0 && (
              <div className="hint" style={{ marginTop: 6 }}>Tools used: {m.tools.map((t) => `${t.name} (${t.summary})`).join(', ')}</div>
            )}
            {m.drafts?.map((d) => <Draft key={d.id} d={d} />)}
          </div>
        ))}
        {busy && <div className="msg bot hint" aria-busy="true">Checking the system…</div>}
        <div ref={endRef} />
      </div>
      {err && <div className="alert alert-bad" role="alert">{err}</div>}
      <form onSubmit={(e) => { e.preventDefault(); void send(text); }} className="row" style={{ marginTop: 12, flexWrap: 'nowrap' }}>
        <label htmlFor="ask" className="skip">Your question</label>
        <input id="ask" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" maxLength={1000}
          style={{ flex: 1, minHeight: 44, padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 8 }} autoComplete="off" />
        <button className="btn" disabled={busy || !text.trim()}>Send</button>
      </form>
    </div>
  );
}

/** Confirm and Discard are real buttons the person clicks. The model has no way to press them. */
function Draft({ d }: { d: DraftCard }) {
  const [result, setResult] = useState<DraftResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="card" style={{ marginTop: 8, padding: 12 }}>
      <strong>{d.title}</strong>
      <ul style={{ margin: '6px 0', paddingLeft: 18 }}>{d.lines.map((l) => <li key={l}>{l}</li>)}</ul>
      {result ? (
        <div className={`alert ${result.ok ? 'alert-ok' : 'alert-bad'}`} role="status" style={{ margin: 0 }}>{result.message}</div>
      ) : (
        <div className="row">
          <button className="btn btn-sm" disabled={pending} onClick={() => start(async () => setResult(await confirmDraftAction(d.id)))}>{pending ? 'Working…' : d.confirmLabel}</button>
          <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => start(async () => setResult(await discardDraftAction(d.id)))}>Discard</button>
        </div>
      )}
    </div>
  );
}
