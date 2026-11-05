/**
 * Behaviour tests for the storage layer, run against the JSON backend.
 *
 * These cover the rules that protect money and results — the ones where a
 * regression is silent and expensive: the ledger not drifting from the cached
 * total, an overpayment being capped, and a line that already holds a result
 * surviving an edit that leaves it out.
 *
 * FileStorage writes through server/db.ts, so each test gets a temp .data
 * directory and a fresh module instance rather than sharing state.
 */
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IStorage } from "./storage-types";

let dir: string;
let storage: IStorage;

const ACTOR = { id: "u1", name: "Test Laborant" };

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "medlab-test-"));
  // db.ts resolves its data directory relative to its own file, so the module
  // is re-imported per test with the resolution stubbed at the fs boundary.
  vi.resetModules();
  process.env.MEDLAB_TEST_DIR = dir;
  const { FileStorage } = await import("./storage-file");
  storage = new FileStorage();
  await storage.seed();
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.MEDLAB_TEST_DIR;
});

/** A patient plus an order for two tests, which most cases below start from. */
async function makeOrder(testIds: string[], paidAmount = 0) {
  const patient = await storage.createPatient({
    fullName: "Aliyev Vali",
    phone: "+998901234567",
    gender: "erkak",
    age: 40,
    address: null,
  });
  const order = await storage.createOrder({
    patientId: patient.id,
    testIds,
    discount: 0,
    paidAmount,
    createdBy: ACTOR.id,
  });
  return { patient, order };
}

describe("createOrder", () => {
  it("prices from the catalogue and applies the discount", async () => {
    const patient = await storage.createPatient({
      fullName: "Test Bemor",
      phone: "+998901112233",
      gender: null,
      age: null,
      address: null,
    });
    const tests = await storage.listTests();
    const [a, b] = tests.slice(0, 2);

    const order = await storage.createOrder({
      patientId: patient.id,
      testIds: [a.id, b.id],
      discount: 5000,
      paidAmount: 0,
    });

    expect(order.totalAmount).toBe(a.price + b.price - 5000);
    expect(order.discount).toBe(5000);
  });

  it("records the opening payment as a ledger row, not just a number", async () => {
    const { order } = await makeOrder(["3", "22"], 20000);
    expect(order.paidAmount).toBe(20000);
    expect(order.payments).toHaveLength(1);
    expect(order.payments![0].amount).toBe(20000);
  });

  it("caps the opening payment at the total", async () => {
    const { order } = await makeOrder(["3"], 10_000_000);
    expect(order.paidAmount).toBe(order.totalAmount);
  });
});

describe("payments", () => {
  it("keeps paidAmount equal to the sum of the ledger", async () => {
    const { order } = await makeOrder(["3", "22"], 10000);
    await storage.addPayment(order.id, { amount: 15000, method: "karta" }, ACTOR);
    const after = await storage.getOrder(order.id);

    const sum = after!.payments!.reduce((s, p) => s + p.amount, 0);
    expect(after!.paidAmount).toBe(sum);
    expect(after!.paidAmount).toBe(25000);
  });

  it("caps a payment at the outstanding balance rather than overpaying", async () => {
    const { order } = await makeOrder(["3"]);
    const after = await storage.addPayment(order.id, { amount: 999_999, method: "naqd" }, ACTOR);
    expect(after!.paidAmount).toBe(order.totalAmount);
  });

  it("refuses a payment once the order is settled", async () => {
    const { order } = await makeOrder(["3"]);
    await storage.addPayment(order.id, { amount: order.totalAmount, method: "naqd" }, ACTOR);
    await expect(
      storage.addPayment(order.id, { amount: 1000, method: "naqd" }, ACTOR),
    ).rejects.toThrow(/to'liq to'langan/);
  });

  it("records a refund as a negative row and lowers the total", async () => {
    // Two tests, so the 30 000 opening payment fits under the total and is not
    // clamped before the refund under test even happens.
    const { order } = await makeOrder(["3", "22"], 30000);
    const after = await storage.addPayment(order.id, { amount: -10000, method: "naqd" }, ACTOR);
    expect(after!.paidAmount).toBe(20000);
    expect(after!.payments!.some((p) => p.amount === -10000)).toBe(true);
  });

  it("refuses to refund more than was ever taken", async () => {
    const { order } = await makeOrder(["3"], 10000);
    const after = await storage.addPayment(order.id, { amount: -50000, method: "naqd" }, ACTOR);
    // Clamped to the balance rather than driving the ledger negative.
    expect(after!.paidAmount).toBe(0);
  });

  it("re-derives the total when a ledger row is deleted", async () => {
    const { order } = await makeOrder(["3", "22"], 10000);
    const withSecond = await storage.addPayment(order.id, { amount: 5000, method: "naqd" }, ACTOR);
    const target = withSecond!.payments!.find((p) => p.amount === 5000)!;

    await storage.deletePayment(target.id);
    const after = await storage.getOrder(order.id);
    expect(after!.paidAmount).toBe(10000);
  });
});

describe("updateOrder — editing the test list", () => {
  it("adds a test and reprices", async () => {
    const { order } = await makeOrder(["3"]);
    const before = order.totalAmount;
    const after = await storage.updateOrder(order.id, { testIds: ["3", "22"] });

    expect(after!.items).toHaveLength(2);
    expect(after!.totalAmount).toBeGreaterThan(before);
  });

  it("removes a test and reprices", async () => {
    const { order } = await makeOrder(["3", "22"]);
    const after = await storage.updateOrder(order.id, { testIds: ["3"] });
    expect(after!.items).toHaveLength(1);
    expect(after!.items[0].testId).toBe("3");
  });

  it("never drops a line that already holds a result", async () => {
    const { order } = await makeOrder(["3", "22"]);
    const line = order.items.find((i) => i.testId === "3")!;
    await storage.saveResults(order.id, [{ id: line.id, result: "140" }], ACTOR);

    // The caller asks for a list that leaves the filled-in test out.
    const after = await storage.updateOrder(order.id, { testIds: ["22"] });

    const kept = after!.items.find((i) => i.testId === "3");
    expect(kept).toBeDefined();
    expect(kept!.result).toBe("140");
  });

  it("keeps the original line — and its result — for a test that stays", async () => {
    const { order } = await makeOrder(["3", "22"]);
    const line = order.items.find((i) => i.testId === "3")!;
    await storage.saveResults(order.id, [{ id: line.id, result: "140" }], ACTOR);

    const after = await storage.updateOrder(order.id, { testIds: ["3", "22", "17"] });
    const same = after!.items.find((i) => i.testId === "3")!;
    expect(same.id).toBe(line.id);
    expect(same.result).toBe("140");
  });

  it("re-caps the discount against the new, smaller subtotal", async () => {
    const { order } = await makeOrder(["3", "22"]);
    await storage.updateOrder(order.id, { discount: 40000 });
    const after = await storage.updateOrder(order.id, { testIds: ["3"] });

    const subtotal = after!.items.reduce((s, i) => s + i.price, 0);
    expect(after!.discount).toBeLessThanOrEqual(subtotal);
    expect(after!.totalAmount).toBe(subtotal - after!.discount);
    expect(after!.totalAmount).toBeGreaterThanOrEqual(0);
  });
});

describe("saveResults", () => {
  it("auto-flags from the reference range using the patient's sex", async () => {
    // Test 3 is haemoglobin: "Erkak: 130-170, Ayol: 120-150".
    const { order } = await makeOrder(["3"]);
    const line = order.items[0];

    const after = await storage.saveResults(order.id, [{ id: line.id, result: "95" }], ACTOR);
    expect(after!.items[0].flag).toBe("low");
  });

  it("lets an explicit flag from the laborant win", async () => {
    const { order } = await makeOrder(["3"]);
    const line = order.items[0];

    const after = await storage.saveResults(
      order.id,
      [{ id: line.id, result: "95", flag: "normal" }],
      ACTOR,
    );
    expect(after!.items[0].flag).toBe("normal");
  });

  it("stamps who entered the value", async () => {
    const { order } = await makeOrder(["3"]);
    const after = await storage.saveResults(
      order.id,
      [{ id: order.items[0].id, result: "140" }],
      ACTOR,
    );
    expect(after!.items[0].enteredBy).toBe(ACTOR.name);
  });

  it("moves the order to completed only once every line is filled", async () => {
    const { order } = await makeOrder(["3", "22"]);
    const [a, b] = order.items;

    const partial = await storage.saveResults(order.id, [{ id: a.id, result: "140" }], ACTOR);
    expect(partial!.status).toBe("in_progress");

    const done = await storage.saveResults(order.id, [{ id: b.id, result: "5.0" }], ACTOR);
    expect(done!.status).toBe("completed");
    expect(done!.completedAt).not.toBeNull();
  });
});

describe("audit log", () => {
  it("records entries newest first and filters by entity", async () => {
    await storage.writeAudit({ actor: ACTOR, action: "create", entity: "order", summary: "bir" });
    await storage.writeAudit({ actor: ACTOR, action: "delete", entity: "patient", summary: "ikki" });

    const all = await storage.listAudit();
    expect(all.items[0].summary).toBe("ikki");

    const onlyOrders = await storage.listAudit({ entity: "order" });
    expect(onlyOrders.items).toHaveLength(1);
    expect(onlyOrders.items[0].summary).toBe("bir");
  });
});

describe("login lockout state", () => {
  it("starts every account unlocked", async () => {
    const user = await storage.createUser({
      username: "yangi",
      password: "parol123",
      fullName: "Yangi Xodim",
      role: "laborant",
      isActive: true,
    });
    const full = await storage.getUser(user.id);
    expect(full!.failedAttempts).toBe(0);
    expect(full!.lockedUntil).toBeNull();
    expect(full!.lockLevel).toBe(0);
  });

  it("persists a lock so a restart cannot lift it", async () => {
    const user = await storage.createUser({
      username: "qulf",
      password: "parol123",
      fullName: "Qulf Sinov",
      role: "laborant",
      isActive: true,
    });
    const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await storage.setLockState(user.id, { failedAttempts: 0, lockedUntil: until, lockLevel: 1 });

    // Re-read through the store, which is what a fresh process would do.
    const reloaded = await storage.getUser(user.id);
    expect(reloaded!.lockedUntil).toBe(until);
    expect(reloaded!.lockLevel).toBe(1);
  });

  it("clears the lock when asked, which is what the admin button does", async () => {
    const user = await storage.createUser({
      username: "ochish",
      password: "parol123",
      fullName: "Ochish Sinov",
      role: "registrator",
      isActive: true,
    });
    await storage.setLockState(user.id, {
      failedAttempts: 0,
      lockedUntil: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      lockLevel: 4,
    });
    await storage.setLockState(user.id, { failedAttempts: 0, lockedUntil: null, lockLevel: 0 });

    const after = await storage.getUser(user.id);
    expect(after!.lockedUntil).toBeNull();
    expect(after!.lockLevel).toBe(0);
  });

  it("leaves the password untouched — a lock is not an edit", async () => {
    const user = await storage.createUser({
      username: "parolsaqlash",
      password: "parol123",
      fullName: "Parol Sinov",
      role: "laborant",
      isActive: true,
    });
    const before = (await storage.getUser(user.id))!.password;
    await storage.setLockState(user.id, {
      failedAttempts: 2,
      lockedUntil: null,
      lockLevel: 0,
    });
    expect((await storage.getUser(user.id))!.password).toBe(before);
  });
});

describe("expenses", () => {
  it("totals the amount over the requested range", async () => {
    await storage.createExpense({ category: "Reaktivlar", amount: 100000, spentOn: "2026-08-01" }, ACTOR);
    await storage.createExpense({ category: "Ijara", amount: 200000, spentOn: "2026-08-15" }, ACTOR);
    await storage.createExpense({ category: "Ijara", amount: 999999, spentOn: "2026-09-01" }, ACTOR);

    const august = await storage.listExpenses({ from: "2026-08-01", to: "2026-08-31" });
    expect(august.total).toBe(2);
    expect(august.total_amount).toBe(300000);
  });
});

/**
 * The sample is the one record that mirrors a physical object, so the rules
 * that matter are the ones that keep the row honest about it: a tube exists
 * from the moment the order does, its custody stamps say who touched it, and a
 * correction genuinely undoes rather than leaving a half-erased trail.
 */
describe("samples", () => {
  it("creates a tube with the order, so none is ever untracked", async () => {
    const { order } = await makeOrder(["1", "3"]);
    expect(order.sample).toBeTruthy();
    expect(order.sample!.status).toBe("kutilmoqda");
    expect(order.sample!.barcode).toBe(`LAB-${order.orderNumber}`);
  });

  it("stamps who collected the tube and when", async () => {
    const { order } = await makeOrder(["1"]);
    const res = await storage.updateSampleStatus(order.id, { status: "olindi" }, ACTOR);

    expect(res && "sample" in res).toBe(true);
    const sample = (res as { sample: NonNullable<typeof order.sample> }).sample;
    expect(sample.status).toBe("olindi");
    expect(sample.collectedByName).toBe(ACTOR.name);
    expect(Date.now() - new Date(sample.collectedAt!).getTime()).toBeLessThan(5000);
  });

  it("refuses to skip the laboratory's own hand-off", async () => {
    const { order } = await makeOrder(["1"]);
    const res = await storage.updateSampleStatus(order.id, { status: "qabul_qilindi" }, ACTOR);
    expect(res && "error" in res).toBe(true);
  });

  it("clears the collection stamp when a mis-click is undone", async () => {
    const { order } = await makeOrder(["1"]);
    await storage.updateSampleStatus(order.id, { status: "olindi" }, ACTOR);
    await storage.updateSampleStatus(order.id, { status: "kutilmoqda" }, ACTOR);

    // A tube the lab now says was never drawn must not keep a draw time.
    const after = await storage.getOrder(order.id);
    expect(after?.sample?.status).toBe("kutilmoqda");
    expect(after?.sample?.collectedAt).toBeNull();
    expect(after?.sample?.collectedByName).toBeNull();
  });

  it("keeps the reason on a rejection and makes it terminal", async () => {
    const { order } = await makeOrder(["1"]);
    await storage.updateSampleStatus(order.id, { status: "olindi" }, ACTOR);
    await storage.updateSampleStatus(
      order.id,
      { status: "rad_etildi", rejectReason: "Gemoliz", rejectNote: "qayta olish kerak" },
      ACTOR,
    );

    const after = await storage.getOrder(order.id);
    expect(after?.sample?.status).toBe("rad_etildi");
    expect(after?.sample?.rejectReason).toBe("Gemoliz");
    expect(after?.sample?.rejectedByName).toBe(ACTOR.name);

    // A discarded tube cannot be reopened; a new draw is a new sample.
    const reopen = await storage.updateSampleStatus(order.id, { status: "olindi" }, ACTOR);
    expect(reopen && "error" in reopen).toBe(true);
  });

  it("finds an order by its barcode, however the scanner formats it", async () => {
    const { order } = await makeOrder(["1"]);
    for (const code of [`LAB-${order.orderNumber}`, `lab-${order.orderNumber}`, String(order.orderNumber)]) {
      const found = await storage.getOrderByBarcode(code);
      expect(found?.id).toBe(order.id);
    }
    expect(await storage.getOrderByBarcode("LAB-999999")).toBeUndefined();
    expect(await storage.getOrderByBarcode("nonsense")).toBeUndefined();
  });

  it("drops the tube with the order, so its barcode is not orphaned", async () => {
    const { order } = await makeOrder(["1"]);
    await storage.deleteOrder(order.id);
    expect(await storage.getOrderByBarcode(`LAB-${order.orderNumber}`)).toBeUndefined();
  });
});

describe("roles", () => {
  it("seeds the eleven TZ roles and migrates the legacy admin", async () => {
    const roles = await storage.listRoles();
    expect(roles.map((r) => r.key)).toEqual([
      "super_admin",
      "rahbar",
      "registrator",
      "shifokor",
      "laborant",
      "lab_mudiri",
      "omborchi",
      "hamshira",
      "kassir",
      "buxgalter",
      "auditor",
    ]);
    expect(roles.every((r) => r.isSystem)).toBe(true);
    // The seeded administrator is created straight into the new role.
    expect(roles.find((r) => r.key === "super_admin")?.userCount).toBe(1);
  });

  it("never overwrites a role the clinic has edited", async () => {
    await storage.updateRole("kassir", { permissions: ["patients.read"] }, ACTOR);
    await storage.seed();
    expect((await storage.getRole("kassir"))?.permissions).toEqual(["patients.read"]);
  });

  it("hands out copies, so a role read before an update still shows the old value", async () => {
    const before = await storage.getRole("shifokor");
    await storage.updateRole("shifokor", { permissions: ["patients.read"] }, ACTOR);
    expect(before?.permissions).toEqual(["patients.read", "orders.read"]);
  });

  it("stamps who edited a role and when", async () => {
    const role = await storage.updateRole("auditor", { name: "Ichki auditor" }, ACTOR);
    expect(role?.name).toBe("Ichki auditor");
    expect(role?.updatedBy).toBe(ACTOR.id);
    expect(role?.updatedAt).toBeTruthy();
  });

  it("creates and deletes a custom role, but never a system one", async () => {
    const custom = await storage.createRole(
      { key: "uzi_shifokori", name: "UZI shifokori", description: null, permissions: ["patients.read"] },
      ACTOR,
    );
    expect(custom.isSystem).toBe(false);
    await expect(
      storage.createRole({ key: "uzi_shifokori", name: "Dublikat", permissions: [] }, ACTOR),
    ).rejects.toThrow();

    expect(await storage.deleteRole("registrator")).toBe(false);
    expect(await storage.deleteRole("uzi_shifokori")).toBe(true);
    expect(await storage.getRole("uzi_shifokori")).toBeUndefined();
  });

  it("counts holders per role", async () => {
    await storage.createUser({
      username: "kassa1",
      password: "parol123",
      fullName: "Karimova Dilnoza",
      role: "kassir",
      isActive: true,
    });
    const kassir = (await storage.listRoles()).find((r) => r.key === "kassir");
    expect(kassir?.userCount).toBe(1);
  });
});

describe("departments and doctors", () => {
  async function makeDoctorUser(username = "dr1") {
    return storage.createUser({ username, password: "parol123", fullName: "Karimov Anvar", role: "shifokor", isActive: true });
  }

  it("creates a department and counts its doctors", async () => {
    const dept = await storage.createDepartment({ name: "Kardiologiya", kind: "ambulator", isActive: true }, ACTOR);
    const user = await makeDoctorUser();
    await storage.createDoctor(
      { userId: user.id, departmentId: dept.id, specialty: "Kardiolog", consultationPrice: 150000, slotMinutes: 20, schedule: [], isActive: true },
      ACTOR,
    );
    const [listed] = await storage.listDepartments();
    expect(listed.doctorCount).toBe(1);
    expect(listed.updatedBy).toBe(ACTOR.id);
  });

  it("joins the doctor with the account and department name", async () => {
    const dept = await storage.createDepartment({ name: "Terapiya", kind: "ambulator", isActive: true }, ACTOR);
    const user = await makeDoctorUser();
    const doc = await storage.createDoctor(
      {
        userId: user.id,
        departmentId: dept.id,
        specialty: "Terapevt",
        room: "204",
        consultationPrice: 100000,
        slotMinutes: 15,
        schedule: [{ day: 1, start: "08:00", end: "17:00" }],
        isActive: true,
      },
      ACTOR,
    );
    expect(doc).toMatchObject({ fullName: "Karimov Anvar", username: "dr1", departmentName: "Terapiya", room: "204" });
    expect((await storage.getDoctorByUser(user.id))?.id).toBe(doc.id);
  });

  it("allows one profile per account", async () => {
    const user = await makeDoctorUser();
    const base = { userId: user.id, specialty: "Terapevt", consultationPrice: 0, slotMinutes: 20, schedule: [], isActive: true };
    await storage.createDoctor(base, ACTOR);
    await expect(storage.createDoctor(base, ACTOR)).rejects.toThrow();
  });

  it("filters to doctors who are taking patients", async () => {
    const a = await makeDoctorUser("dr_a");
    const b = await makeDoctorUser("dr_b");
    const base = { specialty: "Terapevt", consultationPrice: 0, slotMinutes: 20, schedule: [], isActive: true };
    await storage.createDoctor({ ...base, userId: a.id }, ACTOR);
    const off = await storage.createDoctor({ ...base, userId: b.id }, ACTOR);
    await storage.updateDoctor(off.id, { isActive: false }, ACTOR);
    expect((await storage.listDoctors({ activeOnly: true })).map((d) => d.username)).toEqual(["dr_a"]);
    expect(await storage.listDoctors()).toHaveLength(2);
  });

  it("hides a doctor whose account is blocked from the active list", async () => {
    const user = await makeDoctorUser();
    await storage.createDoctor({ userId: user.id, specialty: "Terapevt", consultationPrice: 0, slotMinutes: 20, schedule: [], isActive: true }, ACTOR);
    await storage.updateUser(user.id, { isActive: false });
    expect(await storage.listDoctors({ activeOnly: true })).toHaveLength(0);
  });
});

describe("security settings", () => {
  it("falls back to the defaults until saved", async () => {
    expect(await storage.getSecuritySettings()).toEqual({ sessionIdleMinutes: 30, sessionMaxHours: 12 });
  });

  it("keeps what was saved", async () => {
    await storage.updateSecuritySettings({ sessionIdleMinutes: 15, sessionMaxHours: 8 }, ACTOR);
    expect(await storage.getSecuritySettings()).toEqual({ sessionIdleMinutes: 15, sessionMaxHours: 8 });
  });
});

describe("expenses: ledger rules", () => {
  const base = { category: "Reaktivlar" as const, method: "naqd" as const, payee: null, note: null };

  it("cancels instead of deleting, and drops the row from every total", async () => {
    const keep = await storage.createExpense({ ...base, amount: 100000, spentOn: "2026-10-05" }, ACTOR);
    const gone = await storage.createExpense({ ...base, amount: 40000, spentOn: "2026-10-06" }, ACTOR);
    const cancelled = await storage.cancelExpense(gone.id, "Ikki marta kiritilgan", ACTOR);
    expect(cancelled).toMatchObject({ status: "cancelled", cancelReason: "Ikki marta kiritilgan", cancelledByName: ACTOR.name });

    const active = await storage.listExpenses({ from: "2026-10-01", to: "2026-10-31" });
    expect(active.items.map((e) => e.id)).toEqual([keep.id]);
    expect(active.total_amount).toBe(100000);

    // Still in the ledger when asked for — never erased.
    const all = await storage.listExpenses({ from: "2026-10-01", to: "2026-10-31", status: "all" });
    expect(all.total).toBe(2);
    expect(all.total_amount).toBe(100000);

    const summary = await storage.getExpenseSummary("2026-10-01", "2026-10-31");
    expect(summary).toMatchObject({ total: 100000, count: 1, cancelled: { count: 1, amount: 40000 } });

    const report = await storage.getRevenueReport("2026-10-01", "2026-10-31");
    expect(report.totalExpenses).toBe(100000);
  });

  it("edits fields and stamps who edited", async () => {
    const row = await storage.createExpense({ ...base, amount: 50000, spentOn: "2026-10-05" }, ACTOR);
    const edited = await storage.updateExpense(row.id, { amount: 55000, method: "karta", payee: "Medtexnika" }, ACTOR);
    expect(edited).toMatchObject({ amount: 55000, method: "karta", payee: "Medtexnika", updatedBy: ACTOR.id });
    expect(edited?.updatedAt).toBeTruthy();
  });

  it("filters by category, method and text in payee or note", async () => {
    await storage.createExpense({ ...base, amount: 1000, spentOn: "2026-10-01", payee: "Medtexnika MChJ" }, ACTOR);
    await storage.createExpense({ ...base, category: "Ijara", amount: 2000, spentOn: "2026-10-02", method: "o'tkazma" }, ACTOR);
    await storage.createExpense({ ...base, amount: 3000, spentOn: "2026-10-03", note: "gemoglobin reaktivi" }, ACTOR);
    const q = (extra: object) => storage.listExpenses({ from: "2026-10-01", to: "2026-10-31", ...extra });
    expect((await q({ category: "Ijara" })).total).toBe(1);
    expect((await q({ method: "o'tkazma" })).total).toBe(1);
    expect((await q({ search: "medtex" })).total).toBe(1);
    expect((await q({ search: "GEMOGLOBIN" })).total).toBe(1);
  });

  it("summarises the whole range, zero-fills days and compares with the previous period", async () => {
    await storage.createExpense({ ...base, amount: 30000, spentOn: "2026-09-25" }, ACTOR);
    await storage.createExpense({ ...base, amount: 70000, spentOn: "2026-10-01" }, ACTOR);
    await storage.createExpense({ ...base, category: "Ijara", amount: 200000, spentOn: "2026-10-03", method: "o'tkazma" }, ACTOR);

    const s = await storage.getExpenseSummary("2026-10-01", "2026-10-07");
    expect(s.total).toBe(270000);
    expect(s.count).toBe(2);
    expect(s.average).toBe(135000);
    expect(s.largest).toBe(200000);
    expect(s.byCategory[0]).toEqual({ category: "Ijara", amount: 200000, count: 1 });
    expect(s.byMethod.map((m) => m.method).sort()).toEqual(["naqd", "o'tkazma"]);
    expect(s.daily).toHaveLength(7);
    expect(s.daily[1]).toEqual({ date: "2026-10-02", amount: 0 });
    expect(s.previous).toEqual({ from: "2026-09-24", to: "2026-09-30", total: 30000 });
  });

  it("suggests payees, most used first", async () => {
    await storage.createExpense({ ...base, amount: 1, spentOn: "2026-10-01", payee: "B" }, ACTOR);
    await storage.createExpense({ ...base, amount: 1, spentOn: "2026-10-01", payee: "A" }, ACTOR);
    await storage.createExpense({ ...base, amount: 1, spentOn: "2026-10-02", payee: "A" }, ACTOR);
    expect(await storage.listExpensePayees()).toEqual(["A", "B"]);
  });
});
