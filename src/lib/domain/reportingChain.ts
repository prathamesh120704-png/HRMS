/**
 * An employee cannot report to themselves or to anyone who (directly or indirectly) reports to them (E4).
 * `managerOf` maps employee id -> manager id.
 */
export function wouldCreateLoop(
  employeeId: string,
  newManagerId: string | null,
  managerOf: Map<string, string | null>,
): boolean {
  if (!newManagerId) return false;
  const seen = new Set<string>();
  let cur: string | null | undefined = newManagerId;
  while (cur) {
    if (cur === employeeId) return true;
    if (seen.has(cur)) return true; // existing cycle: refuse
    seen.add(cur);
    cur = managerOf.get(cur);
  }
  return false;
}
