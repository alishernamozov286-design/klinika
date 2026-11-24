/**
 * B8.6 end-to-end test: one patient through each of the two paths of TZ §2,
 * every step done by the role that does it in the clinic, against a RUNNING
 * TEST SERVER.
 *
 *   Ambulator:  Bemor → Registratura → Shifokor → Laboratoriya → Natija → Shifokor → Davolash → Kassa
 *   Statsionar: Registratura → Statsionar → Shifokor → Laboratoriya → Ombor → Kassa → Chiqarish
 *
 * At each hand-over it checks that the next desk sees what the last one did,
 * that roles cannot do each other's work, that the money and the stock add up,
 * that the audit log has the step, and that the change feed (B8.1) moved.
 *
 * It creates its own staff, ward, stock and patients (names carry a run id, so
 * it can run again on the same server). Run it ONLY against a throwaway server:
 *
 *   DATABASE_URL="" TELEGRAM_BOT_TOKEN="" MEDLAB_TEST_DIR=/tmp/e2e PORT=5059 npx tsx server/index.ts
 *   npm run e2e                     # BASE=http://localhost:5059 by default
 */
const BASE = process.env.BASE ?? "http://localhost:5059";
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  console.error("Faqat mahalliy sinov serverida ishga tushiring (BASE localhost bo'lishi kerak)");
  process.exit(2);
}

const RUN = Date.now().toString(36).slice(-5);
let fails = 0;
let passes = 0;
const ok = (name, cond, extra) => {
  if (cond) passes++;
  else fails++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  → " + JSON.stringify(extra)?.slice(0, 400)}`);
  return cond;
};
const section = (title) => console.log(`\n— ${title}`);

/** One signed-in person: their own cookie jar. */
function client(label) {
  let cookie = "";
  const call = async (method, path, body) => {
    const r = await fetch(BASE + path, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = r.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const text = await r.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: r.status, body: json };
  };
  /** A step that must work; the test cannot go on without it. */
  const must = async (method, path, body, what) => {
    const r = await call(method, path, body);
    if (r.status >= 300) throw new Error(`${label}: ${what ?? `${method} ${path}`} → ${r.status} ${JSON.stringify(r.body)?.slice(0, 300)}`);
    return r.body;
  };
  return { call, must, label };
}
async function signIn(username, password = "pass12345") {
  const c = client(username);
  const r = await c.call("POST", "/api/login", { username, password });
  if (r.status !== 200) throw new Error(`login ${username}: ${r.status} ${JSON.stringify(r.body)}`);
  return c;
}

const pad = (n) => String(n).padStart(2, "0");
const dayOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeOf = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const today = dayOf(new Date());

/** Audit entries about one thing (newest page is enough: the test just wrote them). */
async function auditOf(admin, entityId) {
  const r = await admin.must("GET", "/api/audit?limit=500");
  return r.items.filter((e) => e.entityId === entityId);
}
async function feed(c) {
  return (await c.must("GET", "/api/changes")).versions;
}
const moved = (before, after, topic) => (after[topic] ?? 0) > (before[topic] ?? 0);

try {
  // ================================================================== the clinic
  section("Klinika: xodimlar, katalog, ombor");
  const admin = await signIn("admin", process.env.ADMIN_PASSWORD ?? "admin123");
  const staff = {};
  for (const [key, fullName, role] of [
    ["reg", "Registrator Lola", "registrator"],
    ["dr", "Shifokor Rahimova", "shifokor"],
    ["dr2", "Shifokor Karimov", "shifokor"],
    ["lab", "Laborant Aziz", "laborant"],
    ["mud", "Lab mudiri Nodira", "lab_mudiri"],
    ["omb", "Omborchi Botir", "omborchi"],
    ["ham", "Hamshira Dilnoza", "hamshira"],
    ["kas", "Kassir Madina", "kassir"],
  ]) {
    staff[key] = await admin.must("POST", "/api/users", { username: `${key}${RUN}`, password: "pass12345", fullName: `${fullName} ${RUN}`, role }, `user ${key}`);
  }
  const allWeek = [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, start: "00:00", end: "23:59" }));
  const dept = await admin.must("POST", "/api/departments", { name: `Terapiya ${RUN}`, kind: "statsionar" });
  const doctor = await admin.must("POST", "/api/doctors", { userId: staff.dr.id, departmentId: dept.id, specialty: "Terapevt", consultationPrice: 80000, slotMinutes: 5, schedule: allWeek });
  await admin.must("POST", "/api/doctors", { userId: staff.dr2.id, departmentId: dept.id, specialty: "Nevrolog", consultationPrice: 90000, slotMinutes: 5, schedule: allWeek });
  const ward = await admin.must("POST", "/api/wards", { departmentId: dept.id, name: `E2E-${RUN}`, floor: 1, gender: "mixed", dayPrice: 150000 });
  await admin.must("POST", `/api/wards/${ward.id}/beds`, { count: 2 });
  const tests = await admin.must("GET", "/api/tests");
  const [t1, t2] = tests.filter((t) => t.isActive !== false && t.price > 0);
  ok("catalogue has priced tests", Boolean(t1 && t2), tests.length);

  const reg = await signIn(`reg${RUN}`);
  const dr = await signIn(`dr${RUN}`);
  const dr2 = await signIn(`dr2${RUN}`);
  const lab = await signIn(`lab${RUN}`);
  const mud = await signIn(`mud${RUN}`);
  const omb = await signIn(`omb${RUN}`);
  const ham = await signIn(`ham${RUN}`);
  const kas = await signIn(`kas${RUN}`);

  // The warehouse: a reagent for the first test and a medicine in two batches (FEFO).
  const reagent = await omb.must("POST", "/api/inventory/items", { name: `Reagent ${RUN}`, kind: "reagent", unit: "ml", minStock: 0 });
  const medicine = await omb.must("POST", "/api/inventory/items", { name: `Seftriakson 1 g ${RUN}`, kind: "medicine", unit: "flakon", minStock: 0, salePrice: 12000, isActive: true });
  await omb.must("POST", "/api/inventory/receipts", {
    supplier: "Farm Distribyutor",
    receivedOn: today,
    lines: [
      { itemId: reagent.id, lotNumber: `R-${RUN}`, expiresOn: dayOf(addDays(new Date(), 300)), quantity: 100, purchasePrice: 1000 },
      { itemId: medicine.id, lotNumber: `LATE-${RUN}`, expiresOn: dayOf(addDays(new Date(), 400)), quantity: 10, purchasePrice: 8000 },
      { itemId: medicine.id, lotNumber: `SOON-${RUN}`, expiresOn: dayOf(addDays(new Date(), 60)), quantity: 5, purchasePrice: 7000 },
    ],
  });
  // Norm: the storekeeper proposes, the lab head approves (four eyes).
  const norm = await omb.must("POST", "/api/consumption/norms", { testId: t1.id, itemId: reagent.id, quantity: 2 });
  ok("storekeeper cannot approve a norm (403)", (await omb.call("POST", `/api/consumption/norms/${norm.id}/approve`)).status === 403);
  await mud.must("POST", `/api/consumption/norms/${norm.id}/approve`, {});
  const stockOf = async (itemId) => {
    const items = await omb.must("GET", "/api/inventory/items");
    return Number(items.find((i) => i.id === itemId)?.onHand);
  };
  ok("stock received: reagent 100, medicine 15", (await stockOf(reagent.id)) === 100 && (await stockOf(medicine.id)) === 15, [await stockOf(reagent.id), await stockOf(medicine.id)]);

  // ================================================================== 1. ambulatory
  section("1-sxema · Registratura");
  const v0 = await feed(admin);
  const patient = await reg.must("POST", "/api/patients", { fullName: `Ambulator Sevara ${RUN}`, phone: `+99890${String(Date.now()).slice(-7)}`, gender: "ayol", age: 34, address: null });
  ok("registrator: patient card with a number", patient.patientNumber > 0, patient);
  const slots = await reg.must("GET", `/api/doctors/${doctor.id}/slots?date=${today}`);
  const free = slots.slots.find((s) => s.available);
  const booked = await reg.must("POST", "/api/appointments", { patientId: patient.id, doctorId: doctor.id, date: today, startTime: free.startTime });
  ok("booked: queue number, no visit until they come", booked.queueNumber > 0 && booked.status === "scheduled" && !booked.visitId, booked);
  const appt = await reg.must("POST", `/api/appointments/${booked.id}/status`, { status: "arrived" });
  ok("arrived: the visit (and its bill) opens", Boolean(appt.visitId), appt);
  ok("change feed: the queue moved", moved(v0, await feed(admin), "appointments"));
  ok("cashier cannot book (403)", (await kas.call("POST", "/api/appointments", { patientId: patient.id, doctorId: doctor.id, date: today, startTime: free.startTime })).status === 403);

  section("1-sxema · Shifokor (ko'rik va yo'llanma)");
  const cabinet = await dr.must("GET", "/api/cabinet");
  ok("doctor's cabinet lists the arrived patient", JSON.stringify(cabinet).includes(appt.id), Object.keys(cabinet ?? {}));
  ok("another doctor cannot touch this visit (404)", (await dr2.call("POST", `/api/appointments/${appt.id}/status`, { status: "in_progress" })).status === 404);
  await dr.must("POST", `/api/appointments/${appt.id}/status`, { status: "in_progress" });
  let record = await dr.must("POST", `/api/appointments/${appt.id}/record`, {});
  record = await dr.must("PATCH", `/api/records/${record.id}`, {
    revision: record.revision,
    complaints: "Holsizlik, chanqash",
    anamnesis: "2 hafta davomida",
    examination: "Teri qoplamalari quruq",
    preliminaryDiagnosis: "Qandli diabetga shubha",
  });
  const made = await dr.must("POST", `/api/appointments/${appt.id}/referrals`, { kind: "lab", testIds: [t1.id, t2.id], note: "Och qoringa" });
  const referral = Array.isArray(made) ? made[0] : made;
  const orderId = referral.order?.id;
  ok("lab referral made an order at once", Boolean(orderId), referral);
  ok("laborant cannot write the record (403)", (await lab.call("PATCH", `/api/records/${record.id}`, { revision: record.revision, complaints: "x" })).status === 403);

  section("1-sxema · Laboratoriya");
  const board = await lab.must("GET", "/api/lab-board");
  ok("lab board shows the new order", JSON.stringify(board).includes(orderId));
  await lab.must("PATCH", `/api/orders/${orderId}/sample`, { status: "olindi" });
  await lab.must("PATCH", `/api/orders/${orderId}/sample`, { status: "qabul_qilindi" });
  let order = await lab.must("GET", `/api/orders/${orderId}`);
  const items = order.items ?? order.orderTests ?? [];
  ok("order carries both tests, linked to the visit", items.length === 2 && order.visitId === appt.visitId, { n: items.length, visit: order.visitId });
  const vLab = await feed(admin);
  await lab.must("POST", `/api/orders/${orderId}/results`, { results: items.map((it, i) => ({ id: it.id, result: i === 0 ? "9.8" : "5.1", flag: i === 0 ? "high" : "normal" })) });
  ok("laborant cannot verify (403)", (await lab.call("POST", `/api/orders/${orderId}/verify`, {})).status === 403);
  ok("doctor does not see unverified results as final", !(await dr.must("GET", `/api/notifications`)).items.some((n) => JSON.stringify(n).includes(orderId)));
  await mud.must("POST", `/api/orders/${orderId}/verify`, {});
  order = await lab.must("GET", `/api/orders/${orderId}`);
  ok("lab head verified: order completed, every line stamped", order.status === "completed" && order.items.every((i) => i.verifiedAt), { status: order.status });
  ok("change feed: lab and notifications moved", moved(vLab, await feed(admin), "lab") && moved(vLab, await feed(admin), "notifications"));
  ok("reagent spent by norm on verification: 100 → 98", (await stockOf(reagent.id)) === 98, await stockOf(reagent.id));

  section("1-sxema · Natija shifokorga → davolash");
  const notes = await dr.must("GET", "/api/notifications");
  const notice = notes.items.find((n) => n.kind === "lab_result" && n.entityId === orderId);
  ok("doctor notified once, linking back to the visit", notes.unread === 1 && Boolean(notice) && notice.link === `/cabinet/visit/${appt.id}`, notes.items.slice(0, 2));
  const exam = await dr.must("GET", `/api/appointments/${appt.id}/examination`);
  ok("examination view shows the result values", JSON.stringify(exam).includes("9.8"));
  record = await dr.must("GET", `/api/appointments/${appt.id}/examination`).then((e) => e.record ?? record);
  record = await dr.must("PATCH", `/api/records/${record.id}`, {
    revision: record.revision,
    finalDiagnosis: "Qandli diabet, 2-tur",
    recommendations: "Parhez, 2 haftadan keyin nazorat",
    prescriptions: [{ id: `rx-${RUN}`, kind: "medicine", itemId: null, serviceId: null, name: "Metformin 500 mg", dose: "500 mg", route: "oral", regimen: "kuniga 2 mahal ovqatdan keyin", days: 30, sessions: null, notes: null }],
  });
  ok("nurse cannot sign a record (403)", (await ham.call("POST", `/api/records/${record.id}/sign`, { revision: record.revision })).status === 403);
  const signed = await dr.must("POST", `/api/records/${record.id}/sign`, { revision: record.revision });
  ok("record signed and locked", signed.status === "signed" && (await dr.call("PATCH", `/api/records/${record.id}`, { revision: signed.revision, complaints: "x" })).status === 409, signed.status);
  await dr.must("POST", `/api/appointments/${appt.id}/status`, { status: "completed" });

  section("1-sxema · Kassa");
  const shift = (await kas.call("GET", "/api/cash-shifts/current")).body;
  if (!shift?.shift && !shift?.id) await kas.must("POST", "/api/cash-shifts", { openingCash: 0 });
  let bill = await kas.must("GET", `/api/bills/${appt.visitId}`);
  const expected = 80000 + t1.price + t2.price;
  ok(`one bill: consultation + 2 tests = ${expected}`, bill.totals.amount === expected && bill.lines.some((l) => l.source === "appointment") && bill.lines.some((l) => l.source === "order"), { totals: bill.totals, lines: bill.lines.map((l) => [l.source, l.amount]) });
  ok("laborant cannot take money (403)", (await lab.call("POST", `/api/bills/${appt.visitId}/payments`, { amount: 1000, method: "naqd" })).status === 403);
  await kas.must("POST", `/api/bills/${appt.visitId}/payments`, { amount: 50000, method: "naqd" });
  bill = await kas.must("GET", `/api/bills/${appt.visitId}`);
  ok("part-paid: owes the rest", bill.totals.due === expected - 50000 && bill.totals.status !== "paid", bill.totals);
  await kas.must("POST", `/api/bills/${appt.visitId}/payments`, { amount: bill.totals.due, method: "karta" });
  bill = await kas.must("GET", `/api/bills/${appt.visitId}`);
  ok("paid in full; two receipts, the bill numbered", bill.totals.due === 0 && bill.totals.status === "paid" && bill.receipts.length === 2 && bill.invoice?.number > 0, { totals: bill.totals, receipts: bill.receipts.length, invoice: bill.invoice });
  ok("overpaying refused", (await kas.call("POST", `/api/bills/${appt.visitId}/payments`, { amount: 1000, method: "naqd" })).status >= 400);
  const cur = await kas.must("GET", "/api/cash-shifts/current");
  const byMethod = cur.shift.totals.byMethod;
  ok("cash shift: 50 000 cash and the rest by card", byMethod.naqd.net === 50000 && byMethod.karta.net === expected - 50000, byMethod);

  // A desk order cancelled by mistake: only with a reason, and only by someone allowed to.
  const extra = await reg.must("POST", "/api/orders", { patientId: patient.id, testIds: [t2.id] });
  ok("registrar cannot cancel an order (403)", (await reg.call("PATCH", `/api/orders/${extra.id}`, { status: "cancelled", cancelReason: "Takroriy buyurtma" })).status === 403);
  ok("cancelling needs a reason (400)", (await mud.call("PATCH", `/api/orders/${extra.id}`, { status: "cancelled" })).status === 400);
  const cancelled = await mud.must("PATCH", `/api/orders/${extra.id}`, { status: "cancelled", cancelReason: "Takroriy buyurtma kiritilgan" });
  ok("cancelled with a reason, written to the audit log", cancelled.status === "cancelled" && (await auditOf(admin, extra.id)).some((e) => e.summary.includes("Takroriy buyurtma kiritilgan")));

  section("1-sxema · Audit");
  const auditAppt = await auditOf(admin, appt.id);
  const auditRecord = await auditOf(admin, record.id);
  const auditOrder = await auditOf(admin, orderId);
  ok("audit: booking and its statuses", auditAppt.length >= 3, auditAppt.map((e) => e.action));
  ok("audit: record opened, edited, signed", auditRecord.length >= 3 && auditRecord.some((e) => /tasdiqlandi/i.test(e.summary)), auditRecord.map((e) => e.summary));
  ok("audit: order — sample, results, verification", auditOrder.length >= 4 && auditOrder.some((e) => /tasdiq/i.test(e.summary)), auditOrder.map((e) => e.summary));
  ok("audit names the person who did it", auditAppt.some((e) => e.userName === `Registrator Lola ${RUN}`) && auditRecord.every((e) => e.userName === `Shifokor Rahimova ${RUN}`) && auditOrder.some((e) => e.userName === `Lab mudiri Nodira ${RUN}`));

  // ================================================================== 2. inpatient
  section("2-sxema · Registratura → Statsionar");
  const sick = await reg.must("POST", "/api/patients", { fullName: `Statsionar Bobur ${RUN}`, phone: `+99891${String(Date.now()).slice(-7)}`, gender: "erkak", age: 58, address: null });
  const wards = await reg.must("GET", "/api/wards");
  const myWard = wards.find((w) => w.id === ward.id);
  const bed = myWard.beds.find((b) => b.display === "ready");
  const vIn = await feed(admin);
  const stay = await reg.must("POST", "/api/admissions", { patientId: sick.id, bedId: bed.id, doctorId: doctor.id });
  ok("admitted: active stay on a visit", stay.status === "active" && Boolean(stay.visitId), stay);
  ok("the bed is taken: a second admission to it refused", (await reg.call("POST", "/api/admissions", { patientId: patient.id, bedId: bed.id, doctorId: doctor.id })).status >= 400);
  ok("change feed: inpatient moved", moved(vIn, await feed(admin), "inpatient"));

  section("2-sxema · Shifokor (kasallik tarixi, tayinlovlar, tahlil)");
  await dr.must("POST", `/api/admissions/${stay.id}/history`, { baseVersion: 0, complaints: "Yo'tal, isitma 38.6°C", anamnesis: "3 kun oldin shamollagan", examination: "O'pkada o'ngda nam xirillashlar", diagnosis: "O'ng tomonlama pnevmoniya", treatmentPlan: "Seftriakson 1 g v/i" });
  ok("cashier cannot write the case history (403)", (await kas.call("POST", `/api/admissions/${stay.id}/history`, { baseVersion: 1, complaints: "x" })).status === 403);
  await ham.must("POST", `/api/admissions/${stay.id}/observations`, { temperature: 38.4, pulse: 96, systolic: 125, diastolic: 80, note: "Kechki o'lchov" });
  const soon = new Date(Date.now() + 5 * 60_000);
  const rx = await dr.must("POST", `/api/admissions/${stay.id}/orders`, { kind: "medicine", itemId: medicine.id, name: "", dose: "1 g", route: "iv", times: [timeOf(soon)], issueQty: 1, startOn: dayOf(soon), days: 1 });
  ok("order planned one dose", (rx.tasks ?? []).length === 1 || rx.total === 1 || JSON.stringify(rx).includes(timeOf(soon)), rx);
  const stayLab = await dr.must("POST", `/api/admissions/${stay.id}/lab-orders`, { testIds: [t2.id], note: null });
  const stayOrderId = stayLab.id ?? stayLab.order?.id;
  ok("stay lab order made", Boolean(stayOrderId), stayLab);
  ok("nurse cannot prescribe (403)", (await ham.call("POST", `/api/admissions/${stay.id}/orders`, { kind: "procedure", name: "X", times: ["08:00"], startOn: today, days: 1 })).status === 403);

  section("2-sxema · Laboratoriya");
  await lab.must("PATCH", `/api/orders/${stayOrderId}/sample`, { status: "olindi" });
  await lab.must("PATCH", `/api/orders/${stayOrderId}/sample`, { status: "qabul_qilindi" });
  const so = await lab.must("GET", `/api/orders/${stayOrderId}`);
  await lab.must("POST", `/api/orders/${stayOrderId}/results`, { results: (so.items ?? []).map((it) => ({ id: it.id, result: "4.2", flag: "normal" })) });
  await mud.must("POST", `/api/orders/${stayOrderId}/verify`, {});
  const history = await dr.must("GET", `/api/admissions/${stay.id}/history`);
  ok("verified result reaches the case history", JSON.stringify(history).includes("4.2"));

  section("2-sxema · Ombor (hamshira dorini beradi)");
  const tasks = await ham.must("GET", `/api/procedure-tasks?day=${dayOf(soon)}&admissionId=${stay.id}`);
  const task = tasks.find((t) => t.orderId === rx.id) ?? tasks[0];
  ok("nurse's list has the dose", Boolean(task), tasks);
  ok("doctor cannot mark a dose (403)", (await dr.call("POST", `/api/procedure-tasks/${task.id}/done`, {})).status === 403);
  const done = await ham.must("POST", `/api/procedure-tasks/${task.id}/done`, { note: "Yaxshi o'tkazdi" });
  ok("dose given; one flakon left the shelf", done.status === "done" && done.stock?.posted === 1, done.stock);
  ok("medicine stock 15 → 14", (await stockOf(medicine.id)) === 14, await stockOf(medicine.id));
  const batches = await omb.must("GET", "/api/inventory/batches");
  const mine = batches.filter((b) => b.itemId === medicine.id);
  const soonB = mine.find((b) => b.lotNumber === `SOON-${RUN}`);
  const lateB = mine.find((b) => b.lotNumber === `LATE-${RUN}`);
  ok("FEFO: taken from the batch expiring first", soonB?.remaining === 4 && lateB?.remaining === 10, mine.map((b) => [b.lotNumber, b.remaining]));

  section("2-sxema · Kassa");
  // The cashier works from the bill; the stay's own charge card is for those who see the ward.
  ok("cashier does not open the ward's charge card (403)", (await kas.call("GET", `/api/admissions/${stay.id}/charge`)).status === 403);
  const charge = await reg.must("GET", `/api/admissions/${stay.id}/charge`);
  let sbill = await kas.must("GET", `/api/bills/${stay.visitId}`);
  const stayExpected = 150000 + 12000 + t2.price;
  ok(`stay bill: 1 bed-day + dose + test = ${stayExpected}`, sbill.totals.amount === stayExpected && sbill.lines.some((l) => l.source === "stay") && sbill.lines.some((l) => l.source === "order"), { totals: sbill.totals, lines: sbill.lines.map((l) => [l.source, l.amount, l.title]), charge });
  await kas.must("POST", `/api/bills/${stay.visitId}/payments`, { amount: sbill.totals.due, method: "naqd" });
  sbill = await kas.must("GET", `/api/bills/${stay.visitId}`);
  ok("stay paid in full", sbill.totals.due === 0 && sbill.totals.status === "paid", sbill.totals);

  section("2-sxema · Chiqarish");
  ok("discharge without an epicrisis refused", (await dr.call("POST", `/api/admissions/${stay.id}/discharge`, {})).status >= 400);
  const draft = await dr.must("GET", `/api/admissions/${stay.id}/epicrisis`);
  const draftJson = JSON.stringify(draft);
  // A normal result is summed up ("me'yor doirasida"); only abnormal ones are listed with their values.
  ok("epicrisis draft gathers the stay: diagnosis, dose given, lab result, vitals", draftJson.includes("pnevmoniya") && draftJson.includes("Seftriakson") && draftJson.includes("1 marta") && draftJson.includes("(1 ta natija), me'yor doirasida") && draftJson.includes("38.4"), draftJson.slice(0, 600));
  await dr.must("POST", `/api/admissions/${stay.id}/epicrisis`, { baseVersion: draft.version ?? 0, finalDiagnosis: "O'ng tomonlama pnevmoniya, tuzalish", epicrisis: "Davolash fonida isitma tushdi", recommendations: "Uyda 7 kun dam, nazorat rentgen" });
  ok("cashier cannot discharge (403)", (await kas.call("POST", `/api/admissions/${stay.id}/discharge`, {})).status === 403);
  const out = await dr.must("POST", `/api/admissions/${stay.id}/discharge`, {});
  ok("discharged", out.status === "discharged" && Boolean(out.dischargedAt), out.status);
  const wardAfter = (await reg.must("GET", "/api/wards")).find((w) => w.id === ward.id);
  const bedAfter = wardAfter.beds.find((b) => b.id === bed.id);
  ok("the bed is freed for cleaning", bedAfter.state === "cleaning" && bedAfter.occupant === null, bedAfter);
  const doc = await dr.call("GET", `/api/admissions/${stay.id}/epicrisis/document`);
  ok("epicrisis document available", doc.status === 200);
  const auditStay = await auditOf(admin, stay.id);
  ok("audit: admission, history, orders, dose, epicrisis, discharge", auditStay.length >= 6, auditStay.map((e) => e.summary));

  section("Yakun");
  const card = await reg.must("GET", `/api/patients/${sick.id}`);
  ok("one patient id across all modules", card.id === sick.id && stay.patientId === sick.id && so.patientId === sick.id);
} catch (err) {
  fails++;
  console.error("\nTO'XTADI:", err.message);
}
console.log(`\n${passes} o'tdi, ${fails} yiqildi`);
console.log(fails ? "FAILED" : "ALL PASSED");
process.exit(fails ? 1 : 0);
