/**
 * Moliyaviy hisobot (B7.8, TZ §9.1, §13): the accountant's report of a period —
 * services rendered (accrual), money moved (cash), discounts, refunds,
 * expenses, profit, and what patients owe now. Shaping: shared/finance-report.ts.
 *
 *   reports.view   read it (rahbar, buxgalter, auditor)
 */
import type { Express } from "express";
import { buildFinanceReport } from "@shared/finance-report";
import { cashDays, cashTotal } from "@shared/cash-report";
import { summarizeDebt } from "@shared/debt";
import { requirePermission } from "./rbac";
import { dayRange, emptyIfMissing, handle, stringParam } from "./route-helpers";
import { storage } from "./storage";
import { todayKey } from "./storage-types";

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function registerFinanceRoutes(app: Express) {
  app.get(
    "/api/reports/finance",
    requirePermission("reports.view"),
    handle(async (req, res) => {
      const today = todayKey();
      const from = stringParam(req.query.from) ?? `${today.slice(0, 8)}01`;
      const to = stringParam(req.query.to) ?? today;
      const range = dayRange(from, to);
      if ("error" in range) return res.status(400).json({ message: range.error });
      if (addDays(from, 366) < to) return res.status(400).json({ message: "Davr ko'pi bilan bir yil bo'lishi mumkin" });
      const [services, cashRows, discountsGiven, expenses, debtors] = await Promise.all([
        storage.financeServices({ from, to }),
        storage.cashDayTotals(range),
        storage.countBillDiscounts(range).catch((e) => emptyIfMissing(e, 0)),
        storage.getExpenseSummary(from, to),
        storage.listDebtors().catch((e) => emptyIfMissing(e, [])),
      ]);
      const days = cashDays(cashRows, from, to);
      const debt = summarizeDebt(debtors, today);
      res.json(
        buildFinanceReport({
          range: { from, to },
          services,
          cash: cashTotal(days),
          days,
          discountsGiven,
          expenses: { total: expenses.total, count: expenses.count, byCategory: expenses.byCategory },
          debt: { due: debt.due, debtors: debt.debtors },
        }),
      );
    }),
  );
}
