/** The ONLY place status colours are defined (DESIGN.md section 3.3). Used by badges, calendars and lists. */
export type StatusKey = 'Present' | 'Half Day' | 'Absent' | 'On Leave' | 'Holiday' | 'Weekly Off' | 'Late';

export const STATUS_STYLES: Record<StatusKey, { bg: string; fg: string; icon: string; code: string }> = {
  Present: { bg: '#DCFCE7', fg: '#14532D', icon: '✓', code: 'P' },
  'Half Day': { bg: '#FEF3C7', fg: '#78350F', icon: '½', code: 'H' },
  Absent: { bg: '#FEE2E2', fg: '#7F1D1D', icon: '✕', code: 'A' },
  'On Leave': { bg: '#DBEAFE', fg: '#1E3A8A', icon: '✈', code: 'L' },
  Holiday: { bg: '#EDE9FE', fg: '#4C1D95', icon: '★', code: 'HD' },
  'Weekly Off': { bg: '#E5E7EB', fg: '#1F2937', icon: '–', code: 'WO' },
  Late: { bg: '#FFEDD5', fg: '#7C2D12', icon: '⏰', code: 'Late' },
};
