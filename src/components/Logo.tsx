export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="logo">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#0F766E" />
        <path d="M5 17c3-5 6-5 9 0s6 5 9 0M5 23c3-5 6-5 9 0s6 5 9 0" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      Tarang
    </span>
  );
}
