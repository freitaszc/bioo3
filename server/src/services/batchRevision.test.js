import test from "node:test";
import assert from "node:assert/strict";
import { batchRevision } from "./batchRevision.js";

const snapshot = [{ id: "batch", updatedAt: "2026-10-01", analyses: [{
  id: "analysis", updatedAt: "2026-10-01",
  results: [{ id: "result", updatedAt: "2026-10-01" }],
  documents: [{ id: "report", expiresAt: new Date(2000), purgedAt: null }],
  whatsappDelivery: { id: "delivery", updatedAt: "2026-10-01" }
}] }];

test("unchanged records retain a revision across polls", () => {
  assert.equal(batchRevision(snapshot, 1000), batchRevision(structuredClone(snapshot), 1500));
});

test("result edits, delivery updates, and removal invalidate the revision", () => {
  for (const change of [
    data => { data[0].analyses[0].results[0].updatedAt = "2026-10-02"; },
    data => { data[0].analyses[0].whatsappDelivery.updatedAt = "2026-10-02"; },
    data => { data[0].analyses = []; },
    data => { data[0].analyses[0].documents[0].purgedAt = new Date(1000); }
  ]) {
    const updated = structuredClone(snapshot);
    change(updated);
    assert.notEqual(batchRevision(snapshot, 1000), batchRevision(updated, 1000));
  }
});

test("download expiration invalidates the revision without a database update", () => {
  assert.notEqual(batchRevision(snapshot, 1999), batchRevision(snapshot, 2000));
  assert.equal(batchRevision(snapshot, 2000), batchRevision(snapshot, 3000));
});
