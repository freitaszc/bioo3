import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { VideoListSkeleton } from "../components/Skeleton";

export default function VideosPage() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.videos()
      .then((data) => setVideos(data.videos || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="app-frame">
      <main className="page-shell">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Videoaulas</p>
            <h1>Biblioteca de aulas</h1>
            <p className="page-subtitle">Conteúdo importado para ensino.</p>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Aulas disponíveis</h2>
              <p>Selecione uma aula para assistir e acessar materiais complementares.</p>
            </div>
          </div>

          {loading && <VideoListSkeleton />}
          {error && <p className="form-error">{error}</p>}
          {!loading && !error && (
            <div className="video-list">
              {videos.map((video) => (
                <Link className="video-row" key={video.id} to={`/videoaulas/${video.id}`}>
                  <span className="play-dot">▶</span>
                  <span className="video-row-title">{video.title}</span>
                  {video.pdf && <span className="status-pill active">PDF</span>}
                </Link>
              ))}
              {!videos.length && <div className="empty-state">Nenhuma videoaula cadastrada.</div>}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
