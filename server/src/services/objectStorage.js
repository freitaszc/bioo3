import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localRoot = path.resolve(__dirname, "../../uploads/batches");

function r2Config() {
  const endpoint = process.env.R2_ENDPOINT || (process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : "");
  return {
    endpoint,
    bucket: process.env.R2_BUCKET || "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || ""
  };
}

export function isR2Configured() {
  const config = r2Config();
  return Boolean(config.endpoint && config.bucket && config.accessKeyId && config.secretAccessKey);
}

function storageClient() {
  const config = r2Config();
  if (!isR2Configured()) return null;
  return new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });
}

function safeLocalPath(key) {
  const resolved = path.resolve(localRoot, key);
  if (!resolved.startsWith(`${localRoot}${path.sep}`)) throw new Error("Chave de armazenamento inválida.");
  return resolved;
}

export function createStorageKey(prefix, extension = "pdf") {
  return `${prefix}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
}

export async function putObject({ key, buffer, contentType = "application/pdf" }) {
  const client = storageClient();
  if (client) {
    await client.send(new PutObjectCommand({
      Bucket: r2Config().bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType
    }));
    return;
  }

  if (process.env.NODE_ENV === "production") {
    const error = new Error("Cloudflare R2 não está configurado.");
    error.statusCode = 503;
    throw error;
  }
  const target = safeLocalPath(key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, buffer);
}

export async function getObjectBuffer(key) {
  const client = storageClient();
  if (!client) return readFile(safeLocalPath(key));
  const response = await client.send(new GetObjectCommand({ Bucket: r2Config().bucket, Key: key }));
  return Buffer.from(await response.Body.transformToByteArray());
}

export async function signedDownloadUrl(key, { fileName, disposition = "inline", expiresIn = 300 } = {}) {
  const client = storageClient();
  if (!client) return null;
  const command = new GetObjectCommand({
    Bucket: r2Config().bucket,
    Key: key,
    ResponseContentDisposition: `${disposition}; filename*=UTF-8''${encodeURIComponent(fileName || "documento.pdf")}`,
    ResponseContentType: "application/pdf"
  });
  return getSignedUrl(client, command, { expiresIn });
}

export async function deleteObject(key) {
  const client = storageClient();
  if (client) {
    await client.send(new DeleteObjectCommand({ Bucket: r2Config().bucket, Key: key }));
    return;
  }
  await rm(safeLocalPath(key), { force: true });
}
