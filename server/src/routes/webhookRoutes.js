import { Router } from "express";
import { applyWhatsAppWebhook, verifyWebhookSignature } from "../services/whatsapp.js";

export const webhookRoutes = Router();

webhookRoutes.get("/whatsapp", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token && token === process.env.META_WEBHOOK_VERIFY_TOKEN) return res.status(200).send(challenge);
  return res.status(403).send("Webhook verification failed.");
});

webhookRoutes.post("/whatsapp", async (req, res, next) => {
  try {
    if (!verifyWebhookSignature(req.rawBody, req.get("x-hub-signature-256"))) {
      return res.status(401).json({ error: "Assinatura de webhook inválida." });
    }
    await applyWhatsAppWebhook(req.body);
    return res.sendStatus(200);
  } catch (error) {
    next(error);
  }
});
