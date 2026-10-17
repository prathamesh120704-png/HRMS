export interface PolicyDoc { slug: string; title: string; body: string }

const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'of', 'to', 'for', 'and', 'or', 'in', 'on', 'my', 'me', 'i', 'do', 'does', 'how', 'what', 'many', 'much', 'can', 'will', 'about', 'with', 'if', 'be', 'it', 'at', 'by', 'kya', 'hai', 'ka', 'ki', 'ke', 'mujhe', 'kitni', 'kitna']);
const SYNONYMS: Record<string, string[]> = {
  casual: ['cl'], cl: ['casual'], sick: ['sl'], sl: ['sick'], earned: ['el'], el: ['earned'], privilege: ['earned'],
  maternity: ['ml'], paternity: ['pl'], late: ['10:15'], lop: ['loss'], wfh: ['work', 'home'],
};

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9:.\s]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w));

export interface PolicyHit { source: string; text: string }

/**
 * explain_policy: answers come ONLY from the stored policy text. Each line of each policy is scored by how many of
 * the question's words (and a few synonyms like CL/casual) it contains. Nothing matching means `found: false` and the
 * agent must say it does not know (guardrail), never guess.
 */
export function searchPolicy(docs: PolicyDoc[], query: string, limit = 3): PolicyHit[] {
  const q = [...new Set(words(query).flatMap((w) => [w, ...(SYNONYMS[w] ?? [])]))];
  if (q.length === 0) return [];
  const scored: (PolicyHit & { score: number })[] = [];
  for (const d of docs) {
    for (const line of d.body.split('\n').map((l) => l.trim()).filter(Boolean)) {
      const lw = new Set(words(line));
      const text = line.toLowerCase();
      let score = 0;
      for (const w of q) if (lw.has(w) || (w.length > 3 && text.includes(w))) score += 1;
      // A single shared word is too weak to answer from: demand at least two distinct matches, or one very specific one.
      if (score >= 2 || (score === 1 && q.length === 1)) scored.push({ source: d.title, text: line, score });
    }
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map(({ source, text }) => ({ source, text }));
}
