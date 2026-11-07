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
import { todayKey, type IStorage } from "./storage-types";

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

  it("voids a ledger row: kept with who and why, no longer counted (TZ §10)", async () => {
    const { order } = await makeOrder(["3", "22"], 10000);
    const withSecond = await storage.addPayment(order.id, { amount: 5000, method: "naqd" }, ACTOR);
    const target = withSecond!.payments!.find((p) => p.amount === 5000)!;
    expect(target.voidedAt).toBeNull();

    const after = await storage.voidPayment(target.id, "Ikki marta kiritilgan", ACTOR);
    expect(after!.paidAmount).toBe(10000);
    expect(after!.payments).toHaveLength(2);
    const voided = after!.payments!.find((p) => p.id === target.id)!;
    expect(voided.voidedAt).toBeTruthy();
    expect(voided.voidedBy).toBe(ACTOR.id);
    expect(voided.voidedByName).toBe(ACTOR.name);
    expect(voided.voidReason).toBe("Ikki marta kiritilgan");
    expect(after!.updatedBy).toBe(ACTOR.id);
  });

  it("refuses to void the same row twice, and misses an unknown one", async () => {
    const { order } = await makeOrder(["3"], 10000);
    const row = order.payments![0];
    await storage.voidPayment(row.id, "Xato summa", ACTOR);
    await expect(storage.voidPayment(row.id, "Yana bir bor", ACTOR)).rejects.toThrow(/allaqachon bekor/);
    expect(await storage.voidPayment("no-such-row", "Xato summa", ACTOR)).toBeUndefined();
  });

  it("leaves a voided row out of the room left to pay", async () => {
    const { order } = await makeOrder(["3"], 10000);
    await storage.voidPayment(order.payments![0].id, "Xato summa", ACTOR);
    // The whole bill can be paid again: the voided 10 000 no longer counts.
    const after = await storage.addPayment(order.id, { amount: order.totalAmount, method: "naqd" }, ACTOR);
    expect(after!.paidAmount).toBe(order.totalAmount);
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

describe("nothing financial or medical is erased (TZ §10, B1.10)", () => {
  it("refuses to delete an order with a payment, even a voided one", async () => {
    const { order } = await makeOrder(["3"], 10000);
    await expect(storage.deleteOrder(order.id)).rejects.toThrow(/to'lov yozuvlari bor/);
    await storage.voidPayment(order.payments![0].id, "Xato summa", ACTOR);
    await expect(storage.deleteOrder(order.id)).rejects.toThrow(/to'lov yozuvlari bor/);
    expect(await storage.getOrder(order.id)).toBeDefined();
  });

  it("refuses to delete an order with a result", async () => {
    const { order } = await makeOrder(["3"]);
    await storage.saveResults(order.id, [{ id: order.items[0].id, result: "140" }], ACTOR);
    await expect(storage.deleteOrder(order.id)).rejects.toThrow(/natijalari bor/);
  });

  it("deletes an order entered by mistake: no money, no result", async () => {
    const { order } = await makeOrder(["3"]);
    expect(await storage.deleteOrder(order.id)).toBe(true);
    expect(await storage.getOrder(order.id)).toBeUndefined();
    expect(await storage.deleteOrder(order.id)).toBe(false);
  });

  it("keeps a catalogue test that an order used; an unused one can go", async () => {
    await makeOrder(["3"]);
    await expect(storage.deleteTest("3")).rejects.toThrow(/buyurtmalarda ishlatilgan/);
    const fresh = await storage.createTest({ name: "Yangi tahlil", price: 1000, category: "Boshqa", isActive: true }, ACTOR);
    expect(await storage.deleteTest(fresh.id)).toBe(true);
  });
});

describe("who and when on every important row (TZ §10, B1.10)", () => {
  it("stamps a test's creator and its later editor", async () => {
    const created = await storage.createTest({ name: "Ferritin", price: 50000, category: "Biokimyo", isActive: true }, ACTOR);
    expect(created.createdBy).toBe(ACTOR.id);
    expect(created.createdAt).toBeTruthy();
    expect(created.updatedAt).toBeNull();

    const editor = { id: "u2", name: "Mudir" };
    const edited = await storage.updateTest(created.id, { price: 55000 }, editor);
    expect(edited!.updatedBy).toBe("u2");
    expect(edited!.updatedAt).toBeTruthy();
    expect(edited!.createdBy).toBe(ACTOR.id);
  });

  it("stamps an order on edit, on results and on payment — not on creation", async () => {
    const { order } = await makeOrder(["3", "22"]);
    expect(order.updatedAt).toBeNull();

    const edited = await storage.updateOrder(order.id, { discount: 1000 }, { id: "u2", name: "Registrator" });
    expect(edited!.updatedBy).toBe("u2");

    const resulted = await storage.saveResults(order.id, [{ id: order.items[0].id, result: "5.1" }], ACTOR);
    expect(resulted!.updatedBy).toBe(ACTOR.id);

    const paid = await storage.addPayment(order.id, { amount: 1000, method: "naqd" }, { id: "u3", name: "Kassir" });
    expect(paid!.updatedBy).toBe("u3");
  });

  it("stamps the staff account's creator and editor, not sign-in lockouts", async () => {
    const admin = { id: "admin-1", name: "Admin" };
    const user = await storage.createUser(
      { username: "yangi.xodim", password: "parol123", fullName: "Yangi Xodim", role: "registrator", isActive: true },
      admin,
    );
    expect(user.createdBy).toBe("admin-1");
    expect(user.updatedAt).toBeNull();

    await storage.setLockState(user.id, { failedAttempts: 3, lockedUntil: null, lockLevel: 0 });
    expect((await storage.getUser(user.id))!.updatedAt).toBeNull();

    const edited = await storage.updateUser(user.id, { fullName: "Yangi Xodim Ismi" }, admin);
    expect(edited!.updatedBy).toBe("admin-1");
    expect(edited!.updatedAt).toBeTruthy();
  });

  it("records who registered a patient", async () => {
    const patient = await storage.createPatient({ fullName: "Karimov Anvar", phone: "+998 90 111 22 33" }, ACTOR);
    expect(patient.createdBy).toBe(ACTOR.id);
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
    expect(before?.permissions).toEqual([
      "patients.read",
      "orders.read",
      "appointments.serve",
      "records.read",
      "records.write",
      "records.sign",
      "records.amend",
      "referrals.read",
      "referrals.create",
    ]);
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
    expect(await storage.getSecuritySettings()).toEqual({
      sessionIdleMinutes: 30,
      sessionMaxHours: 12,
      mfaRequiredRoles: [],
    });
  });

  it("keeps what was saved", async () => {
    await storage.updateSecuritySettings(
      { sessionIdleMinutes: 15, sessionMaxHours: 8, mfaRequiredRoles: ["rahbar", "kassir"] },
      ACTOR,
    );
    expect(await storage.getSecuritySettings()).toEqual({
      sessionIdleMinutes: 15,
      sessionMaxHours: 8,
      mfaRequiredRoles: ["rahbar", "kassir"],
    });
  });

  it("reads settings saved before 2FA existed as 'nobody is required'", async () => {
    await storage.updateSecuritySettings({ sessionIdleMinutes: 15, sessionMaxHours: 8 } as never, ACTOR);
    expect((await storage.getSecuritySettings()).mfaRequiredRoles).toEqual([]);
  });
});

describe("two-factor enrolment (B1.8)", () => {
  const enrol = (userId: string) =>
    storage.saveUserMfa({ userId, secret: "v1.x.y.z", recoveryCodes: ["h1", "h2", "h3"], lastUsedStep: 100 }, ACTOR);
  const firstUser = async () => (await storage.listUsers())[0];

  it("is off for everyone until someone enrols", async () => {
    const u = await firstUser();
    expect(await storage.mfaAvailable()).toBe(true);
    expect(await storage.getUserMfa(u.id)).toBeUndefined();
    expect(await storage.listMfaEnrollments()).toEqual([]);
  });

  it("stores the enrolment and lists who has it — without the secret", async () => {
    const u = await firstUser();
    await enrol(u.id);
    expect((await storage.getUserMfa(u.id))?.recoveryCodes).toEqual(["h1", "h2", "h3"]);
    const list = await storage.listMfaEnrollments();
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual({ userId: u.id, enabledAt: expect.any(String) });
  });

  it("re-enrolling replaces the old secret and codes", async () => {
    const u = await firstUser();
    await enrol(u.id);
    await storage.saveUserMfa({ userId: u.id, secret: "v1.new", recoveryCodes: ["n1"], lastUsedStep: 5 }, ACTOR);
    const row = await storage.getUserMfa(u.id);
    expect(row?.secret).toBe("v1.new");
    expect(row?.recoveryCodes).toEqual(["n1"]);
    expect(await storage.listMfaEnrollments()).toHaveLength(1);
  });

  it("accepts a code step once, and only a newer one after that (replay protection)", async () => {
    const u = await firstUser();
    await enrol(u.id);
    expect(await storage.consumeMfaStep(u.id, 101)).toBe(true);
    expect(await storage.consumeMfaStep(u.id, 101)).toBe(false);
    expect(await storage.consumeMfaStep(u.id, 99)).toBe(false);
    expect(await storage.consumeMfaStep(u.id, 102)).toBe(true);
  });

  it("of two parallel requests with the same code, only one is accepted", async () => {
    const u = await firstUser();
    await enrol(u.id);
    const results = await Promise.all([storage.consumeMfaStep(u.id, 200), storage.consumeMfaStep(u.id, 200)]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("spends a recovery code exactly once", async () => {
    const u = await firstUser();
    await enrol(u.id);
    expect(await storage.consumeRecoveryCode(u.id, "h2")).toBe(true);
    expect(await storage.consumeRecoveryCode(u.id, "h2")).toBe(false);
    expect((await storage.getUserMfa(u.id))?.recoveryCodes).toEqual(["h1", "h3"]);
  });

  it("replaces recovery codes, invalidating the old ones", async () => {
    const u = await firstUser();
    await enrol(u.id);
    expect(await storage.replaceRecoveryCodes(u.id, ["z1", "z2"], ACTOR)).toBe(true);
    expect(await storage.consumeRecoveryCode(u.id, "h1")).toBe(false);
    expect(await storage.consumeRecoveryCode(u.id, "z1")).toBe(true);
    expect(await storage.replaceRecoveryCodes("nobody", ["x"], ACTOR)).toBe(false);
  });

  it("deleting removes 2FA, and deleting the user takes the enrolment along", async () => {
    const a = await firstUser();
    const b = await storage.createUser({ username: "ikkinchi", password: "parol123", fullName: "Ikkinchi Xodim", role: "kassir", isActive: true });
    await enrol(a.id);
    await enrol(b.id);
    expect(await storage.deleteUserMfa(a.id)).toBe(true);
    expect(await storage.deleteUserMfa(a.id)).toBe(false);
    await storage.deleteUser(b.id);
    expect(await storage.listMfaEnrollments()).toEqual([]);
  });

  it("returns copies, so callers cannot edit stored codes in place", async () => {
    const u = await firstUser();
    await enrol(u.id);
    (await storage.getUserMfa(u.id))!.recoveryCodes.push("hacked");
    expect((await storage.getUserMfa(u.id))?.recoveryCodes).toEqual(["h1", "h2", "h3"]);
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

describe("patients: registry", () => {
  const base = { fullName: "Aliyev Vali", phone: "+998 90 123 45 67", gender: "erkak" as const, age: null, address: null };

  it("stores birth date, documents and the emergency contact", async () => {
    const p = await storage.createPatient(
      {
        ...base,
        birthDate: "1990-05-12",
        passport: "AA1234567",
        pinfl: "31205901234567",
        emergencyContact: { name: "Aliyeva Malika", relation: "Onasi", phone: "+998 90 111 22 33" },
      },
      ACTOR,
    );
    const d = await storage.getPatientDetails(p.id);
    expect(d).toMatchObject({ birthDate: "1990-05-12", passport: "AA1234567", pinfl: "31205901234567", updatedBy: ACTOR.id });
    expect(d?.contacts).toHaveLength(1);
    expect(d?.contacts[0]).toMatchObject({ name: "Aliyeva Malika", relation: "Onasi", isEmergency: true });
  });

  it("replaces the emergency contact, removes it with null, keeps it when absent", async () => {
    const p = await storage.createPatient({ ...base, emergencyContact: { name: "A Bir", relation: null, phone: "+998 90 000 00 01" } });
    await storage.updatePatient(p.id, { address: "Toshkent" });
    expect((await storage.getPatientDetails(p.id))?.contacts).toHaveLength(1);
    await storage.updatePatient(p.id, { emergencyContact: { name: "B Ikki", relation: null, phone: "+998 90 000 00 02" } });
    expect((await storage.getPatientDetails(p.id))?.contacts.map((c) => c.name)).toEqual(["B Ikki"]);
    await storage.updatePatient(p.id, { emergencyContact: null });
    expect((await storage.getPatientDetails(p.id))?.contacts).toHaveLength(0);
  });

  it("lists the last visit and the number of visits, cancelled ones excluded", async () => {
    const { patient } = await makeOrder(["1"]);
    const second = await storage.createOrder({ patientId: patient.id, testIds: ["1"], discount: 0, paidAmount: 0 });
    await storage.updateOrder(second.id, { status: "cancelled" });
    const row = (await storage.listPatients()).items.find((p) => p.id === patient.id);
    expect(row?.visitCount).toBe(1);
    expect(row?.lastVisitAt).toBeTruthy();
  });

  it("finds candidates by document, phone or surname", async () => {
    const p = await storage.createPatient({ ...base, pinfl: "31205901234567" });
    expect((await storage.findPatientCandidates({ pinfl: "31205901234567" })).map((x) => x.id)).toEqual([p.id]);
    expect((await storage.findPatientCandidates({ phoneDigits: "901234567" })).length).toBe(1);
    expect((await storage.findPatientCandidates({ nameKey: "aliyev" })).length).toBe(1);
    expect(await storage.findPatientCandidates({ phoneDigits: "901234567", excludeId: p.id })).toEqual([]);
  });

  it("merges a duplicate: orders move, gaps fill, the duplicate goes", async () => {
    const real = await storage.createPatient({ ...base });
    const dup = await storage.createPatient({
      ...base,
      fullName: "Aliev Vali",
      birthDate: "1990-05-12",
      emergencyContact: { name: "Aliyeva Malika", relation: null, phone: "+998 90 111 22 33" },
    });
    await storage.createOrder({ patientId: dup.id, testIds: ["1"], discount: 0, paidAmount: 0 });

    const moved = await storage.mergePatients(dup.id, real.id);
    expect(moved).toEqual({ orders: 1, contacts: 1, appointments: 0 });
    expect(await storage.getPatient(dup.id)).toBeUndefined();
    const merged = await storage.getPatientDetails(real.id);
    expect(merged?.birthDate).toBe("1990-05-12");
    expect(merged?.contacts).toHaveLength(1);
    expect((await storage.listOrders({ patientId: real.id })).total).toBe(1);
  });

  it("refuses to merge a card into itself", async () => {
    const p = await storage.createPatient({ ...base });
    expect(await storage.mergePatients(p.id, p.id)).toBeUndefined();
  });
});

describe("visits and the patient card", () => {
  it("puts two orders on the same day into one visit", async () => {
    const { patient, order } = await makeOrder(["1"]);
    const second = await storage.createOrder({ patientId: patient.id, testIds: ["2"], discount: 0, paidAmount: 0 });
    expect(order.visitId).toBeTruthy();
    expect(second.visitId).toBe(order.visitId);
    const row = (await storage.listPatients()).items.find((p) => p.id === patient.id);
    expect(row?.visitCount).toBe(1);
  });

  it("builds the card: visits, ledger and totals", async () => {
    const { patient, order } = await makeOrder(["1", "2"], 10000);
    const card = await storage.getPatientCard(patient.id);
    expect(card?.visits).toHaveLength(1);
    expect(card?.visits[0].orders.map((o) => o.id)).toEqual([order.id]);
    expect(card?.totals).toMatchObject({ visits: 1, orders: 1, billed: order.totalAmount, paid: 10000 });
    expect(card?.totals.debt).toBe(order.totalAmount - 10000);
    expect(card?.payments[0]).toMatchObject({ amount: 10000, orderNumber: order.orderNumber });
  });

  it("leaves cancelled orders out of the money and the visit count", async () => {
    const { patient, order } = await makeOrder(["1"]);
    await storage.updateOrder(order.id, { status: "cancelled" });
    const card = await storage.getPatientCard(patient.id);
    expect(card?.totals).toMatchObject({ visits: 0, orders: 1, billed: 0 });
    expect(card?.visits[0].orders).toHaveLength(1);
  });

  it("returns undefined for an unknown patient", async () => {
    expect(await storage.getPatientCard("nope")).toBeUndefined();
  });

  it("merging folds same-day visits into one", async () => {
    const real = await storage.createPatient({ fullName: "Aliyev Vali", phone: "+998 90 123 45 67", gender: null, age: null, address: null });
    const dup = await storage.createPatient({ fullName: "Aliev Vali", phone: "+998 90 123 45 67", gender: null, age: null, address: null });
    const a = await storage.createOrder({ patientId: real.id, testIds: ["1"], discount: 0, paidAmount: 0 });
    const b = await storage.createOrder({ patientId: dup.id, testIds: ["2"], discount: 0, paidAmount: 0 });
    expect(a.visitId).not.toBe(b.visitId);
    await storage.mergePatients(dup.id, real.id);
    const card = await storage.getPatientCard(real.id);
    expect(card?.visits).toHaveLength(1);
    expect(card?.visits[0].orders).toHaveLength(2);
  });

  it("filters the audit log by record and action", async () => {
    await storage.writeAudit({ actor: ACTOR, action: "view", entity: "patient", entityId: "p1", summary: "ochildi" });
    await storage.writeAudit({ actor: ACTOR, action: "update", entity: "patient", entityId: "p1", summary: "o'zgardi" });
    await storage.writeAudit({ actor: ACTOR, action: "view", entity: "patient", entityId: "p2", summary: "boshqa" });
    expect((await storage.listAudit({ entity: "patient", entityId: "p1" })).total).toBe(2);
    expect((await storage.listAudit({ entity: "patient", entityId: "p1", action: "view" })).total).toBe(1);
  });
});

describe("services catalogue (B2.6)", () => {
  it("creates, lists with the department name, and updates", async () => {
    const dept = await storage.createDepartment({ name: "Diagnostika", kind: "diagnostika", isActive: true }, ACTOR);
    const svc = await storage.createService(
      { name: "Qorin bo'shlig'i UZI", kind: "uzi", departmentId: dept.id, price: 120000, durationMinutes: 20, description: null, isActive: true },
      ACTOR,
    );
    expect(svc.departmentName).toBe("Diagnostika");
    expect(svc.appointmentCount).toBe(0);
    const updated = await storage.updateService(svc.id, { price: 130000, isActive: false }, ACTOR);
    expect(updated?.price).toBe(130000);
    expect(updated?.updatedBy).toBe(ACTOR.id);
    expect(await storage.listServices({ activeOnly: true })).toHaveLength(0);
    expect(await storage.deleteService(svc.id)).toBe(true);
    expect(await storage.getService(svc.id)).toBeUndefined();
  });
});

describe("appointments (B2.7)", () => {
  const MON = "2026-11-09";
  const free = () => null;

  async function setup() {
    const user = await storage.createUser({ username: "dr9", password: "parol123", fullName: "Rustamov Jasur", role: "shifokor", isActive: true });
    const doctor = await storage.createDoctor(
      {
        userId: user.id,
        departmentId: null,
        specialty: "Nevrolog",
        room: "12",
        consultationPrice: 100000,
        slotMinutes: 20,
        schedule: [{ day: 1, start: "09:00", end: "12:00" }],
        isActive: true,
      },
      ACTOR,
    );
    const patient = await storage.createPatient({ fullName: "Aliyev Vali", phone: "+998901234567", gender: "erkak", age: 40, address: null });
    const book = (startTime: string, patientId = patient.id, date = MON) =>
      storage.createAppointment(
        { patientId, doctorId: doctor.id, serviceId: null, date, startTime, reason: null, durationMinutes: 20, price: 100000 },
        ACTOR,
        free,
      );
    return { doctor, patient, book };
  }

  it("issues ticket numbers per doctor and day, and joins names", async () => {
    const { book, patient } = await setup();
    const a = await book("09:00");
    const b = await book("09:20");
    const c = await book("09:00", patient.id, "2026-11-16");
    expect([a.queueNumber, b.queueNumber, c.queueNumber]).toEqual([1, 2, 1]);
    expect(a.patientName).toBe("Aliyev Vali");
    expect(a.doctorName).toBe("Rustamov Jasur");
    expect(a.room).toBe("12");
    expect(a.status).toBe("scheduled");
  });

  it("aborts the write when the in-lock check objects", async () => {
    const { doctor, patient } = await setup();
    await expect(
      storage.createAppointment(
        { patientId: patient.id, doctorId: doctor.id, serviceId: null, date: MON, startTime: "09:00", reason: null, durationMinutes: 20, price: 0 },
        ACTOR,
        () => "Bu vaqt band",
      ),
    ).rejects.toThrow("Bu vaqt band");
    expect(await storage.listAppointments({ date: MON })).toHaveLength(0);
  });

  it("passes the day's bookings to the check, so a clash can be seen", async () => {
    const { doctor, patient, book } = await setup();
    await book("09:00");
    let seen = 0;
    await storage.createAppointment(
      { patientId: patient.id, doctorId: doctor.id, serviceId: null, date: MON, startTime: "09:40", reason: null, durationMinutes: 20, price: 0 },
      ACTOR,
      (day) => {
        seen = day.length;
        return null;
      },
    );
    expect(seen).toBe(1);
  });

  it("checks in to today's visit, starts, completes — stamping each step", async () => {
    const { book } = await setup();
    const a = await book("09:00");
    const arrived = await storage.setAppointmentStatus(a.id, { from: "scheduled", to: "arrived" }, ACTOR);
    expect(arrived.arrivedAt).toBeTruthy();
    expect(arrived.visitId).toBeTruthy();
    const started = await storage.setAppointmentStatus(a.id, { from: "arrived", to: "in_progress" }, ACTOR);
    expect(started.startedAt).toBeTruthy();
    // Sent back to the waiting list and called again: arrival time is kept.
    const back = await storage.setAppointmentStatus(a.id, { from: "in_progress", to: "arrived" }, ACTOR);
    expect(back.arrivedAt).toBe(arrived.arrivedAt);
    await storage.setAppointmentStatus(a.id, { from: "arrived", to: "in_progress" }, ACTOR);
    const done = await storage.setAppointmentStatus(a.id, { from: "in_progress", to: "completed" }, ACTOR);
    expect(done.completedAt).toBeTruthy();
    expect(done.status).toBe("completed");
  });

  it("refuses a status change when someone else already moved it", async () => {
    const { book } = await setup();
    const a = await book("09:00");
    await storage.setAppointmentStatus(a.id, { from: "scheduled", to: "cancelled", reason: "Bemor qo'ng'iroq qildi" }, ACTOR);
    await expect(storage.setAppointmentStatus(a.id, { from: "scheduled", to: "arrived" }, ACTOR)).rejects.toThrow(/boshqa joyda/);
    const [row] = await storage.listAppointments({ date: MON });
    expect(row.cancelReason).toBe("Bemor qo'ng'iroq qildi");
    expect(row.cancelledBy).toBe(ACTOR.id);
  });

  it("an undone check-in clears the arrival", async () => {
    const { book } = await setup();
    const a = await book("09:00");
    await storage.setAppointmentStatus(a.id, { from: "scheduled", to: "arrived" }, ACTOR);
    const undone = await storage.setAppointmentStatus(a.id, { from: "arrived", to: "scheduled" }, ACTOR);
    expect(undone.arrivedAt).toBeNull();
    expect(undone.visitId).toBeNull();
  });

  it("moves a booking: same day keeps the ticket, another day gets a new one", async () => {
    const { book } = await setup();
    const a = await book("09:00");
    await book("09:00", undefined, "2026-11-16");
    const base = { doctorId: a.doctorId, durationMinutes: 20, serviceId: null, price: 100000, reason: null };
    const moved = await storage.rescheduleAppointment(a.id, { ...base, date: MON, startTime: "10:00" }, ACTOR, free);
    expect(moved.queueNumber).toBe(1);
    const nextWeek = await storage.rescheduleAppointment(a.id, { ...base, date: "2026-11-16", startTime: "10:00" }, ACTOR, free);
    expect(nextWeek.queueNumber).toBe(2);
    await storage.setAppointmentStatus(a.id, { from: "scheduled", to: "cancelled", reason: "xato" }, ACTOR);
    await expect(storage.rescheduleAppointment(a.id, { ...base, date: MON, startTime: "11:00" }, ACTOR, free)).rejects.toThrow(
      /yozildi/,
    );
  });

  it("filters by doctor, patient, status and 'before a day'", async () => {
    const { book, doctor, patient } = await setup();
    const a = await book("09:00", patient.id, "2026-11-02");
    await book("09:00");
    await storage.setAppointmentStatus(a.id, { from: "scheduled", to: "arrived" }, ACTOR);
    await storage.setAppointmentStatus(a.id, { from: "arrived", to: "in_progress" }, ACTOR);
    expect(await storage.listAppointments({ doctorId: doctor.id, beforeDate: MON, statuses: ["in_progress"] })).toHaveLength(1);
    const history = await storage.listAppointments({ patientId: patient.id });
    expect(history.map((x) => x.date)).toEqual([MON, "2026-11-02"]);
    expect(await storage.doctorHasAppointments(doctor.id)).toBe(true);
  });

  it("follows the patient on a merge and blocks deleting a card with history", async () => {
    const { book, patient } = await setup();
    const dup = await storage.createPatient({ fullName: "Aliyev Valijon", phone: "+998901111111", gender: "erkak", age: 40, address: null });
    await book("09:20", dup.id);
    const result = await storage.mergePatients(dup.id, patient.id);
    expect(result?.appointments).toBe(1);
    expect(await storage.listAppointments({ patientId: patient.id })).toHaveLength(1);
    await expect(storage.deletePatient(patient.id)).rejects.toThrow(/kartasida qabullar bor/);
  });

  it("counts a service's appointments", async () => {
    const { doctor, patient } = await setup();
    const svc = await storage.createService(
      { name: "Takroriy ko'rik", kind: "konsultatsiya", departmentId: null, price: 50000, durationMinutes: null, description: null, isActive: true },
      ACTOR,
    );
    await storage.createAppointment(
      { patientId: patient.id, doctorId: doctor.id, serviceId: svc.id, date: MON, startTime: "09:00", reason: null, durationMinutes: 20, price: 50000 },
      ACTOR,
      free,
    );
    expect((await storage.listServices())[0].appointmentCount).toBe(1);
    expect((await storage.listAppointments({ date: MON }))[0].serviceName).toBe("Takroriy ko'rik");
  });
});

describe("appointments on the patient card (B2.5 × B2.7)", () => {
  it("an attended appointment is a visit, shared with a lab order the same day", async () => {
    const user = await storage.createUser({ username: "dr7", password: "parol123", fullName: "Nazarov Olim", role: "shifokor", isActive: true });
    const doctor = await storage.createDoctor(
      { userId: user.id, departmentId: null, specialty: "Kardiolog", consultationPrice: 90000, slotMinutes: 20, schedule: [], isActive: true },
      ACTOR,
    );
    const patient = await storage.createPatient({ fullName: "Tursunov Akmal", phone: "+998907777777", gender: "erkak", age: 50, address: null });
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const day = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const booked = await storage.createAppointment(
      { patientId: patient.id, doctorId: doctor.id, serviceId: null, date: day, startTime: "09:00", reason: null, durationMinutes: 20, price: 90000 },
      ACTOR,
      () => null,
    );

    // Booked but not come: not a visit yet.
    let card = await storage.getPatientCard(patient.id);
    expect(card?.totals.visits).toBe(0);

    await storage.setAppointmentStatus(booked.id, { from: "scheduled", to: "arrived" }, ACTOR);
    card = await storage.getPatientCard(patient.id);
    expect(card?.totals.visits).toBe(1);
    expect(card?.visits[0].appointments).toHaveLength(1);
    expect(card?.totals.lastVisitAt).toBeTruthy();

    // A lab order the same day joins the same visit.
    const [test] = await storage.listTests();
    await storage.createOrder({ patientId: patient.id, testIds: [test.id], discount: 0, paidAmount: 0, createdBy: ACTOR.id });
    card = await storage.getPatientCard(patient.id);
    expect(card?.totals.visits).toBe(1);
    expect(card?.visits[0].orders).toHaveLength(1);
    expect(card?.visits[0].appointments).toHaveLength(1);

    const listed = (await storage.listPatients({ search: "Tursunov" })).items[0];
    expect(listed.visitCount).toBe(1);
    expect(listed.lastVisitAt).toBeTruthy();
  });
});

describe("examination records (B3.3, TZ §5.2)", () => {
  async function setup() {
    const user = await storage.createUser({ username: "dr5", password: "parol123", fullName: "Yusupova Nodira", role: "shifokor", isActive: true });
    const doctor = await storage.createDoctor(
      { userId: user.id, departmentId: null, specialty: "Terapevt", consultationPrice: 80000, slotMinutes: 20, schedule: [], isActive: true },
      ACTOR,
    );
    const patient = await storage.createPatient({ fullName: "Karimova Zarina", phone: "+998905555555", gender: "ayol", age: 34, address: null });
    const appt = await storage.createAppointment(
      { patientId: patient.id, doctorId: doctor.id, serviceId: null, date: "2026-11-09", startTime: "10:00", reason: null, durationMinutes: 20, price: 80000 },
      ACTOR,
      () => null,
    );
    const open = () =>
      storage.openRecord({ patientId: patient.id, appointmentId: appt.id, doctorId: doctor.id, visitId: null }, ACTOR);
    return { user, doctor, patient, appt, open };
  }

  it("opens one draft per appointment and joins names", async () => {
    const { open, appt } = await setup();
    const a = await open();
    const b = await open();
    expect(b.id).toBe(a.id);
    expect(a.status).toBe("draft");
    expect([a.version, a.revision]).toEqual([1, 0]);
    expect(a.patientName).toBe("Karimova Zarina");
    expect(a.doctorName).toBe("Yusupova Nodira");
    expect(a.date).toBe(appt.date);
    expect((await storage.getRecordByAppointment(appt.id))?.id).toBe(a.id);
  });

  it("saves a draft only at the revision it was based on", async () => {
    const { open } = await setup();
    const r = await open();
    const saved = await storage.saveRecordDraft(r.id, 0, { complaints: "Yo'tal" }, ACTOR);
    expect(saved.revision).toBe(1);
    expect(saved.complaints).toBe("Yo'tal");
    // A second tab still at revision 0 must not overwrite.
    await expect(storage.saveRecordDraft(r.id, 0, { complaints: "Boshqa matn" }, ACTOR)).rejects.toThrow(/boshqa oynada/);
    expect((await storage.getRecord(r.id))?.complaints).toBe("Yo'tal");
    // A partial save leaves the other fields alone.
    const next = await storage.saveRecordDraft(r.id, 1, { finalDiagnosis: "Bronxit" }, ACTOR);
    expect([next.complaints, next.finalDiagnosis]).toEqual(["Yo'tal", "Bronxit"]);
  });

  it("signing locks the record against draft saves", async () => {
    const { open } = await setup();
    const r = await open();
    await storage.saveRecordDraft(r.id, 0, { complaints: "Yo'tal", finalDiagnosis: "Bronxit" }, ACTOR);
    const signed = await storage.signRecord(r.id, 1, ACTOR);
    expect(signed.status).toBe("signed");
    expect(signed.signedAt).toBeTruthy();
    expect(signed.signedBy).toBe(ACTOR.id);
    await expect(storage.saveRecordDraft(r.id, signed.revision, { complaints: "x" }, ACTOR)).rejects.toThrow(/tasdiqlangan/);
    await expect(storage.signRecord(r.id, signed.revision, ACTOR)).rejects.toThrow(/tasdiqlangan/);
  });

  it("a correction keeps the replaced version, with who and why", async () => {
    const { open } = await setup();
    const r = await open();
    await storage.saveRecordDraft(r.id, 0, { complaints: "Yo'tal", finalDiagnosis: "Bronxit" }, ACTOR);
    const signed = await storage.signRecord(r.id, 1, ACTOR);
    const fields = { complaints: "Yo'tal", anamnesis: null, examination: null, preliminaryDiagnosis: null, finalDiagnosis: "O'tkir bronxit", recommendations: "Dam olish" };
    const amended = await storage.amendRecord(r.id, signed.revision, fields, "Tashxis aniqlashtirildi", ACTOR);
    expect(amended.version).toBe(2);
    expect(amended.status).toBe("signed");
    expect(amended.finalDiagnosis).toBe("O'tkir bronxit");
    expect(amended.amendReason).toBe("Tashxis aniqlashtirildi");

    const versions = await storage.listRecordVersions(r.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ version: 1, finalDiagnosis: "Bronxit", recommendations: null, replaceReason: "Tashxis aniqlashtirildi", replacedBy: ACTOR.id });

    // A stale revision (another tab) cannot correct over it.
    await expect(storage.amendRecord(r.id, signed.revision, fields, "yana", ACTOR)).rejects.toThrow(/boshqa oynada/);
  });

  it("refuses to correct a draft", async () => {
    const { open } = await setup();
    const r = await open();
    const fields = { complaints: "x", anamnesis: null, examination: null, preliminaryDiagnosis: "y", finalDiagnosis: null, recommendations: null };
    await expect(storage.amendRecord(r.id, 0, fields, "sabab bor", ACTOR)).rejects.toThrow(/tasdiqlangan yozuvga/);
  });

  it("lists by patient, doctor, status and appointment", async () => {
    const { open, doctor, patient, appt } = await setup();
    const r = await open();
    expect(await storage.listRecords({ doctorId: doctor.id, status: "draft" })).toHaveLength(1);
    expect(await storage.listRecords({ patientId: patient.id, status: "signed" })).toHaveLength(0);
    expect((await storage.listRecords({ appointmentIds: [appt.id] }))[0].id).toBe(r.id);
    expect(await storage.listRecords({ appointmentIds: [] })).toHaveLength(0);
  });
});

describe("allergies (B3.2)", () => {
  it("adds, lists and deactivates — never deletes", async () => {
    const patient = await storage.createPatient({ fullName: "Ergashev Sardor", phone: "+998906666666", gender: "erkak", age: 28, address: null });
    const a = await storage.addAllergy(patient.id, { allergen: "Penitsillin", reaction: "Toshma" }, ACTOR);
    await storage.addAllergy(patient.id, { allergen: "Yong'oq", reaction: null }, ACTOR);
    expect(await storage.listAllergies(patient.id)).toHaveLength(2);

    const off = await storage.deactivateAllergy(a.id, "Xato kiritilgan", ACTOR);
    expect(off).toMatchObject({ isActive: false, removeReason: "Xato kiritilgan", removedBy: ACTOR.id });
    await expect(storage.deactivateAllergy(a.id, "yana", ACTOR)).rejects.toThrow(/faol emas/);

    expect((await storage.listAllergies(patient.id)).map((x) => x.allergen)).toEqual(["Yong'oq"]);
    expect(await storage.listAllergies(patient.id, { includeInactive: true })).toHaveLength(2);
    await expect(storage.deletePatient(patient.id)).rejects.toThrow(/allergiya/);
  });

  it("follow the patient on a merge, with the examination records", async () => {
    const user = await storage.createUser({ username: "dr6", password: "parol123", fullName: "Olimov Bek", role: "shifokor", isActive: true });
    const doctor = await storage.createDoctor(
      { userId: user.id, departmentId: null, specialty: "LOR", consultationPrice: 70000, slotMinutes: 20, schedule: [], isActive: true },
      ACTOR,
    );
    const real = await storage.createPatient({ fullName: "Asosiy Bemor", phone: "+998901212121", gender: "erkak", age: 40, address: null });
    const dup = await storage.createPatient({ fullName: "Dublikat Bemor", phone: "+998903434343", gender: "erkak", age: 40, address: null });
    await storage.addAllergy(dup.id, { allergen: "Aspirin", reaction: null }, ACTOR);
    const appt = await storage.createAppointment(
      { patientId: dup.id, doctorId: doctor.id, serviceId: null, date: "2026-11-09", startTime: "10:00", reason: null, durationMinutes: 20, price: 0 },
      ACTOR,
      () => null,
    );
    await storage.openRecord({ patientId: dup.id, appointmentId: appt.id, doctorId: doctor.id, visitId: null }, ACTOR);
    await storage.mergePatients(dup.id, real.id);
    expect((await storage.listAllergies(real.id)).map((a) => a.allergen)).toEqual(["Aspirin"]);
    expect(await storage.listRecords({ patientId: real.id })).toHaveLength(1);
  });
});

describe("registratura day (TZ §4.1.1, B2.11)", () => {
  const today = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  it("counts today's patients, new cards and how today's bills stand", async () => {
    const empty = await storage.getReceptionDay(today());
    expect(empty.patientsToday).toBe(0);
    expect(empty.payments.orders).toBe(0);

    // Three orders today: settled, part-paid, unpaid. One more cancelled.
    const settled = await makeOrder(["3"]);
    await storage.addPayment(settled.order.id, { amount: settled.order.totalAmount, method: "naqd" }, ACTOR);
    const part = await makeOrder(["3", "22"], 10000);
    const unpaid = await makeOrder(["22"]);
    const cancelled = await makeOrder(["3"]);
    await storage.updateOrder(cancelled.order.id, { status: "cancelled" }, ACTOR);

    const day = await storage.getReceptionDay(today());
    expect(day.patientsToday).toBe(4); // a cancelled order's patient still came in
    expect(day.newPatients.total).toBe(4);
    expect(day.newPatients.latest[0].patientNumber).toBeGreaterThan(0);
    expect(day.payments).toMatchObject({ orders: 3, paid: 1, partial: 1, unpaid: 1 });

    const billed = settled.order.totalAmount + part.order.totalAmount + unpaid.order.totalAmount;
    expect(day.payments.billed).toBe(billed);
    expect(day.payments.collected).toBe(settled.order.totalAmount + 10000);
    expect(day.payments.due).toBe(billed - settled.order.totalAmount - 10000);
  });

  it("looks at the requested day only", async () => {
    await makeOrder(["3"], 5000);
    const other = await storage.getReceptionDay("2001-01-01");
    expect(other.patientsToday).toBe(0);
    expect(other.newPatients.total).toBe(0);
    expect(other.payments.orders).toBe(0);
  });
});

describe("referrals (B3.5, TZ §5.1.4)", () => {
  async function setup() {
    const user = await storage.createUser({ username: "drref", password: "parol123", fullName: "Rasulov Jamshid", role: "shifokor", isActive: true });
    const doctor = await storage.createDoctor(
      { userId: user.id, departmentId: null, specialty: "Terapevt", consultationPrice: 80000, slotMinutes: 20, schedule: [], isActive: true },
      ACTOR,
    );
    const cardUser = await storage.createUser({ username: "drkard", password: "parol123", fullName: "Nazarova Lola", role: "shifokor", isActive: true });
    const cardio = await storage.createDoctor(
      { userId: cardUser.id, departmentId: null, specialty: "Kardiolog", consultationPrice: 120000, slotMinutes: 20, schedule: [], isActive: true },
      ACTOR,
    );
    const patient = await storage.createPatient({ fullName: "Olimova Sevara", phone: "+998906666001", gender: "ayol", age: 41, address: null });
    const appt = await storage.createAppointment(
      { patientId: patient.id, doctorId: doctor.id, serviceId: null, date: "2026-11-09", startTime: "10:00", reason: null, durationMinutes: 20, price: 80000, referralId: null },
      ACTOR,
      () => null,
    );
    const origin = { patientId: patient.id, visitId: null, appointmentId: appt.id, doctorId: doctor.id, note: "Tashxisni aniqlash" };
    return { user, doctor, cardio, patient, appt, origin };
  }

  it("a lab referral creates its unpaid lab order, with the referral number on it", async () => {
    const { origin, user } = await setup();
    const [r] = await storage.createReferrals(
      { ...origin, kind: "lab", testIds: ["3", "22"], referrer: "Rasulov Jamshid, Terapevt" },
      { id: user.id, name: "Rasulov Jamshid" },
    );
    expect(r.referralNumber).toBe(1);
    expect(r.stage).toBe("in_lab");
    expect(r.order).toMatchObject({ status: "pending", paidAmount: 0, tests: 2, done: 0 });
    expect(r.doctorName).toBe("Rasulov Jamshid");

    const order = await storage.getOrder(r.order!.id);
    expect(order?.referralId).toBe(r.id);
    expect(order?.referralNumber).toBe(1);
    expect(order?.referrer).toBe("Rasulov Jamshid, Terapevt");
    expect(order?.notes).toBe("Tashxisni aniqlash");
    expect(order?.sample?.barcode).toBe(`LAB-${order!.orderNumber}`);

    // Entered results are not enough: the referral is done once the lab head verifies them (B4.5).
    await storage.saveResults(order!.id, order!.items.map((i) => ({ id: i.id, result: "5" })), ACTOR);
    expect((await storage.getReferral(r.id))?.stage).toBe("in_lab");
    await storage.verifyResults(order!.id, null, { id: "head", name: "Lab mudiri" });
    expect((await storage.getReferral(r.id))?.stage).toBe("done");
  });

  it("an exam referral per service waits for the desk, then follows its booking", async () => {
    const { origin, cardio, patient } = await setup();
    const svc = await storage.createService(
      { name: "UZI qorin", kind: "uzi", departmentId: null, price: 150000, durationMinutes: 30, description: null, isActive: true },
      ACTOR,
    );
    const svc2 = await storage.createService(
      { name: "EKG", kind: "boshqa", departmentId: null, price: 60000, durationMinutes: 15, description: null, isActive: true },
      ACTOR,
    );
    const made = await storage.createReferrals({ ...origin, kind: "exam", serviceIds: [svc.id, svc2.id] }, ACTOR);
    expect(made.map((r) => r.stage)).toEqual(["awaiting_booking", "awaiting_booking"]);
    expect((await storage.listReferrals({ awaitingBooking: true })).length).toBe(2);

    const r = made.find((x) => x.serviceId === svc.id)!;
    const book = () =>
      storage.createAppointment(
        { patientId: patient.id, doctorId: cardio.id, serviceId: svc.id, date: "2026-11-10", startTime: "09:00", reason: null, durationMinutes: 20, price: 150000, referralId: r.id },
        ACTOR,
        () => null,
      );
    const a = await book();
    expect(a.referralId).toBe(r.id);
    const now = await storage.getReferral(r.id);
    expect(now?.stage).toBe("scheduled");
    expect(now?.booking).toMatchObject({ id: a.id, date: "2026-11-10", startTime: "09:00" });
    expect((await storage.listReferrals({ awaitingBooking: true })).map((x) => x.id)).toEqual([made.find((x) => x.id !== r.id)!.id]);

    // The same referral cannot be booked twice.
    await expect(book()).rejects.toThrow(/allaqachon yozilgan/);

    // A cancelled booking frees it again.
    await storage.setAppointmentStatus(a.id, { from: "scheduled", to: "cancelled", reason: "boshqa kun" }, ACTOR);
    expect((await storage.getReferral(r.id))?.stage).toBe("awaiting_booking");
  });

  it("a consultation records the specialty and the doctor asked for", async () => {
    const { origin, cardio } = await setup();
    const [r] = await storage.createReferrals({ ...origin, kind: "consult", targetSpecialty: "Kardiolog", targetDoctorId: cardio.id }, ACTOR);
    expect(r).toMatchObject({ kind: "consult", targetSpecialty: "Kardiolog", targetDoctorName: "Nazarova Lola", stage: "awaiting_booking" });
  });

  it("cancelling never deletes; a lab referral cancels its untouched order, a paid one is refused", async () => {
    const { origin } = await setup();
    const [a] = await storage.createReferrals({ ...origin, kind: "lab", testIds: ["3"], referrer: "x" }, ACTOR);
    const cancelled = await storage.cancelReferral(a.id, "Bemor rad etdi", ACTOR);
    expect(cancelled).toMatchObject({ status: "cancelled", stage: "cancelled", cancelReason: "Bemor rad etdi" });
    expect((await storage.getOrder(a.order!.id))?.status).toBe("cancelled");
    await expect(storage.cancelReferral(a.id, "Yana", ACTOR)).rejects.toThrow(/allaqachon bekor/);

    const [b] = await storage.createReferrals({ ...origin, kind: "lab", testIds: ["3"], referrer: "x" }, ACTOR);
    await storage.addPayment(b.order!.id, { amount: 1000, method: "naqd" }, ACTOR);
    await expect(storage.cancelReferral(b.id, "Bemor rad etdi", ACTOR)).rejects.toThrow(/to'lov yoki natija bor/);
    expect((await storage.getReferral(b.id))?.status).toBe("active");
    expect(await storage.cancelReferral("nope", "x", ACTOR)).toBeUndefined();
  });

  it("a booked referral is cancelled only after its booking, and then cannot be booked", async () => {
    const { origin, cardio, patient } = await setup();
    const [r] = await storage.createReferrals({ ...origin, kind: "consult", targetSpecialty: "Kardiolog", targetDoctorId: null }, ACTOR);
    const mk = (date: string) =>
      storage.createAppointment(
        { patientId: patient.id, doctorId: cardio.id, serviceId: null, date, startTime: "11:00", reason: null, durationMinutes: 20, price: 120000, referralId: r.id },
        ACTOR,
        () => null,
      );
    const a = await mk("2026-11-11");
    await expect(storage.cancelReferral(r.id, "Kerak emas", ACTOR)).rejects.toThrow(/Avval qabulni bekor qiling/);
    await storage.setAppointmentStatus(a.id, { from: "scheduled", to: "cancelled", reason: "kerak emas" }, ACTOR);
    expect((await storage.cancelReferral(r.id, "Kerak emas", ACTOR))?.stage).toBe("cancelled");
    await expect(mk("2026-11-12")).rejects.toThrow(/bekor qilingan/);
  });

  it("lists by appointment and patient, newest first, and keeps the card from being deleted", async () => {
    const { origin, appt, patient } = await setup();
    await storage.createReferrals({ ...origin, kind: "consult", targetSpecialty: "Kardiolog", targetDoctorId: null }, ACTOR);
    await new Promise((r) => setTimeout(r, 5));
    await storage.createReferrals({ ...origin, kind: "lab", testIds: ["22"], referrer: "x" }, ACTOR);
    const byAppt = await storage.listReferrals({ appointmentId: appt.id });
    expect(byAppt.map((r) => r.kind)).toEqual(["lab", "consult"]);
    expect((await storage.listReferrals({ patientId: patient.id })).length).toBe(2);
    await expect(storage.deletePatient(patient.id)).rejects.toThrow(/kartasida/);
  });
});

describe("result verification (B4.5, TZ §6.1.5)", () => {
  const HEAD = { id: "head-1", name: "Laboratoriya mudiri" };
  const LAB = { id: "lab-1", name: "Laborant Bir" };

  async function entered() {
    const { order } = await makeOrder(["3", "22"]);
    const [a, b] = order.items;
    const saved = await storage.saveResults(order.id, [{ id: a.id, result: "5.2" }, { id: b.id, result: "140" }], LAB);
    return { order: saved!, a, b };
  }

  it("entered values wait for the lab head and stay out of 'ready'", async () => {
    const { order } = await entered();
    expect(order.status).toBe("completed");
    expect(order.items.every((i) => i.verifiedAt === null && i.enteredById === LAB.id)).toBe(true);
    const lists = await storage.listOrders({ queue: "review" });
    expect(lists.items.map((o) => o.id)).toContain(order.id);
    expect(lists.summary.results).toMatchObject({ review: 1, ready: 0 });
    expect((await storage.listOrders({ queue: "ready" })).items).toHaveLength(0);
    const stats = await storage.getDashboardStats();
    expect([stats.reviewTests, stats.readyTests]).toEqual([2, 0]);
  });

  it("verifying releases the order; a verified value is locked", async () => {
    const { order, a } = await entered();
    const out = await storage.verifyResults(order.id, null, HEAD);
    expect(out).toMatchObject({ verified: 2, selfChecked: 0 });
    expect(out!.order.items.every((i) => i.verifiedByName === HEAD.name && i.verifiedAt)).toBe(true);
    expect((await storage.listOrders({ queue: "ready" })).items.map((o) => o.id)).toEqual([order.id]);
    await expect(storage.saveResults(order.id, [{ id: a.id, result: "9.9" }], LAB)).rejects.toThrow(/tasdiqlangan/);
    // Re-saving the same values is not a change, so it is allowed.
    await expect(storage.saveResults(order.id, [{ id: a.id, result: "5.2" }], LAB)).resolves.toBeDefined();
    await expect(storage.verifyResults(order.id, null, HEAD)).rejects.toThrow(/kutayotgan natija yo'q/);
  });

  it("counts values the verifier entered themselves", async () => {
    const { order } = await makeOrder(["3"]);
    await storage.saveResults(order.id, [{ id: order.items[0].id, result: "5" }], HEAD);
    expect((await storage.verifyResults(order.id, null, HEAD))?.selfChecked).toBe(1);
  });

  it("verifies only the listed lines, and only ones waiting for review", async () => {
    const { order } = await makeOrder(["3", "22"]);
    const [a, b] = order.items;
    await storage.saveResults(order.id, [{ id: a.id, result: "5" }], LAB);
    await expect(storage.verifyResults(order.id, [b.id], HEAD)).rejects.toThrow(/kiritilmagan/);
    const out = await storage.verifyResults(order.id, [a.id], HEAD);
    expect(out?.verified).toBe(1);
    // Partly verified: still in the laborant's queue for the other line, not ready.
    expect((await storage.listOrders({ queue: "waiting" })).items.map((o) => o.id)).toContain(order.id);
    expect((await storage.listOrders({ queue: "ready" })).items).toHaveLength(0);
  });

  it("a returned value goes back to the laborant; re-entering it answers the return", async () => {
    const { order, a } = await entered();
    const back = await storage.returnResults(order.id, [a.id], "Qayta o'lchang", HEAD);
    const line = back!.items.find((i) => i.id === a.id)!;
    expect(line).toMatchObject({ returnReason: "Qayta o'lchang", returnedByName: HEAD.name, verifiedAt: null });
    expect((await storage.listOrders({ queue: "waiting" })).items.map((o) => o.id)).toContain(order.id);
    // A returned line cannot be verified until it is re-entered.
    await expect(storage.verifyResults(order.id, [a.id], HEAD)).rejects.toThrow(/qaytarilgan/);

    const fixed = await storage.saveResults(order.id, [{ id: a.id, result: "5.6" }], LAB);
    expect(fixed!.items.find((i) => i.id === a.id)).toMatchObject({ result: "5.6", returnedAt: null, returnReason: null });
    expect((await storage.verifyResults(order.id, null, HEAD))?.verified).toBe(2);
  });

  it("amending a verified value keeps the old one as a version", async () => {
    const { order, a } = await entered();
    const verified = (await storage.verifyResults(order.id, null, HEAD))!.order.items.find((i) => i.id === a.id)!;
    // Same value, same (auto-computed) flag, same note: nothing to amend.
    await expect(
      storage.amendResult(order.id, a.id, { result: "5.2", flag: verified.flag, notes: null }, "Hech narsa", HEAD),
    ).rejects.toThrow(/o'zgarmagan/);
    const out = await storage.amendResult(order.id, a.id, { result: "6.1", flag: "high", notes: null }, "Qayta o'lchandi", HEAD);
    expect(out?.previous).toEqual({ result: "5.2", version: 1 });
    const line = out!.order.items.find((i) => i.id === a.id)!;
    expect(line).toMatchObject({ result: "6.1", flag: "high", version: 2, verifiedByName: HEAD.name });
    const versions = await storage.listResultVersions(a.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ version: 1, result: "5.2", replaceReason: "Qayta o'lchandi", replacedByName: HEAD.name });
  });

  it("an unverified value is not amended — the laborant edits it", async () => {
    const { order, a } = await entered();
    await expect(storage.amendResult(order.id, a.id, { result: "1", flag: null, notes: null }, "Sabab yozildi", HEAD)).rejects.toThrow(
      /Faqat tasdiqlangan/,
    );
    expect(await storage.amendResult(order.id, "nope", { result: "1", flag: null, notes: null }, "Sabab yozildi", HEAD)).toBeUndefined();
  });

  it("an unchanged re-save does not move who entered the value or when", async () => {
    const { order, a } = await entered();
    const before = order.items.find((i) => i.id === a.id)!;
    await new Promise((r) => setTimeout(r, 5));
    const again = await storage.saveResults(order.id, [{ id: a.id, result: "5.2" }], { id: "other", name: "Boshqa" });
    const after = again!.items.find((i) => i.id === a.id)!;
    expect([after.enteredBy, after.completedAt]).toEqual([before.enteredBy, before.completedAt]);
  });
});

describe("notifications (B3.9)", () => {
  const notice = (userId: string, dedupeKey: string | null = null) => ({
    userId,
    kind: "lab_result" as const,
    title: "Tahlil natijalari tayyor",
    body: null,
    link: "/cabinet",
    entityId: null,
    important: false,
    dedupeKey,
  });

  it("raises a deduplicated notice once, newest first, per user", async () => {
    expect(await storage.createNotification(notice("dr1", "lab_result:o1"))).toBe(true);
    expect(await storage.createNotification(notice("dr1", "lab_result:o1"))).toBe(false);
    await storage.createNotification(notice("dr1"));
    await storage.createNotification(notice("dr2"));
    const feed = await storage.listNotifications("dr1", 20);
    expect(feed.unread).toBe(2);
    expect(feed.items).toHaveLength(2);
    expect((feed.items[0] as Record<string, unknown>).dedupeKey).toBeUndefined();
  });

  it("marks one or all as read, only the reader's own", async () => {
    await storage.createNotification(notice("dr1"));
    await storage.createNotification(notice("dr1"));
    const [first] = (await storage.listNotifications("dr1", 20)).items;
    expect(await storage.markNotificationRead("someone-else", first.id)).toBe(false);
    expect(await storage.markNotificationRead("dr1", first.id)).toBe(true);
    expect(await storage.markNotificationRead("dr1", first.id)).toBe(false);
    expect((await storage.listNotifications("dr1", 20)).unread).toBe(1);
    expect(await storage.markAllNotificationsRead("dr1")).toBe(1);
    expect((await storage.listNotifications("dr1", 20)).unread).toBe(0);
  });

  it("a lab referral carries its verified values for the doctor", async () => {
    const user = await storage.createUser({ username: "drres", password: "parol123", fullName: "Natija Shifokor", role: "shifokor", isActive: true });
    const doctor = await storage.createDoctor(
      { userId: user.id, departmentId: null, specialty: "Terapevt", consultationPrice: 1, slotMinutes: 20, schedule: [], isActive: true },
      ACTOR,
    );
    const patient = await storage.createPatient({ fullName: "Natija Bemor", phone: "+998906660099", gender: "erkak", age: 40, address: null });
    const [r] = await storage.createReferrals(
      { patientId: patient.id, visitId: null, appointmentId: null, doctorId: doctor.id, note: null, kind: "lab", testIds: ["3", "22"], referrer: "x" },
      ACTOR,
    );
    const order = (await storage.getOrder(r.order!.id))!;
    await storage.saveResults(order.id, [{ id: order.items[0].id, result: "5.5" }, { id: order.items[1].id, result: "7.0" }], ACTOR);
    // Entered but unchecked values do not reach the doctor.
    expect((await storage.getReferral(r.id))!.order!.results).toEqual([]);
    await storage.verifyResults(order.id, [order.items[0].id], { id: "head", name: "Mudir" });
    const partly = (await storage.getReferral(r.id))!.order!;
    expect(partly.results.map((x) => x.result)).toEqual(["5.5"]);
    expect([partly.verified, partly.tests]).toEqual([1, 2]);
  });
});

describe("MKB-10 catalogue and coded diagnoses (B3.4)", () => {
  it("finds codes by code prefix, by Russian words, and never offers headings or retired codes", async () => {
    const byCode = await storage.searchIcd({ q: "i10", limit: 10 });
    expect(byCode[0]).toMatchObject({ code: "I10", nameRu: "Эссенциальная [первичная] гипертензия", nameUz: null, selectable: true });
    const byWords = await storage.searchIcd({ q: "сахарный диабет 2", limit: 50 });
    // Words are matched within a name: the category carries "2 типа", its subdivisions do not.
    expect(byWords.map((r) => r.code)).toContain("E11");
    expect((await storage.searchIcd({ q: "I84", limit: 10 })).length).toBe(0); // retired
    expect((await storage.searchIcd({ q: "I84", limit: 10, all: true })).map((r) => r.code)).toContain("I84");
  });

  it("keeps the clinic's Uzbek names, searchable, and imports many at once", async () => {
    const row = await storage.setIcdUzName("I10", "Essensial (birlamchi) gipertenziya", ACTOR);
    expect(row?.nameUz).toBe("Essensial (birlamchi) gipertenziya");
    expect((await storage.searchIcd({ q: "birlamchi gipert", limit: 5 })).map((r) => r.code)).toEqual(["I10"]);
    expect(await storage.setIcdUzName("ZZZ", "x", ACTOR)).toBeUndefined();

    // Z99.99 is not a code: it is reported, never created.
    const out = await storage.importIcdUzNames(new Map([["E11.9", "2-tip qandli diabet, asoratsiz"], ["Q99.9", "Xromosoma anomaliyasi"], ["Z99.99", "yo'q kod"]]), ACTOR);
    expect(out).toEqual({ updated: 2, unknown: ["Z99.99"] });
    const stats = await storage.icdStats();
    expect(stats.withUzbek).toBeGreaterThanOrEqual(2);
    expect(stats.total).toBe(15038);

    await storage.setIcdUzName("I10", null, ACTOR);
    expect((await storage.getIcd(["I10"]))[0].nameUz).toBeNull();
  });

  it("stores diagnosis codes on the record and keeps them in versions", async () => {
    const user = await storage.createUser({ username: "dricd", password: "parol123", fullName: "Kod Shifokor", role: "shifokor", isActive: true });
    const doctor = await storage.createDoctor(
      { userId: user.id, departmentId: null, specialty: "Terapevt", consultationPrice: 1, slotMinutes: 20, schedule: [], isActive: true },
      ACTOR,
    );
    const patient = await storage.createPatient({ fullName: "Kod Bemor", phone: "+998906660777", gender: "erkak", age: 50, address: null });
    const appt = await storage.createAppointment(
      { patientId: patient.id, doctorId: doctor.id, serviceId: null, date: "2026-11-09", startTime: "10:00", reason: null, durationMinutes: 20, price: 1, referralId: null },
      ACTOR,
      () => null,
    );
    const rec = await storage.openRecord({ patientId: patient.id, appointmentId: appt.id, doctorId: doctor.id, visitId: null }, ACTOR);
    expect([rec.preliminaryDiagnosisCode, rec.finalDiagnosisCode]).toEqual([null, null]);
    const saved = await storage.saveRecordDraft(rec.id, rec.revision, { complaints: "Bosh og'rig'i", finalDiagnosis: "Gipertoniya", finalDiagnosisCode: "I10" }, ACTOR);
    expect(saved.finalDiagnosisCode).toBe("I10");
    const signed = await storage.signRecord(saved.id, saved.revision, ACTOR);
    const amended = await storage.amendRecord(
      signed.id,
      signed.revision,
      {
        complaints: "Bosh og'rig'i",
        anamnesis: null,
        examination: null,
        preliminaryDiagnosis: null,
        finalDiagnosis: "Gipertoniya, 2-daraja",
        recommendations: null,
        preliminaryDiagnosisCode: null,
        finalDiagnosisCode: "I11.9",
      },
      "Tashxis aniqlashtirildi",
      ACTOR,
    );
    expect(amended.finalDiagnosisCode).toBe("I11.9");
    const [v1] = await storage.listRecordVersions(amended.id);
    expect(v1.finalDiagnosisCode).toBe("I10");
  });
});

describe("lab catalogue groups and specimens (B4.6, B4.3)", () => {
  it("classifies the seed catalogue into TZ groups and specimens", async () => {
    const tests = await storage.listTests();
    const t = new Map(tests.map((x) => [x.id, x]));
    expect(t.get("1")).toMatchObject({ group: "gematologiya", sampleType: "qon_edta" });
    expect(t.get("44")).toMatchObject({ group: "diabet", sampleType: "qon_edta" });
    expect(t.get("45")).toMatchObject({ group: "koagulologiya", sampleType: "qon_sitrat" });
    expect(t.get("6")).toMatchObject({ group: "siydik", sampleType: "siydik" });
  });

  it("stores and edits a test's group and specimen", async () => {
    const created = await storage.createTest(
      { name: "Vitamin B12", price: 90000, category: "Vitaminlar", group: "biokimyo", sampleType: "qon_zardob", isActive: true },
      ACTOR,
    );
    expect(created).toMatchObject({ group: "biokimyo", sampleType: "qon_zardob" });
    const edited = await storage.updateTest(created.id, { group: "immunologiya" }, ACTOR);
    expect(edited).toMatchObject({ group: "immunologiya", sampleType: "qon_zardob" });
  });

  it("order lines keep the specimen they were drawn into, even if the catalogue changes", async () => {
    const { order } = await makeOrder(["1", "22", "6"]);
    expect(order.items.map((i) => i.sampleType).sort()).toEqual(["qon_edta", "qon_zardob", "siydik"]);
    await storage.updateTest("22", { sampleType: "qon_edta" }, ACTOR);
    const again = await storage.getOrder(order.id);
    expect(again!.items.find((i) => i.testId === "22")!.sampleType).toBe("qon_zardob");
  });

  it("records the specimen quality on reception and clears it on a step back", async () => {
    const { order } = await makeOrder(["3"]);
    await storage.updateSampleStatus(order.id, { status: "olindi" }, ACTOR);
    const got = await storage.updateSampleStatus(order.id, { status: "qabul_qilindi", quality: "gemoliz", qualityNote: "yengil" }, ACTOR);
    expect(got && "sample" in got && got.sample).toMatchObject({ quality: "gemoliz", qualityNote: "yengil" });
    const back = await storage.updateSampleStatus(order.id, { status: "olindi" }, ACTOR);
    expect(back && "sample" in back && back.sample).toMatchObject({ quality: null, qualityNote: null });
    const plain = await storage.updateSampleStatus(order.id, { status: "qabul_qilindi" }, ACTOR);
    expect(plain && "sample" in plain && plain.sample.quality).toBe("yaxshi");
  });

  it("a tube's own code finds its order", async () => {
    const { order } = await makeOrder(["1"]);
    expect((await storage.getOrderByBarcode(`LAB-${order.orderNumber}-E`))?.id).toBe(order.id);
  });
});

describe("inventory catalogue (B5.1)", () => {
  it("creates, lists, edits only what was sent, deletes", async () => {
    const a = await storage.createInventoryItem(
      { name: "Glyukoza reagenti", kind: "reagent", code: "R-001", manufacturer: "Human", unit: "to'plam", minStock: 2, salePrice: null, isActive: true, notes: null },
      ACTOR,
    );
    const b = await storage.createInventoryItem(
      { name: "Antiseptik", kind: "disinfectant", code: null, manufacturer: null, unit: "l", minStock: 1.5, salePrice: 30000, isActive: true, notes: null },
      ACTOR,
    );
    expect(a).toMatchObject({ kind: "reagent", unit: "to'plam", minStock: 2, createdBy: ACTOR.id });
    expect((await storage.listInventoryItems()).map((i) => i.name)).toEqual(["Antiseptik", "Glyukoza reagenti"]);
    const edited = await storage.updateInventoryItem(a.id, { minStock: 5, isActive: false }, ACTOR);
    expect(edited).toMatchObject({ minStock: 5, isActive: false, code: "R-001", manufacturer: "Human" });
    expect(edited!.updatedAt).toBeTruthy();
    // Inactive items sort after active ones.
    expect((await storage.listInventoryItems()).map((i) => i.id)).toEqual([b.id, a.id]);
    expect(await storage.deleteInventoryItem(b.id)).toBe(true);
    expect(await storage.deleteInventoryItem(b.id)).toBe(false);
    expect(await storage.updateInventoryItem("missing", { minStock: 1 }, ACTOR)).toBeUndefined();
  });
});

describe("quality control (B4.8)", () => {
  const setup = async () => {
    const material = await storage.createQcMaterial(
      { name: "Lyphochek Assayed Chemistry", manufacturer: "Bio-Rad", lotNumber: "26431", level: "1-daraja", expiresOn: "2027-06-30", notes: null, isActive: true },
      ACTOR,
    );
    const target = await storage.createQcTarget({ materialId: material.id, testId: "22", deviceId: null, mean: 5.5, sd: 0.2, unit: "mmol/l" }, ACTOR);
    return { material, target };
  };
  const at = (min: number) => new Date(Date.UTC(2026, 10, 7, 6, min)).toISOString();
  const run = (target: Awaited<ReturnType<typeof setup>>["target"], value: number, min: number) =>
    storage.addQcResult(target, { value, measuredAt: at(min), reagentLot: null, reagentExpiresOn: null, comment: null }, ACTOR);

  it("judges each run against the series and keeps the verdict", async () => {
    const { target } = await setup();
    expect(await run(target, 5.6, 0)).toMatchObject({ z: 0.5, status: "ok", rules: [], mean: 5.5, sd: 0.2 });
    expect(await run(target, 5.95, 1)).toMatchObject({ z: 2.25, status: "warning", rules: ["1-2s"] });
    // The second point beyond +2 SD completes 2-2s.
    const third = await run(target, 5.92, 2);
    expect(third).toMatchObject({ status: "reject", rules: ["1-2s", "2-2s"] });
    // Changing the target later does not rewrite what the run was told.
    await storage.updateQcTarget(target.id, { mean: 5.8 }, ACTOR);
    expect((await storage.getQcResult(third.id))!).toMatchObject({ mean: 5.5, status: "reject" });
    const list = await storage.listQcResults(target.id);
    expect(list.map((r) => r.value)).toEqual([5.6, 5.95, 5.92]);
  });

  it("back-dated runs are judged against the history before them; voided runs drop out", async () => {
    const { target } = await setup();
    const high = await run(target, 6.0, 10); // z 2.5
    await storage.voidQcResult(high.id, "Noto'g'ri namunadan o'lchangan", ACTOR);
    await expect(storage.voidQcResult(high.id, "yana", ACTOR)).rejects.toThrow(/allaqachon/);
    // With the voided run gone, a second +2.5 is only a warning, not 2-2s.
    expect((await run(target, 6.0, 11)).rules).toEqual(["1-2s"]);
    // A run dated before both sees neither.
    expect((await run(target, 6.0, 1)).rules).toEqual(["1-2s"]);
  });

  it("the board shows each series with its newest run and open rejections", async () => {
    const { target, material } = await setup();
    const bad = await run(target, 6.3, 0); // z 4 → 1-3s
    const board = await storage.getQcBoard("2026-11-07");
    const row = board.targets.find((t) => t.id === target.id)!;
    expect(board.materials.map((m) => m.id)).toContain(material.id);
    expect(row).toMatchObject({ testName: "Glyukoza", level: "1-daraja", lotNumber: "26431", runs: 1, runsToday: 1, openRejections: 1 });
    expect(row.lastResult).toMatchObject({ value: 6.3, status: "reject" });
    await storage.reviewQcResult(bad.id, "Reagent almashtirildi, qayta kalibrlandi", ACTOR);
    await expect(storage.reviewQcResult(bad.id, "yana", ACTOR)).rejects.toThrow(/allaqachon/);
    expect((await storage.getQcBoard("2026-11-07")).targets.find((t) => t.id === target.id)!.openRejections).toBe(0);
  });

  it("one series per material, test and device", async () => {
    const { material } = await setup();
    await expect(
      storage.createQcTarget({ materialId: material.id, testId: "22", deviceId: null, mean: 1, sd: 1, unit: null }, ACTOR),
    ).rejects.toThrow(/allaqachon/);
  });

  it("calibration, maintenance and external QC are logged with names", async () => {
    const device = await storage.createDevice(
      { name: "BS-240 Pro", manufacturer: "Mindray", model: null, serialNumber: null, direction: "biokimyo", connection: "manual", status: "active", location: null, installedOn: null, notes: null },
      ACTOR,
    );
    await storage.addCalibration(
      { deviceId: device.id, testId: "22", performedAt: null, calibratorName: "Multi Calibrator", calibratorLot: "C-77", calibratorExpiresOn: "2027-01-01", reagentLot: "R-12", reagentExpiresOn: "2027-02-01", result: "passed", notes: null },
      ACTOR,
    );
    await storage.addMaintenance({ deviceId: device.id, performedAt: null, kind: "weekly", description: "Kyuvetalar yuvildi", nextDueOn: "2026-11-14" }, ACTOR);
    const eqa = await storage.addEqa(
      { provider: "RIQAS", cycle: "2026-11", sampleCode: "S-3", testId: "22", deviceId: device.id, sampleDate: "2026-11-05", reportedValue: 6.1, assignedValue: 5.5, sdpa: 0.25, notes: null },
      ACTOR,
    );
    expect(eqa).toMatchObject({ z: 2.4, evaluation: "questionable" });
    expect((await storage.listCalibrations())[0]).toMatchObject({ deviceName: "BS-240 Pro", testName: "Glyukoza", result: "passed" });
    expect((await storage.listMaintenance({ deviceId: device.id }))[0]).toMatchObject({ kind: "weekly", deviceName: "BS-240 Pro" });
    expect((await storage.listEqa())[0]).toMatchObject({ testName: "Glyukoza", deviceName: "BS-240 Pro" });
    await storage.voidEqa(eqa.id, "Boshqa tsikl natijasi", ACTOR);
    expect((await storage.listEqa())[0].voidReason).toBe("Boshqa tsikl natijasi");
  });
});

describe("lab devices and their error log (B4.9)", () => {
  const device = (name = "BS-240 Pro") =>
    storage.createDevice(
      { name, manufacturer: "Mindray", model: name, serialNumber: null, direction: "biokimyo", connection: "manual", status: "active", location: "2-xona", installedOn: null, notes: null },
      ACTOR,
    );

  it("lists devices with what their log says", async () => {
    const d = await device();
    expect((await storage.listDevices())[0]).toMatchObject({ id: d.id, errorCount: 0, openErrors: 0, lastErrorAt: null });
    await storage.createDeviceError(d.id, { severity: "warning", message: "Reagent kam", markOutOfService: false, occurredAt: "2026-11-01T08:00:00.000Z" }, ACTOR);
    const e2 = await storage.createDeviceError(d.id, { severity: "error", code: "E-12", message: "Lampa xatosi", markOutOfService: false }, ACTOR);
    await storage.resolveDeviceError(e2!.id, "Lampa almashtirildi", ACTOR);
    const [row] = await storage.listDevices();
    expect(row).toMatchObject({ errorCount: 2, openErrors: 1 });
    expect(row.lastErrorAt).toBe(e2!.occurredAt);
    const log = await storage.listDeviceErrors({ deviceId: d.id });
    expect(log.map((e) => e.message)).toEqual(["Lampa xatosi", "Reagent kam"]);
    expect(log[0]).toMatchObject({ deviceName: "BS-240 Pro", reportedByName: ACTOR.name, resolvedByName: ACTOR.name, resolution: "Lampa almashtirildi" });
    expect((await storage.listDeviceErrors({ open: true })).map((e) => e.message)).toEqual(["Reagent kam"]);
  });

  it("a critical entry can take the device out of service in the same step", async () => {
    const d = await device("DH26");
    await storage.createDeviceError(d.id, { severity: "critical", message: "Nasos ishlamayapti", markOutOfService: true }, ACTOR);
    expect((await storage.getDevice(d.id))!.status).toBe("out_of_service");
    expect(await storage.createDeviceError("missing", { severity: "error", message: "x x x", markOutOfService: false }, ACTOR)).toBeUndefined();
  });

  it("an entry is closed once; a device with a log is not deleted", async () => {
    const d = await device("MAGLUMI 600");
    const e = await storage.createDeviceError(d.id, { severity: "error", message: "Kalibrlash xatosi", markOutOfService: false }, ACTOR);
    await storage.resolveDeviceError(e!.id, "Qayta kalibrlandi", ACTOR);
    await expect(storage.resolveDeviceError(e!.id, "yana", ACTOR)).rejects.toThrow(/allaqachon/);
    expect(await storage.resolveDeviceError("missing", "x", ACTOR)).toBeUndefined();
    await expect(storage.deleteDevice(d.id)).rejects.toThrow(/jurnali bor/);
    const clean = await device("BA-88A");
    expect(await storage.deleteDevice(clean.id)).toBe(true);
    expect(await storage.getDevice(clean.id)).toBeUndefined();
  });

  it("edits only what was sent", async () => {
    const d = await device("EIAQUANT");
    const edited = await storage.updateDevice(d.id, { status: "maintenance", connection: "rs232" }, ACTOR);
    expect(edited).toMatchObject({ status: "maintenance", connection: "rs232", location: "2-xona", manufacturer: "Mindray" });
    expect(edited!.updatedAt).toBeTruthy();
  });
});

describe("clinic logo (B4.7)", () => {
  it("is stored, replaced and removed, and survives a reload", async () => {
    expect(await storage.getLogo()).toBeNull();
    const logo = {
      dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
      mime: "image/png" as const,
      bytes: 16,
      updatedAt: new Date().toISOString(),
      updatedByName: "Admin",
    };
    await storage.setLogo(logo, ACTOR);
    expect(await storage.getLogo()).toEqual(logo);
    // The lab's own settings are untouched by the logo, and the reverse.
    const settings = await storage.getSettings();
    await storage.updateSettings({ ...settings, labName: "NEOGEN CLINIC" });
    expect(await storage.getLogo()).toEqual(logo);
    await storage.setLogo(null, ACTOR);
    expect(await storage.getLogo()).toBeNull();
  });
});

describe("lab board (B4.1)", () => {
  it("follows an order from the draw to release and counts cancellations", async () => {
    const day = todayKey();
    const empty = await storage.getLabBoard(day);

    const { order } = await makeOrder(["1", "22"]);
    let board = await storage.getLabBoard(day);
    expect(board.counts.today).toBe(empty.counts.today + 1);
    expect(board.counts.awaitingSample).toBe(empty.counts.awaitingSample + 1);
    expect(board.awaiting.some((o) => o.id === order.id)).toBe(true);
    expect(board.groupsToday.gematologiya).toBe((empty.groupsToday.gematologiya ?? 0) + 1);

    await storage.updateSampleStatus(order.id, { status: "olindi" }, ACTOR);
    await storage.updateSampleStatus(order.id, { status: "qabul_qilindi" }, ACTOR);
    board = await storage.getLabBoard(day);
    expect(board.counts.awaitingSample).toBe(empty.counts.awaitingSample);
    expect(board.counts.inProgress).toBe(empty.counts.inProgress + 1);
    expect(board.awaiting.some((o) => o.id === order.id)).toBe(false);

    const { order: cancelled } = await makeOrder(["6"]);
    await storage.updateOrder(cancelled.id, { status: "cancelled" }, ACTOR);
    board = await storage.getLabBoard(day);
    expect(board.counts.cancelledToday).toBe(empty.counts.cancelledToday + 1);
    expect(board.counts.today).toBe(empty.counts.today + 1);
  });
});

describe("orders by test group (B4.2)", () => {
  it("each order lists its groups in catalogue order, from the catalogue", async () => {
    const { order } = await makeOrder(["6", "1", "22"]);
    expect(order.groups).toEqual(["gematologiya", "biokimyo", "siydik"]);
    // Reclassifying a test reclassifies the orders that hold it.
    await storage.updateTest("6", { group: "boshqa" }, ACTOR);
    expect((await storage.getOrder(order.id))!.groups).toEqual(["gematologiya", "biokimyo", "boshqa"]);
  });

  it("filters by group and counts the chips with the group filter lifted", async () => {
    const { order: blood } = await makeOrder(["1"]);
    const { order: mixed } = await makeOrder(["1", "45"]);
    const { order: urine } = await makeOrder(["6"]);
    const all = await storage.listOrders();
    expect(all.summary.groups).toMatchObject({ gematologiya: 2, koagulologiya: 1, siydik: 1 });

    const coag = await storage.listOrders({ group: "koagulologiya" });
    expect(coag.items.map((o) => o.id)).toEqual([mixed.id]);
    expect(coag.summary.counts.all).toBe(1);
    // The chips still describe everything, so the user can switch group.
    expect(coag.summary.groups).toMatchObject({ gematologiya: 2, koagulologiya: 1, siydik: 1 });

    const hema = await storage.listOrders({ group: "gematologiya" });
    expect(hema.items.map((o) => o.id).sort()).toEqual([blood.id, mixed.id].sort());
    expect(hema.items.some((o) => o.id === urine.id)).toBe(false);
  });
});
