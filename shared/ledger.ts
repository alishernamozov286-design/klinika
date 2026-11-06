/**
 * What may never be erased from the books (TZ §10, CLAUDE.md "Tibbiy
 * hujjatlar, natijalar va moliyaviy yozuvlar o'chirilmaydi").
 *
 * Both storage backends and the UI share these rules and messages, so the
 * file store and Postgres refuse the same writes in the same words.
 */

export const PAYMENT_ALREADY_VOIDED = "Bu to'lov allaqachon bekor qilingan";

export const TEST_IN_USE =
  "Bu tahlil buyurtmalarda ishlatilgan, uni o'chirib bo'lmaydi. Uni faolsizlantiring: katalogdan yo'qoladi, tarix saqlanadi.";

/** Why an order may not be deleted, or null when it is a plain data-entry mistake. */
export function orderDeleteProblem(paymentRows: number, resultLines: number): string | null {
  if (paymentRows > 0) {
    return "Buyurtmada to'lov yozuvlari bor, uni o'chirib bo'lmaydi. Buyurtmani bekor qiling: moliyaviy tarix saqlanadi.";
  }
  if (resultLines > 0) {
    return "Buyurtmada tahlil natijalari bor, uni o'chirib bo'lmaydi. Buyurtmani bekor qiling: natijalar saqlanadi.";
  }
  return null;
}

/** The paid total a ledger adds up to: voided rows no longer count. */
export function ledgerTotal(rows: { amount: number; voidedAt: string | null }[]): number {
  return rows.reduce((sum, p) => (p.voidedAt ? sum : sum + p.amount), 0);
}
