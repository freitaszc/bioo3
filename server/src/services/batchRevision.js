import { createHash } from "node:crypto";

export function batchRevision(revisions, now = Date.now()) {
  // Expiration changes download availability even without a database write.
  return createHash("sha256").update(JSON.stringify(revisions, (key, value) =>
    key === "expiresAt" ? [value, new Date(value).getTime() > now] : value
  )).digest("hex");
}
