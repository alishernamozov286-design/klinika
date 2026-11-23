/**
 * B8.7 security smoke test: attacks a RUNNING TEST SERVER as nobody and as
 * each role — closed paths, writes outside the role, privilege escalation,
 * somebody else's things (IDOR), session fixation and replay, password
 * guessing, security headers, leaks in errors and user payloads.
 *
 * It creates its own users, ward and patients, so run it ONLY against a
 * throwaway server, never the clinic's database:
 *
 *   DATABASE_URL="" TELEGRAM_BOT_TOKEN="" MEDLAB_TEST_DIR=/tmp/sec PORT=5059 npx tsx server/index.ts
 *   node scripts/security-smoke.mjs            # BASE=http://localhost:5059 by default
 */
const BASE = process.env.BASE ?? "http://localhost:5059";
if (!/localhost|127\.0\.0\.1/.test(BASE)) {
  console.error("Faqat mahalliy sinov serverida ishga tushiring (BASE localhost bo'lishi kerak)");
  process.exit(2);
}
let fails = 0;
const ok = (n, c, x) => {
  if (!c) fails++;
  console.log(c ? "PASS " : "FAIL ", n, c ? "" : JSON.stringify(x)?.slice(0, 300));
};
const client = () => {
  let cookie = "";
  const call = async (method, path, body, extra = {}) => {
    const r = await fetch(BASE + path, { method, redirect: "manual", headers: { "content-type": "application/json", cookie, ...extra }, body: body ? JSON.stringify(body) : undefined });
    const set = r.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return { status: r.status, headers: r.headers, setCookie: set, body: await r.json().catch(() => null) };
  };
  return { call, get cookie() { return cookie; }, set cookie(v) { cookie = v; } };
};
const as = async (username, password = "pass12345") => {
  const c = client();
  const r = await c.call("POST", "/api/login", { username, password });
  if (r.status !== 200) throw new Error(`login ${username}: ${r.status} ${JSON.stringify(r.body)}`);
  return c;
};

// The test's own world: a department, a doctor, two wards, two patients, a user per role.
async function makeSeed(admin) {
  const must = (r, what) => {
    if (r.status >= 300) throw new Error(`${what}: ${r.status} ${JSON.stringify(r.body)}`);
    return r.body;
  };
  for (const [username, fullName, role] of [["reg8", "Registrator", "registrator"], ["ham8", "Hamshira", "hamshira"], ["kassa8", "Kassir", "kassir"]]) {
    must(await admin.call("POST", "/api/users", { username, password: "pass12345", fullName, role }), username);
  }
  const dept = must(await admin.call("POST", "/api/departments", { name: "Sinov statsionari", kind: "statsionar" }), "dept");
  const dr = must(await admin.call("POST", "/api/users", { username: "dr62", password: "pass12345", fullName: "Sinov Shifokor", role: "shifokor" }), "dr");
  must(await admin.call("POST", "/api/doctors", { userId: dr.id, departmentId: dept.id, specialty: "Terapevt", consultationPrice: 80000, slotMinutes: 20, schedule: [] }), "doctor");
  const w = must(await admin.call("POST", "/api/wards", { departmentId: dept.id, name: "101", floor: 1, gender: "mixed", dayPrice: 100000 }), "ward");
  must(await admin.call("POST", `/api/wards/${w.id}/beds`, { count: 2 }), "beds");
  const p1 = must(await admin.call("POST", "/api/patients", { fullName: "Sinov Bir", phone: "+998905550001", gender: "erkak", age: 40, address: null }), "p1");
  const p2 = must(await admin.call("POST", "/api/patients", { fullName: "Sinov Ikki", phone: "+998905550002", gender: "ayol", age: 35, address: null }), "p2");
  return { p1: p1.id, p2: p2.id };
}

try {
  const admin = await as("admin", process.env.ADMIN_PASSWORD ?? "admin123");
  const SEED = await makeSeed(admin);
  for (const [username, fullName, role] of [["lab8", "Laborant Nodira", "laborant"], ["omb8", "Omborchi Botir", "omborchi"]]) {
    await admin.call("POST", "/api/users", { username, password: "pass12345", fullName, role });
  }
  // Something of everyone's to aim at.
  const w101 = (await admin.call("GET", "/api/wards")).body.find((w) => w.name === "101");
  const doctorId = (await admin.call("GET", "/api/doctors?active=1")).body[0].id;
  const stay = (await admin.call("POST", "/api/admissions", { patientId: SEED.p2, bedId: w101.beds[0].id, doctorId })).body;
  const tests = (await admin.call("GET", "/api/tests")).body;
  const order = (await admin.call("POST", "/api/orders", { patientId: SEED.p1, testIds: [tests[0].id], discount: 0, paidAmount: 0 })).body;
  const users = (await admin.call("GET", "/api/users")).body;
  const adminUser = users.find((u) => u.username === "admin");
  const kassirUser = users.find((u) => u.username === "kassa8");

  // ------------------------------------------------------------ nobody signed in
  const anon = client();
  const closed = ["/api/patients", `/api/patients/${SEED.p1}`, `/api/patients/${SEED.p1}/medical`, "/api/orders", `/api/orders/${order.id}`, "/api/users", "/api/audit", "/api/bills", "/api/reports/finance", `/api/admissions/${stay.id}/history`, "/api/inventory/items", "/api/backup", "/api/stats", "/api/settings", "/api/roles", "/api/notifications", "/api/appointments?date=2026-11-23"];
  const anonResults = await Promise.all(closed.map((p) => anon.call("GET", p)));
  const leaked = closed.filter((_, i) => anonResults[i].status !== 401);
  ok(`anonymous: all ${closed.length} closed paths answer 401`, leaked.length === 0, leaked.map((p, i) => [p, anonResults[closed.indexOf(p)].status]));
  ok("anonymous: a write is refused too", (await anon.call("POST", "/api/patients", { fullName: "X", phone: "+998900000000" })).status === 401);

  // ------------------------------------------------------------ each role against what is not theirs
  const matrix = [
    ["kassa8", [`/api/patients/${SEED.p1}/medical`, `/api/admissions/${stay.id}/history`, `/api/admissions/${stay.id}/epicrisis`, "/api/users", "/api/audit", "/api/roles", "/api/inventory/items", "/api/reports/inpatient", "/api/backup", `/api/admissions/${stay.id}/orders`]],
    ["reg8", [`/api/patients/${SEED.p1}/medical`, `/api/admissions/${stay.id}/history`, "/api/users", "/api/audit", "/api/backup", "/api/inventory/items", "/api/consumption"]],
    ["ham8", ["/api/bills", "/api/reports/finance", "/api/users", "/api/audit", "/api/backup", `/api/admissions/${stay.id}/charge`, "/api/expenses"]],
    ["lab8", ["/api/bills", `/api/admissions/${stay.id}/history`, "/api/users", "/api/audit", "/api/reports/finance", "/api/wards", "/api/expenses"]],
    ["omb8", [`/api/patients/${SEED.p1}`, "/api/orders", `/api/patients/${SEED.p1}/medical`, "/api/bills", "/api/users", `/api/admissions/${stay.id}/history`]],
    ["dr62", ["/api/bills", "/api/users", "/api/audit", "/api/backup", `/api/admissions/${stay.id}/charge`, "/api/expenses", "/api/inventory/items"]],
  ];
  for (const [user, paths] of matrix) {
    const c = await as(user);
    const res = await Promise.all(paths.map((p) => c.call("GET", p)));
    const open = paths.map((p, i) => [p, res[i].status]).filter(([, st]) => st !== 403);
    ok(`${user}: ${paths.length} paths outside the role answer 403`, open.length === 0, open);
  }

  // ------------------------------------------------------------ writes outside the role
  const kassa = await as("kassa8");
  ok("cashier cannot admit, prescribe or discharge", (await kassa.call("POST", "/api/admissions", { patientId: SEED.p1, bedId: w101.beds[1].id, doctorId })).status === 403 && (await kassa.call("POST", `/api/admissions/${stay.id}/orders`, { kind: "procedure", name: "x", times: ["08:00"], startOn: "2030-01-01", days: 1 })).status === 403 && (await kassa.call("POST", `/api/admissions/${stay.id}/discharge`, {})).status === 403);
  const lab = await as("lab8");
  ok("lab cannot take money or give a discount", (await lab.call("POST", `/api/bills/${order.visitId}/payments`, { amount: 1000, method: "naqd" })).status === 403 && (await lab.call("POST", `/api/bills/${order.visitId}/discounts`, { mode: "amount", value: 1000, target: null, reason: "sinov uchun" })).status === 403);
  const ham = await as("ham8");
  ok("nurse cannot write the case history or delete a patient", (await ham.call("POST", `/api/admissions/${stay.id}/history`, { baseVersion: 0, complaints: "x" })).status === 403 && (await ham.call("DELETE", `/api/patients/${SEED.p1}`)).status === 403);

  // ------------------------------------------------------------ privilege escalation
  const reg = await as("reg8");
  ok("registrar cannot make anyone a super admin, nor create a role", (await reg.call("PATCH", `/api/users/${kassirUser.id}`, { role: "super_admin" })).status === 403 && (await reg.call("POST", "/api/roles", { key: "hack", name: "Hack", permissions: ["users.manage"] })).status === 403);
  const takeover = [
    ["PATCH", `/api/users/${adminUser.id}`, { password: "newpass12345" }],
    ["PATCH", `/api/users/${adminUser.id}`, { isActive: false }],
    ["POST", `/api/users/${adminUser.id}/unlock`, {}],
    ["POST", `/api/users/${adminUser.id}/mfa/reset`, { reason: "sinov uchun" }],
    ["POST", `/api/users/${adminUser.id}/sessions/revoke`, {}],
    ["DELETE", `/api/users/${adminUser.id}`, null],
  ];
  const tk = await Promise.all(takeover.map(([m, p, b]) => reg.call(m, p, b ?? undefined)));
  ok("registrar cannot touch the admin's account (password, block, unlock, 2FA, sessions, delete)", tk.every((r) => r.status === 403), takeover.map(([m, p], i) => [m, p.replace(adminUser.id, ":id"), tk[i].status]));
  ok("an extra field cannot smuggle a role into one's own password change", (await kassa.call("POST", "/api/user/password", { currentPassword: "pass12345", newPassword: "pass12345", role: "super_admin" })).status !== 500 && (await (await as("kassa8")).call("GET", "/api/user")).body.role === "kassir");

  // ------------------------------------------------------------ somebody else's things (IDOR)
  const admNotes = (await admin.call("GET", "/api/notifications")).body;
  const someNote = admNotes.items?.[0];
  if (someNote) ok("marking another user's notification read changes nothing", (await kassa.call("POST", `/api/notifications/${someNote.id}/read`)).body?.changed === false);
  else ok("no notification to aim at (skipped)", true);
  const adminSessions = (await admin.call("GET", "/api/sessions")).body;
  ok("closing another user's session is refused", (await kassa.call("DELETE", `/api/sessions/${adminSessions[0]?.id ?? "x"}`)).status === 404);
  ok("an unknown id is a clean 404, not a crash", (await admin.call("GET", "/api/admissions/does-not-exist")).status === 404 && (await admin.call("GET", "/api/orders/does-not-exist")).status === 404);

  // ------------------------------------------------------------ session
  const fresh = client();
  await fresh.call("GET", "/api/user");
  const before = fresh.cookie;
  const login = await fresh.call("POST", "/api/login", { username: "kassa8", password: "pass12345" });
  ok("the session cookie is HttpOnly and SameSite=Lax", /HttpOnly/i.test(login.setCookie ?? "") && /SameSite=Lax/i.test(login.setCookie ?? ""), login.setCookie);
  ok("a new session id at login (no fixation)", fresh.cookie && fresh.cookie !== before);
  const stolen = fresh.cookie;
  await fresh.call("POST", "/api/logout");
  const replay = client();
  replay.cookie = stolen;
  ok("after logout the old cookie is dead", (await replay.call("GET", "/api/patients")).status === 401);

  // ------------------------------------------------------------ guessing passwords
  const guess = client();
  let last = 0;
  for (let i = 0; i < 8; i++) last = (await guess.call("POST", "/api/login", { username: "reg8", password: `wrong-${i}` })).status;
  const right = await guess.call("POST", "/api/login", { username: "reg8", password: "pass12345" });
  ok("after repeated wrong passwords the account is locked even for the right one", right.status !== 200 && [423, 429, 401].includes(right.status), [last, right.status, right.body]);

  // ------------------------------------------------------------ headers and leaks
  const h = (await admin.call("GET", "/api/user")).headers;
  ok("security headers set, framework not advertised", h.get("x-content-type-options") === "nosniff" && h.get("x-frame-options") === "SAMEORIGIN" && h.get("referrer-policy") === "same-origin" && !h.get("x-powered-by"), Object.fromEntries(h.entries()));
  const page = await fetch(BASE + "/login");
  ok("the app's pages carry them too", page.headers.get("x-frame-options") === "SAMEORIGIN");
  const bad = await admin.call("POST", "/api/patients", "{not json");
  ok("a malformed body is a plain 400", bad.status === 400 && !/at |stack|node_modules/i.test(JSON.stringify(bad.body)), bad.body);
  const users2 = (await admin.call("GET", "/api/users")).body;
  ok("user lists never carry password hashes", users2.every((u) => !("password" in u)) && !JSON.stringify(users2).includes("scrypt"), Object.keys(users2[0] ?? {}));
  const me = (await kassa.call("GET", "/api/user")).body;
  ok("the session's own user carries no hash or MFA secret", !("password" in me) && !JSON.stringify(me).match(/secret|totp/i), Object.keys(me ?? {}));
} catch (e) {
  fails++;
  console.error("ERROR", e.message);
} finally {
  console.log(fails ? `FAILED: ${fails}` : "ALL PASSED");
  process.exit(fails ? 1 : 0);
}
