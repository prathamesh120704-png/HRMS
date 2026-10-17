import type { ISODate } from '@/lib/time/ist';

export interface LeaveSpan { employeeId: string; name: string; from: ISODate; to: ISODate }

/**
 * Who else on the same team is already away during this request (L7 clash warning for approvers).
 * Date ranges are inclusive and a person never clashes with themselves.
 */
export function clashes(request: { employeeId: string; from: ISODate; to: ISODate }, teamLeave: LeaveSpan[]): string[] {
  const names = new Set<string>();
  for (const o of teamLeave) {
    if (o.employeeId === request.employeeId) continue;
    if (o.from <= request.to && request.from <= o.to) names.add(o.name);
  }
  return [...names].sort();
}
