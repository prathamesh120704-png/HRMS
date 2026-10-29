/** Small inline icon set (24x24, stroke). Decorative: the visible label next to each icon carries the meaning. */
export type IconName =
  | 'home' | 'clock' | 'calendar' | 'edit' | 'chat' | 'user' | 'inbox' | 'users' | 'calendar-days' | 'chart' | 'id' | 'settings' | 'check' | 'alert' | 'info' | 'inbox-empty';

const PATHS: Record<IconName, React.ReactNode> = {
  home: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /><path d="M10 19.5v-5h4v5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.2 2" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  edit: <><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></>,
  chat: <><path d="M4 5.5h16v10.5H9.5L5 19.5V16H4V5.5Z" /><path d="M8 9.5h8M8 12.5h5" /></>,
  user: <><circle cx="12" cy="8.5" r="3.7" /><path d="M4.5 20c.9-4 4-6 7.5-6s6.6 2 7.5 6" /></>,
  inbox: <><path d="M4 13.5 6.2 5.5h11.6L20 13.5" /><path d="M4 13.5V19h16v-5.5h-5l-1.2 2h-3.6l-1.2-2H4Z" /></>,
  users: <><circle cx="9" cy="8.5" r="3.3" /><path d="M2.8 19.5c.7-3.4 3.2-5 6.2-5s5.5 1.6 6.2 5" /><path d="M16 5.5a3.3 3.3 0 0 1 0 6.2M18 14.8c1.7.6 2.9 2 3.3 4.7" /></>,
  'calendar-days': <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" /></>,
  id: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2.2" /><path d="M5.8 16c.5-1.7 1.7-2.4 3.2-2.4s2.7.7 3.2 2.4M14.5 10h4M14.5 13.5h3" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12.3 2.8 2.8L16.2 9.5" /></>,
  alert: <><path d="M12 3.5 21.5 19.5h-19L12 3.5Z" /><path d="M12 10v4.2M12 17h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  'inbox-empty': <><path d="M3.5 13.5 6 5.5h12l2.5 8" /><path d="M3.5 13.5V19h17v-5.5h-5.2l-1.3 2h-3l-1.3-2H3.5Z" /></>,
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
