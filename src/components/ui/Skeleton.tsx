/** Placeholder shapes shown while a page loads (DESIGN.md section 4). Decorative: the wrapper announces "loading". */
export function Skeleton({ h = 16, w = '100%', r }: { h?: number; w?: number | string; r?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} />;
}

export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="skip" style={{ position: 'absolute', left: -999 }}>Loading…</span>
      <div style={{ marginBottom: 20 }}>
        <Skeleton h={28} w={220} />
        <div style={{ height: 8 }} />
        <Skeleton h={14} w={320} />
      </div>
      <div className="grid g2">
        {[0, 1].map((i) => (
          <div key={i} className="card" style={{ minHeight: 150 }}>
            <Skeleton h={16} w={110} />
            <div style={{ height: 16 }} />
            <Skeleton h={40} w="70%" />
            <div style={{ height: 12 }} />
            <Skeleton h={14} w="45%" />
          </div>
        ))}
      </div>
      <div className="card">
        <Skeleton h={16} w={140} />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ marginTop: 16 }}><Skeleton h={18} w={`${95 - i * 9}%`} /></div>
        ))}
      </div>
    </div>
  );
}
