export default function AnalysisChart({ data }) {
  const width = 760;
  const height = 300;
  const padding = { top: 28, right: 24, bottom: 52, left: 42 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(1, ...data.map((item) => item.count));
  const step = data.length > 1 ? plotWidth / (data.length - 1) : plotWidth;

  const points = data.map((item, index) => {
    const x = padding.left + index * step;
    const y = padding.top + plotHeight - (item.count / maxValue) * plotHeight;
    return { ...item, x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return (
    <div className="chart-shell">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="PDFs analisados nos últimos dias">
        <defs>
          <linearGradient id="bioLine" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + plotHeight * ratio;
          const label = Math.round(maxValue * (1 - ratio));
          return (
            <g key={ratio}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="grid-line" />
              <text x={padding.left - 12} y={y + 4} textAnchor="end" className="chart-label">{label}</text>
            </g>
          );
        })}

        {points.map((point) => (
          <g key={point.date}>
            <rect
              x={point.x - 14}
              y={point.y}
              width="28"
              height={padding.top + plotHeight - point.y}
              rx="6"
              className="chart-bar"
            />
            <text x={point.x} y={height - 20} textAnchor="middle" className="chart-label">{point.label}</text>
          </g>
        ))}

        <path d={linePath} className="chart-line" />
        {points.map((point) => (
          <g key={`${point.date}-point`}>
            <circle cx={point.x} cy={point.y} r="5" className="chart-dot" />
            <text x={point.x} y={point.y - 12} textAnchor="middle" className="point-label">{point.count}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
