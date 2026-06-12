import jwt from "jsonwebtoken";
import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const videoRoutes = Router();

function createMuxToken(playbackId) {
  const signingKey = process.env.MUX_SIGNING_KEY;
  const privateKey = process.env.MUX_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!signingKey || !privateKey) {
    return null;
  }

  return jwt.sign(
    {
      aud: "v",
      sub: playbackId,
      kid: signingKey,
      exp: Math.floor(Date.now() / 1000) + 60 * 60
    },
    privateKey,
    { algorithm: "RS256" }
  );
}

function serializeVideo(video) {
  const token = createMuxToken(video.playbackId);
  const query = token ? `?token=${encodeURIComponent(token)}` : "";

  return {
    id: video.id,
    title: video.title,
    playbackId: video.playbackId,
    pdf: video.pdf,
    streamUrl: `https://stream.mux.com/${video.playbackId}.m3u8${query}`,
    posterUrl: `https://image.mux.com/${video.playbackId}/thumbnail.jpg${query}`
  };
}

videoRoutes.use(requireAuth);

videoRoutes.get("/", async (_req, res, next) => {
  try {
    const videos = await prisma.video.findMany({ orderBy: [{ order: "asc" }, { id: "asc" }] });
    return res.json({ videos: videos.map(serializeVideo) });
  } catch (error) {
    next(error);
  }
});

videoRoutes.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Vídeo inválido." });
    }

    const video = await prisma.video.findUnique({ where: { id } });
    if (!video) {
      return res.status(404).json({ error: "Vídeo não encontrado." });
    }

    return res.json({ video: serializeVideo(video) });
  } catch (error) {
    next(error);
  }
});

