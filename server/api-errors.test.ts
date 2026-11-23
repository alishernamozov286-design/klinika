import { describe, expect, it } from "vitest";
import { z } from "zod";
import { INTERNAL_ERROR, apiErrorResponse } from "./api-errors";
import { StorageConflict } from "./storage-types";

const pgError = (code: string, message: string) => Object.assign(new Error(message), { code, severity: "ERROR" });

describe("API errors (B8.7)", () => {
  it("passes validation and the app's own refusals through", () => {
    const zod = z.object({ a: z.string() }).safeParse({});
    expect(apiErrorResponse(zod.success ? null : zod.error)).toMatchObject({ status: 400 });
    expect(apiErrorResponse(new StorageConflict("Yotoqda bemor bor"))).toEqual({ status: 409, message: "Yotoqda bemor bor" });
    expect(apiErrorResponse(new Error("Kamida bitta tahlilni tanlang"))).toEqual({ status: 400, message: "Kamida bitta tahlilni tanlang" });
  });

  it("never shows a database's own error text", () => {
    const dup = apiErrorResponse(pgError("23505", 'duplicate key value violates unique constraint "UQ_users_username"'));
    expect(dup).toMatchObject({ status: 409, message: "Bunday yozuv allaqachon bor", log: true });
    expect(JSON.stringify(dup)).not.toMatch(/UQ_|constraint|duplicate/);
    expect(apiErrorResponse(pgError("23503", 'insert or update on table "payments" violates foreign key'))).toMatchObject({ status: 409 });
    expect(apiErrorResponse(pgError("23514", 'new row for relation "beds" violates check constraint "CK_beds_maintenance"'))).toMatchObject({ status: 400, message: "Ma'lumot talablarga mos emas" });
    const col = apiErrorResponse(pgError("42703", 'column "secret_column" does not exist'));
    expect(col).toEqual({ status: 500, message: INTERNAL_ERROR, log: true });
    expect(apiErrorResponse(pgError("42P01", 'relation "x" does not exist'))).toMatchObject({ status: 503 });
  });

  it("hides a driver's connection failure", () => {
    const out = apiErrorResponse(new Error("NeonDbError: fetch failed — ep-cool-host-123.neon.tech"));
    expect(out).toMatchObject({ status: 503, log: true });
    expect(out!.message).not.toMatch(/neon\.tech|ep-/);
  });

  it("keeps the body parser's refusals in Uzbek", () => {
    expect(apiErrorResponse({ type: "entity.too.large" })).toMatchObject({ status: 413 });
    expect(apiErrorResponse({ type: "entity.parse.failed" })).toMatchObject({ status: 400 });
    expect(apiErrorResponse("not an error")).toBeNull();
  });
});
