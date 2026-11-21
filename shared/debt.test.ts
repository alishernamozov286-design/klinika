import { describe, expect, it } from "vitest";
import { daysSince, debtAge, sortDebtors, summarizeDebt, type DebtorRow } from "./debt";

const row = (over: Partial<DebtorRow>): DebtorRow => ({ patientId: "p1", patientNumber: 1, patientName: "A", phone: null, bills: 1, due: 10000, oldest: "2026-11-21", latest: "2026-11-21", ...over });

describe("debt per patient (B7.3, TZ §9.1)", () => {
  it("age of a debt by its oldest unpaid visit", () => {
    expect(daysSince("2026-11-14", "2026-11-21")).toBe(7);
    expect(debtAge("2026-11-14", "2026-11-21")).toBe("week");
    expect(debtAge("2026-11-13", "2026-11-21")).toBe("month");
    expect(debtAge("2026-08-23", "2026-11-21")).toBe("quarter");
    expect(debtAge("2026-08-22", "2026-11-21")).toBe("older");
  });

  it("largest first, then the oldest; the summary by age", () => {
    const rows = sortDebtors([
      row({ patientId: "a", patientName: "Aliyev", due: 50000, oldest: "2026-11-20" }),
      row({ patientId: "b", patientName: "Bakirov", due: 120000, oldest: "2026-07-01", bills: 3 }),
      row({ patientId: "c", patientName: "Valiyev", due: 50000, oldest: "2026-10-01", bills: 2 }),
    ]);
    expect(rows.map((r) => r.patientId)).toEqual(["b", "c", "a"]);
    const s = summarizeDebt(rows, "2026-11-21");
    expect(s).toMatchObject({ debtors: 3, due: 220000, bills: 6 });
    expect(s.byAge).toEqual({ week: { debtors: 1, due: 50000 }, month: { debtors: 0, due: 0 }, quarter: { debtors: 1, due: 50000 }, older: { debtors: 1, due: 120000 } });
  });
});
