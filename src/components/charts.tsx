/** Small, dependency-free charts. One series each, labelled axes, values readable by screen readers. */

export function Bars({ data, label, color = "#d9a93c", height = 170 }: { data: Array<{ label: string; value: number }>; label: string; color?: string; height?: number }) {
  const W = 640;
  const pad = { l: 34, r: 6, t: 8, b: 26 };
  const max = Math.max(4, ...data.map((d) => d.value));
  const top = max <= 10 ? Math.ceil(max / 2) * 2 : Math.ceil(max / 5) * 5;
  const bw = (W - pad.l - pad.r) / Math.max(1, data.length);
  const y = (v: number) => pad.t + (height - pad.t - pad.b) * (1 - v / top);
  const every = data.length > 16 ? Math.ceil(data.length / 8) : 1;

  return (
    <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={`${label}: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`} className="w-full">
      {[0, top / 2, top].map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e9e1d0" strokeDasharray={t === 0 ? undefined : "3 3"} />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#78716c">{Math.round(t)}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const x = pad.l + i * bw + bw * 0.15;
        return (
          <g key={d.label + i}>
            <rect x={x} y={y(d.value)} width={bw * 0.7} height={Math.max(0, y(0) - y(d.value))} rx={3} fill={color}>
              <title>{`${d.label}: ${d.value}`}</title>
            </rect>
            {i % every === 0 && <text x={x + bw * 0.35} y={height - 8} textAnchor="middle" fontSize="11" fill="#78716c">{d.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}

/** Horizontal funnel: each step as a share of the first, with the drop from the previous step. */
export function Funnel({ steps }: { steps: Array<{ label: string; count: number }> }) {
  const first = Math.max(1, steps[0]?.count ?? 0);
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1]!.count : null;
        const kept = prev && prev > 0 ? Math.round((s.count / prev) * 100) : null;
        return (
          <li key={s.label}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-stone-700">{s.label}</span>
              <span className="tabular-nums"><strong>{s.count}</strong>{kept !== null && <span className="ml-2 text-xs text-stone-500">{kept}% continued</span>}</span>
            </div>
            <div className="mt-1 h-2.5 rounded-full bg-stone-100"><div className="h-full rounded-full bg-gold-400" style={{ width: `${Math.max(2, (s.count / first) * 100)}%` }} /></div>
          </li>
        );
      })}
    </ol>
  );
}
