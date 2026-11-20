import { describe, expect, it } from "vitest";
import { MOVEMENT_KINDS } from "./inventory";
import { buildTurnover, fillDays, monthFigures, movementBucket, signedValue, summarizeDepartments, type MovementTotal } from "./inventory-reports";

describe("warehouse reports (B5.7, TZ §7.1)", () => {
  it("every movement kind has a column; a cancellation goes where its original went", () => {
    for (const k of MOVEMENT_KINDS) expect(movementBucket(k, "department")).toBeTruthy();
    expect(movementBucket("receipt_cancel")).toBe("receipt");
    expect(movementBucket("issue_cancel", "department")).toBe("department");
    expect(movementBucket("issue_cancel", "writeoff")).toBe("writeoff");
    expect(movementBucket("consumption_cancel")).toBe("consumption");
    expect(signedValue(-0.01, 180000)).toBe(-1800);
    expect(signedValue(2, 900)).toBe(1800);
  });

  it("the turnover sheet adds up: opening + in − out ± count = closing", () => {
    const items = [
      { id: "glu", name: "Glyukoza reagenti", unit: "to'plam", kind: "reagent" as const },
      { id: "tube", name: "Probirka", unit: "dona", kind: "tube" as const },
      { id: "idle", name: "Bint", unit: "dona", kind: "consumable" as const },
    ];
    const t = (itemId: string, bucket: MovementTotal["bucket"], period: MovementTotal["period"], quantity: number, value: number): MovementTotal => ({ itemId, bucket, period, quantity, value });
    const sheet = buildTurnover(items, [
      t("glu", "receipt", "before", 5, 500000),
      t("glu", "department", "before", -1, -100000),
      t("glu", "receipt", "in", 2, 220000),
      t("glu", "department", "in", -1.5, -150000),
      t("glu", "consumption", "in", -0.02, -2000),
      t("glu", "count", "in", -0.48, -48000),
      t("tube", "receipt", "in", 500, 450000),
      t("tube", "writeoff", "in", -20, -18000),
    ]);
    // Items that neither had nor moved anything are left out.
    expect(sheet.rows.map((r) => r.itemName)).toEqual(["Glyukoza reagenti", "Probirka"]);
    const glu = sheet.rows[0];
    expect(glu.opening).toEqual({ qty: 4, value: 400000 });
    expect(glu.department).toEqual({ qty: 1.5, value: 150000 });
    expect(glu.count).toEqual({ qty: -0.48, value: -48000 });
    expect(glu.closing).toEqual({ qty: 4, value: 400000 + 220000 - 150000 - 2000 - 48000 });
    expect(sheet.totals).toEqual({ opening: 400000, receipt: 670000, department: 150000, writeoff: 18000, consumption: 2000, count: -48000, closing: 420000 + 432000 });
  });

  it("fills quiet days and sums the month", () => {
    expect(fillDays("2026-11-28", "2026-12-02", [{ date: "2026-11-30", in: 5, out: 2 }])).toEqual([
      { date: "2026-11-28", in: 0, out: 0 },
      { date: "2026-11-29", in: 0, out: 0 },
      { date: "2026-11-30", in: 5, out: 2 },
      { date: "2026-12-01", in: 0, out: 0 },
      { date: "2026-12-02", in: 0, out: 0 },
    ]);
    expect(
      monthFigures([
        { itemId: "a", bucket: "receipt", period: "in", quantity: 1, value: 1000 },
        { itemId: "a", bucket: "department", period: "in", quantity: -1, value: -300 },
        { itemId: "a", bucket: "department", period: "before", quantity: -1, value: -999 },
      ]),
    ).toEqual({ receipt: 1000, department: 300, writeoff: 0, consumption: 0, count: 0 });
  });

  it("groups issues by department; a fully cancelled line disappears", () => {
    const r = summarizeDepartments([
      { departmentId: "lab", departmentName: "Laboratoriya", itemId: "glu", itemName: "Glyukoza", unit: "to'plam", quantity: 2, value: 200000, issueIds: ["i1", "i2"] },
      { departmentId: "lab", departmentName: "Laboratoriya", itemId: "tube", itemName: "Probirka", unit: "dona", quantity: 100, value: 90000, issueIds: ["i2"] },
      { departmentId: "pro", departmentName: "Muolaja", itemId: "glu", itemName: "Glyukoza", unit: "to'plam", quantity: 0, value: 0, issueIds: ["i3"] },
    ]);
    expect(r).toEqual([
      {
        departmentId: "lab",
        departmentName: "Laboratoriya",
        documents: 2,
        value: 290000,
        items: [
          { itemId: "glu", itemName: "Glyukoza", unit: "to'plam", quantity: 2, value: 200000 },
          { itemId: "tube", itemName: "Probirka", unit: "dona", quantity: 100, value: 90000 },
        ],
      },
    ]);
  });
});
