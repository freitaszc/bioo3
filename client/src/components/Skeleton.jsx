export function SkeletonBlock({ className = "", ...props }) {
  return <span className={`skeleton-block ${className}`.trim()} aria-hidden="true" {...props} />;
}

export function RouteSkeleton() {
  return (
    <main className="route-skeleton" aria-label="Carregando">
      <section className="route-skeleton-card">
        <SkeletonBlock className="skeleton-logo" />
        <div className="route-skeleton-lines">
          <SkeletonBlock className="skeleton-line short" />
          <SkeletonBlock className="skeleton-line" />
          <SkeletonBlock className="skeleton-line medium" />
        </div>
      </section>
    </main>
  );
}

export function ChartSkeleton() {
  return (
    <div className="chart-skeleton" aria-label="Carregando gráfico">
      {Array.from({ length: 7 }, (_, index) => (
        <SkeletonBlock
          className="chart-skeleton-bar"
          key={index}
          style={{ height: `${36 + ((index * 19) % 58)}%` }}
        />
      ))}
    </div>
  );
}

export function VideoListSkeleton({ rows = 6 }) {
  return (
    <div className="video-list" aria-label="Carregando videoaulas">
      {Array.from({ length: rows }, (_, index) => (
        <div className="video-row skeleton-row" key={index}>
          <SkeletonBlock className="skeleton-circle" />
          <SkeletonBlock className="skeleton-line" />
          <SkeletonBlock className="skeleton-pill" />
        </div>
      ))}
    </div>
  );
}

export function VideoPlayerSkeleton() {
  return (
    <div className="video-player-skeleton" aria-label="Carregando aula">
      <SkeletonBlock className="video-player-box" />
      <div className="video-actions">
        <SkeletonBlock className="skeleton-button" />
        <SkeletonBlock className="skeleton-button" />
      </div>
    </div>
  );
}

export function TableSkeleton({ columns = 5, rows = 6 }) {
  return (
    <div className="table-wrap" aria-label="Carregando tabela">
      <table className="control-table skeleton-table">
        <tbody>
          {Array.from({ length: rows }, (_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }, (_, columnIndex) => (
                <td className={columnIndex === 0 ? "center" : ""} key={columnIndex}>
                  <SkeletonBlock className={columnIndex === 0 ? "skeleton-checkbox" : "skeleton-line"} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AgendaSkeleton() {
  return (
    <div className="agenda-grid agenda-skeleton" aria-label="Carregando agenda">
      {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((label) => (
        <div className="agenda-weekday" key={label}>{label}</div>
      ))}
      {Array.from({ length: 42 }, (_, index) => (
        <div className="agenda-day" key={index}>
          <SkeletonBlock className="skeleton-day-number" />
          {index % 3 === 0 && <SkeletonBlock className="skeleton-event" />}
          {index % 5 === 0 && <SkeletonBlock className="skeleton-event short-event" />}
        </div>
      ))}
    </div>
  );
}
