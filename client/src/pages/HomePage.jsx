import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import AnalysisChart from "../components/AnalysisChart";
import { ChartSkeleton, SkeletonBlock } from "../components/Skeleton";
import Topbar from "../components/Topbar";

export default function HomePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ days: [], total: 0 });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.dashboardCounts(7)
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const displayName = [user?.firstName, user?.secondName].filter(Boolean).join(" ") || user?.username;
  const average = stats.days.length ? (stats.total / stats.days.length).toFixed(1) : "0.0";
  const remainingAnalyses = stats.remainingAnalyses ?? 0;

  return (
    <div className="app-frame">
      <Topbar />
      <main className="page-shell">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Início</p>
            <h1>Bem-vindo(a), {displayName}</h1>
            <p className="page-subtitle">Visão operacional das análises recentes do BioO3.</p>
          </div>
        </section>

        <section className="metric-grid">
          <article className="summary-card gradient-card">
            <p>Total no período</p>
            <div>
              <strong>{loading ? <SkeletonBlock className="metric-skeleton" /> : stats.total}</strong>
              <span>últimos 7 dias</span>
            </div>
          </article>
          <article className="summary-card">
            <p>Média diária</p>
            <div>
              <strong>{loading ? <SkeletonBlock className="metric-skeleton" /> : average}</strong>
              <span>análises/dia</span>
            </div>
          </article>
          <article className="summary-card">
            <p>Análises restantes</p>
            <div>
              <strong>{loading ? <SkeletonBlock className="metric-skeleton" /> : remainingAnalyses}</strong>
            </div>
          </article>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>PDFs analisados nos últimos 7 dias</h2>
              <p>Controle rápido do volume de análises concluídas.</p>
            </div>
          </div>
          {loading && <ChartSkeleton />}
          {error && <div className="form-error">{error}</div>}
          {!loading && !error && <AnalysisChart data={stats.days} />}
        </section>
      </main>
    </div>
  );
}
