import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { VideoPlayerSkeleton } from "../components/Skeleton";
import Topbar from "../components/Topbar";

function loadHlsScript() {
  if (window.Hls) return Promise.resolve(window.Hls);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-hls]");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Hls), { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
    script.async = true;
    script.dataset.hls = "true";
    script.onload = () => resolve(window.Hls);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function VideoPage() {
  const { id } = useParams();
  const videoRef = useRef(null);
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.video(id)
      .then((data) => setVideo(data.video))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!video?.streamUrl || !videoRef.current) return;
    let hls;
    const element = videoRef.current;

    if (element.canPlayType("application/vnd.apple.mpegurl")) {
      element.src = video.streamUrl;
      return;
    }

    loadHlsScript()
      .then((Hls) => {
        if (!Hls?.isSupported()) return;
        hls = new Hls();
        hls.loadSource(video.streamUrl);
        hls.attachMedia(element);
      })
      .catch(() => setError("Não foi possível carregar o player de vídeo."));

    return () => {
      if (hls) hls.destroy();
    };
  }, [video]);

  return (
    <div className="app-frame">
      <Topbar />
      <main className="page-shell">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Videoaulas</p>
            <h1>{video?.title || "Aula"}</h1>
            <p className="page-subtitle">Player Mux integrado ao painel BioO3.</p>
          </div>
        </section>

        <section className="panel">
          {loading && <VideoPlayerSkeleton />}
          {error && <p className="form-error">{error}</p>}
          {video && (
            <>
              <video className="lesson-player" ref={videoRef} controls poster={video.posterUrl || ""} />
              <div className="video-actions">
                {video.pdf && (
                  <a className="secondary-button" href={`/assets/pdfs/${video.pdf}`} target="_blank" rel="noreferrer">
                    Baixar PDF
                  </a>
                )}
                <Link className="secondary-button" to="/videoaulas">Voltar</Link>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
