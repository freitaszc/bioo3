import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "../prisma.js";
import { getObjectBuffer } from "./objectStorage.js";

const CONNECTION_ID = 1;

function encryptionKey() {
  const secret = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY || "";
  if (secret.length < 32) throw new Error("WHATSAPP_TOKEN_ENCRYPTION_KEY deve ter pelo menos 32 caracteres.");
  return createHash("sha256").update(secret).digest();
}

export function encryptToken(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptToken(value) {
  const [iv, tag, encrypted] = String(value || "").split(".");
  if (!iv || !tag || !encrypted) throw new Error("Token do WhatsApp inválido.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}

function graphUrl(path) {
  return `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v23.0"}/${path.replace(/^\//, "")}`;
}

async function graphJson(path, options = {}) {
  const response = await fetch(graphUrl(path), options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || "Falha na comunicação com a Meta.");
  return payload;
}

export function publicConnection(connection) {
  return {
    status: connection?.status || "DISCONNECTED",
    businessAccountId: connection?.businessAccountId || "",
    phoneNumberId: connection?.phoneNumberId || "",
    displayPhone: connection?.displayPhone || "",
    connectedAt: connection?.connectedAt || null,
    appId: process.env.META_APP_ID || "",
    configurationId: process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || "",
    graphVersion: process.env.META_GRAPH_VERSION || "v23.0"
  };
}

export async function getWhatsAppConnection() {
  return prisma.whatsAppConnection.findUnique({ where: { id: CONNECTION_ID } });
}

export async function connectWhatsApp({ code, businessAccountId, phoneNumberId, displayPhone }) {
  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    const error = new Error("META_APP_ID e META_APP_SECRET não estão configurados.");
    error.statusCode = 503;
    throw error;
  }
  if (!code || !/^\d+$/.test(String(businessAccountId)) || !/^\d+$/.test(String(phoneNumberId))) {
    const error = new Error("Dados de conexão retornados pela Meta são inválidos.");
    error.statusCode = 400;
    throw error;
  }
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID,
    client_secret: process.env.META_APP_SECRET,
    code
  });
  const token = await graphJson(`oauth/access_token?${params.toString()}`);
  await graphJson(`${businessAccountId}/subscribed_apps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token.access_token}` }
  });
  const connection = await prisma.whatsAppConnection.upsert({
    where: { id: CONNECTION_ID },
    update: {
      status: "CONNECTED",
      businessAccountId: String(businessAccountId),
      phoneNumberId: String(phoneNumberId),
      displayPhone: String(displayPhone || ""),
      encryptedAccessToken: encryptToken(token.access_token),
      connectedAt: new Date()
    },
    create: {
      id: CONNECTION_ID,
      status: "CONNECTED",
      businessAccountId: String(businessAccountId),
      phoneNumberId: String(phoneNumberId),
      displayPhone: String(displayPhone || ""),
      encryptedAccessToken: encryptToken(token.access_token),
      connectedAt: new Date()
    }
  });
  return publicConnection(connection);
}

export async function disconnectWhatsApp() {
  const connection = await prisma.whatsAppConnection.upsert({
    where: { id: CONNECTION_ID },
    update: { status: "DISCONNECTED", encryptedAccessToken: "", connectedAt: null },
    create: { id: CONNECTION_ID, status: "DISCONNECTED" }
  });
  return publicConnection(connection);
}

export async function testWhatsAppConnection() {
  const connection = await getWhatsAppConnection();
  if (!connection || connection.status !== "CONNECTED" || !connection.encryptedAccessToken) {
    const error = new Error("WhatsApp remetente não está conectado.");
    error.statusCode = 409;
    throw error;
  }
  const token = decryptToken(connection.encryptedAccessToken);
  const phone = await graphJson(`${connection.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return {
    ok: true,
    displayPhone: phone.display_phone_number || connection.displayPhone,
    verifiedName: phone.verified_name || "",
    qualityRating: phone.quality_rating || ""
  };
}

export function verifyWebhookSignature(rawBody, signature) {
  const appSecret = process.env.META_APP_SECRET || "";
  if (!appSecret || !rawBody || !signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function uploadReportMedia({ connection, token, document }) {
  const buffer = await getObjectBuffer(document.storageKey);
  const form = new FormData();
  form.set("messaging_product", "whatsapp");
  form.set("type", "application/pdf");
  form.set("file", new Blob([buffer], { type: "application/pdf" }), document.fileName);
  const payload = await graphJson(`${connection.phoneNumberId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  return payload.id;
}

export async function sendQueuedDelivery(deliveryId) {
  const claimed = await prisma.whatsAppDelivery.updateMany({
    where: { id: deliveryId, status: "QUEUED" },
    data: { status: "SENDING" }
  });
  if (!claimed.count) return prisma.whatsAppDelivery.findUnique({ where: { id: deliveryId } });
  const delivery = await prisma.whatsAppDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      analysis: {
        include: {
          documents: true,
          batch: { include: { clinic: true } }
        }
      }
    }
  });
  if (!delivery || delivery.status !== "SENDING") return delivery;
  const connection = await getWhatsAppConnection();
  if (!connection || connection.status !== "CONNECTED" || !connection.encryptedAccessToken) {
    throw new Error("WhatsApp remetente não está conectado.");
  }
  const report = delivery.analysis.documents.find((document) => document.kind === "REPORT" && !document.purgedAt);
  if (!report || report.expiresAt <= new Date()) throw new Error("Relatório indisponível ou expirado.");
  const token = decryptToken(connection.encryptedAccessToken);
  const mediaId = await uploadReportMedia({ connection, token, document: report });
  const payload = await graphJson(`${connection.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: delivery.recipientPhone,
      type: "template",
      template: {
        name: delivery.templateName,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "pt_BR" },
        components: [
          { type: "header", parameters: [{ type: "document", document: { id: mediaId, filename: report.fileName } }] },
          { type: "body", parameters: [
            { type: "text", text: delivery.analysis.batch.clinic.name },
            { type: "text", text: delivery.analysis.patientName }
          ] }
        ]
      }
    })
  });
  return prisma.whatsAppDelivery.update({
    where: { id: delivery.id },
    data: {
      status: "SENT",
      metaMessageId: payload.messages?.[0]?.id || null,
      attempts: { increment: 1 },
      lastError: "",
      sentAt: new Date()
    }
  });
}

export async function markDeliveryFailed(deliveryId, error) {
  return prisma.whatsAppDelivery.update({
    where: { id: deliveryId },
    data: { status: "FAILED", attempts: { increment: 1 }, lastError: String(error?.message || error).slice(0, 1000) }
  });
}

export async function applyWhatsAppWebhook(payload) {
  const statuses = [];
  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) statuses.push(...(change?.value?.statuses || []));
  }
  for (const item of statuses) {
    const statusMap = { sent: "SENT", delivered: "DELIVERED", read: "READ", failed: "FAILED" };
    const status = statusMap[item.status];
    if (!status || !item.id) continue;
    const timestamp = item.timestamp ? new Date(Number(item.timestamp) * 1000) : new Date();
    const delivery = await prisma.whatsAppDelivery.findUnique({ where: { metaMessageId: item.id } });
    if (!delivery) continue;
    const rank = { QUEUED: 0, SENT: 1, DELIVERED: 2, READ: 3 };
    if (status !== "FAILED" && (rank[status] || 0) < (rank[delivery.status] || 0)) continue;
    await prisma.whatsAppDelivery.update({
      where: { id: delivery.id },
      data: {
        status,
        ...(status === "DELIVERED" ? { deliveredAt: timestamp } : {}),
        ...(status === "READ" ? { readAt: timestamp } : {}),
        ...(status === "FAILED" ? { lastError: item.errors?.[0]?.title || "Falha informada pela Meta." } : {})
      }
    });
  }
}
