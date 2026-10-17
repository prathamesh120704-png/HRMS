export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading report">
      <div className="page-head">
        <div><h1>Month-end summary</h1><p className="sub">Loading…</p></div>
      </div>
      <div className="card">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{ height: 20, background: '#E5E7EB', borderRadius: 6, margin: '12px 0', width: `${90 - i * 8}%` }} />
        ))}
      </div>
    </div>
  );
}
