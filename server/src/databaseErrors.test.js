import assert from "node:assert/strict";
import test from "node:test";
import { knownDatabaseError } from "./databaseErrors.js";

test("turns foreign-key deletion conflicts into a controlled response", () => {
  assert.deepEqual(knownDatabaseError({ code: "P2003" }), {
    status: 409,
    message: "Este registro possui dados históricos vinculados e não pode ser excluído. Inative-o quando essa opção estiver disponível."
  });
});

test("ignores unknown database errors", () => {
  assert.equal(knownDatabaseError(new Error("unexpected")), null);
});
