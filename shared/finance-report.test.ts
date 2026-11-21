import { describe, expect, it } from "vitest";
import { buildFinanceReport, type FinanceServiceRow } from "./finance-report";
import { cashDays, cashTotal } from "./cash-report";

const svc = (over: Partial<FinanceServiceRow>): FinanceServiceRow => ({ kind: "konsultatsiya", name: "Terapevt ko'rigi", doctorName: "Rahimova D.", count: 1, gross: 80000, discount: 0, net: 80000, paid: 80000, ...over });

describe("finance report (B7.8, TZ §9.1, §13)", () => {
  const days = cashDays([{ date: "2026-11-20", method: "naqd", taken: 300000, refunded: 20000, payments: 3, refunds: 1 }], "2026-11-20", "2026-11-21");
  const r = buildFinanceReport({
    range: { from: "2026-11-20", to: "2026-11-21" },
    services: [
      svc({ count: 2, gross: 160000, discount: 8000, net: 152000, paid: 152000 }),
      svc({ doctorName: "Karimov A.", name: "Terapevt ko'rigi", count: 1, gross: 80000, net: 80000, paid: 0 }),
      svc({ kind: "uzi", name: "Qorin bo'shlig'i UZI", doctorName: "Karimov A.", gross: 120000, net: 120000, paid: 100000 }),
      svc({ kind: "laboratoriya", name: "Laboratoriya tahlillari", doctorName: null, count: 4, gross: 300000, discount: 30000, net: 270000, paid: 200000 }),
    ],
    cash: cashTotal(days),
    days,
    discountsGiven: 2,
    expenses: { total: 50000, count: 1, byCategory: [{ category: "Reagent", amount: 50000, count: 1 }] },
    debt: { due: 170000, debtors: 2 },
  });

  it("services by kind in a fixed order, totals, what is still owed", () => {
    expect(r.services.byKind.map((k) => [k.kind, k.count, k.net, k.due])).toEqual([
      ["konsultatsiya", 3, 232000, 80000],
      ["uzi", 1, 120000, 20000],
      ["laboratoriya", 4, 270000, 70000],
    ]);
    expect(r.services.total).toEqual({ count: 8, gross: 660000, discount: 38000, net: 622000, paid: 452000, due: 170000 });
  });

  it("services and doctors, biggest first; lab work is no doctor's", () => {
    expect(r.services.byService.map((s) => [s.name, s.count, s.net])).toEqual([
      ["Laboratoriya tahlillari", 4, 270000],
      ["Terapevt ko'rigi", 3, 232000],
      ["Qorin bo'shlig'i UZI", 1, 120000],
    ]);
    expect(r.services.byDoctor.map((d) => [d.doctorName, d.count, d.net])).toEqual([
      ["Karimov A.", 2, 200000],
      ["Rahimova D.", 2, 152000],
    ]);
  });

  it("profit is cash net less expenses", () => {
    expect(r.result).toEqual({ collected: 280000, expenses: 50000, profit: 230000, margin: 82 });
    expect(r.discounts).toEqual({ total: 38000, given: 2 });
    expect(r.days).toHaveLength(2);
  });
});
