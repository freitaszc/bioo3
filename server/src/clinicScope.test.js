import assert from "node:assert/strict";
import test from "node:test";
import { clinicWhere, selectedClinicId } from "./clinicScope.js";

test("clinic users cannot override their clinic scope", () => {
  const req = { user: { role: "CLINIC", clinicId: 7 }, query: { clinicId: "99" }, body: {} };
  assert.equal(selectedClinicId(req), 7);
  assert.deepEqual(clinicWhere(req), { clinicId: 7 });
});

test("admins can use aggregate or selected clinic scope", () => {
  assert.deepEqual(clinicWhere({ user: { role: "ADMIN" }, query: {}, body: {} }), {});
  assert.deepEqual(clinicWhere({ user: { role: "ADMIN" }, query: { clinicId: "4" }, body: {} }), { clinicId: 4 });
});

test("admin mutations require an explicit valid clinic", () => {
  assert.throws(
    () => selectedClinicId({ user: { role: "ADMIN" }, query: {}, body: {} }, { required: true }),
    /Selecione uma clínica/
  );
  assert.throws(
    () => selectedClinicId({ user: { role: "ADMIN" }, query: { clinicId: "other" }, body: {} }),
    /Clínica inválida/
  );
});
