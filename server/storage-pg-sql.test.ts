/**
 * Guards a Postgres-only trap the JSON-store tests cannot see.
 *
 * In a single-table select Drizzle renders `${table.column}` without the table
 * name. Inside a correlated subquery that turns `ot.order_id = ${orders.id}`
 * into `ot.order_id = "id"`, which Postgres resolves to the subquery's own id
 * column: the condition silently matches nothing. It broke the results queue,
 * the patients' last-visit column and the department head counts before it was
 * caught on the real database.
 *
 * The rule this checks: inside `(SELECT …)` and `EXISTS (SELECT …)` in
 * storage-pg.ts, a comparison never takes an interpolated column on its
 * right-hand side. Write the qualified name ("orders"."id") instead.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(import.meta.dirname, "storage-pg.ts"), "utf8");

/** Every `(SELECT …)` span, matched up to its closing parenthesis. */
function subqueries(text: string): string[] {
  const spans: string[] = [];
  const re = /\(\s*SELECT\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    let depth = 0;
    for (let i = m.index; i < text.length; i++) {
      if (text[i] === "(") depth++;
      else if (text[i] === ")" && --depth === 0) {
        spans.push(text.slice(m.index, i + 1));
        break;
      }
    }
  }
  return spans;
}

describe("storage-pg correlated subqueries", () => {
  it("never compare against an interpolated outer column", () => {
    const offenders = subqueries(source).filter((q) => /(=|<>)\s*\$\{\s*[a-zA-Z]+\.[a-zA-Z]+\s*\}/.test(q));
    expect(offenders).toEqual([]);
  });

  it("finds the subqueries it is meant to guard", () => {
    // If this drops, the scanner stopped seeing them and the test above is vacuous.
    expect(subqueries(source).length).toBeGreaterThan(8);
  });
});
