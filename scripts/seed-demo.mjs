/**
 * Demo ma'lumotlar: every page of the app filled with realistic data in every
 * state it can show — for a walkthrough, a demo to the clinic, or a check of
 * how the pages pass data to each other.
 *
 * Everything goes in through the API, done by the role that does it in the
 * clinic (the registrar registers, the doctor examines, the lab head verifies,
 * the cashier takes money…), so audit, notifications, bills, stock and the
 * change feed come out exactly as in real work.
 *
 * Run it ONLY against a throwaway server — medical and financial records
 * cannot be deleted, so demo data must never reach the clinic's database:
 *
 *   DATABASE_URL="" TELEGRAM_BOT_TOKEN="" MEDLAB_TEST_DIR=.demo PORT=5059 npx tsx server/index.ts
 *   npm run seed:demo                 # BASE=http://localhost:5059 by default
 *
 * Then sign in as any of the staff printed at the end (password: demo12345).
 * Run it once per fresh server: names are fixed, a second run stops at the
 * first duplicate user.
 */
const BASE = process.env.BASE ?? "http://localhost:5059";
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  console.error("Faqat mahalliy sinov serverida ishga tushiring (BASE localhost bo'lishi kerak)");
  process.exit(2);
}
const PASSWORD = "demo12345";

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
  const must = async (method, path, body) => {
    const r = await call(method, path, body);
    if (r.status >= 300) throw new Error(`${label}: ${method} ${path} → ${r.status} ${JSON.stringify(r.body)?.slice(0, 300)}`);
    return r.body;
  };
  return { call, must };
}
async function signIn(username, password = PASSWORD) {
  const c = client(username);
  const r = await c.call("POST", "/api/login", { username, password });
  if (r.status !== 200) throw new Error(`login ${username}: ${r.status} ${JSON.stringify(r.body)}`);
  return c;
}

const pad = (n) => String(n).padStart(2, "0");
const dayOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeOf = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const daysFrom = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};
const day = (n) => dayOf(daysFrom(n));
const today = day(0);
/** An instant `n` days (and `h` hours) ago. */
const ago = (n, h = 0) => new Date(Date.now() - n * 86_400_000 - h * 3_600_000).toISOString();
const step = (title) => console.log(`\n▸ ${title}`);
const done = (what) => console.log(`  ✓ ${what}`);
let phoneSeq = 1000000;
const phone = () => `+99890${String(++phoneSeq).padStart(7, "0")}`;

// ===================================================================== staff
step("Klinika va xodimlar");
const admin = await signIn("admin", process.env.ADMIN_PASSWORD ?? "admin123");
await admin.must("PUT", "/api/settings", {
  labName: "NEOGEN CLINIC",
  tagline: "Ko'p tarmoqli klinika va laboratoriya",
  address: "Toshkent sh., Chilonzor tumani, Bunyodkor ko'chasi, 12-uy",
  phone: "+998712001020",
  director: "Yusupov Akmal Bahodirovich",
  licenseNumber: "L-0451-2024",
});

const STAFF = [
  ["rahbar", "Yusupov Akmal", "rahbar"],
  ["reg1", "Karimova Lola", "registrator"],
  ["reg2", "Sodiqova Gulnora", "registrator"],
  ["terapevt", "Rahimova Dilfuza", "shifokor"],
  ["kardiolog", "Karimov Anvar", "shifokor"],
  ["nevrolog", "Tursunova Malika", "shifokor"],
  ["uzist", "Abdullayev Jasur", "shifokor"],
  ["statsionar", "Ergashev Bobur", "shifokor"],
  ["lab1", "Aliyev Aziz", "laborant"],
  ["lab2", "Hasanova Zarina", "laborant"],
  ["labmudir", "Nazarova Nodira", "lab_mudiri"],
  ["omborchi", "Qodirov Botir", "omborchi"],
  ["hamshira1", "Mirzayeva Dilnoza", "hamshira"],
  ["hamshira2", "Olimova Sevara", "hamshira"],
  ["kassa1", "Ismoilova Madina", "kassir"],
  ["kassa2", "To'xtayev Sardor", "kassir"],
  ["buxgalter", "Rasulov Sherzod", "buxgalter"],
  ["auditor", "Xolmatova Feruza", "auditor"],
];
const user = {};
for (const [username, fullName, role] of STAFF) user[username] = await admin.must("POST", "/api/users", { username, password: PASSWORD, fullName, role });
done(`${STAFF.length} xodim (har rol)`);

const dep = {};
for (const [key, name, kind, description] of [
  ["terapiya", "Terapiya", "ambulator", "Umumiy amaliyot va ichki kasalliklar"],
  ["kardio", "Kardiologiya", "ambulator", "Yurak-qon tomir kasalliklari"],
  ["nevro", "Nevrologiya", "ambulator", "Asab tizimi kasalliklari"],
  ["diag", "Diagnostika", "diagnostika", "UZI, EKG, EXO-KG"],
  ["lab", "Laboratoriya", "laboratoriya", "Klinik va biokimyoviy tahlillar"],
  ["stat", "Terapiya statsionari", "statsionar", "Kunduzgi va sutkalik statsionar"],
]) dep[key] = await admin.must("POST", "/api/departments", { name, kind, description });
done("6 bo'lim");

// Open late so the demo can be seeded (and today's queue shown) at any hour.
const week = (start, end, days = [1, 2, 3, 4, 5, 6, 7]) => days.map((d) => ({ day: d, start, end }));
const doc = {};
for (const [key, username, depKey, specialty, room, price] of [
  ["terapevt", "terapevt", "terapiya", "Terapevt", "101", 80000],
  ["kardiolog", "kardiolog", "kardio", "Kardiolog", "204", 120000],
  ["nevrolog", "nevrolog", "nevro", "Nevrolog", "206", 110000],
  ["uzist", "uzist", "diag", "UZI shifokori", "112", 0],
  ["statsionar", "statsionar", "stat", "Terapevt (statsionar)", "301", 90000],
]) doc[key] = await admin.must("POST", "/api/doctors", { userId: user[username].id, departmentId: dep[depKey].id, specialty, room, consultationPrice: price, slotMinutes: 10, schedule: week("07:00", "23:59") });
done("5 shifokor, ish jadvali bilan");

const svc = {};
for (const [key, name, kind, depKey, price, durationMinutes] of [
  ["uziQorin", "Qorin bo'shlig'i UZI", "uzi", "diag", 120000, 20],
  ["uziQalqon", "Qalqonsimon bez UZI", "uzi", "diag", 90000, 15],
  ["exokg", "Yurak EXO-KG", "uzi", "diag", 150000, 30],
  ["ekg", "EKG (elektrokardiogramma)", "boshqa", "diag", 50000, 10],
  ["tomchi", "Vena ichiga tomchi", "muolaja", "stat", 40000, 30],
  ["ukol", "Mushak ichiga in'eksiya", "muolaja", "terapiya", 15000, 5],
  ["massaj", "Davolovchi massaj", "muolaja", "nevro", 60000, 30],
]) svc[key] = await admin.must("POST", "/api/services", { name, kind, departmentId: dep[depKey].id, price, durationMinutes });
done("7 xizmat (UZI, EKG, muolajalar)");

const tests = (await admin.must("GET", "/api/tests")).filter((t) => t.price > 0);
const T = (re) => tests.find((t) => re.test(t.name)) ?? tests[0];
const tGlu = T(/glyukoza|glukoza/i);
const tCbc = T(/umumiy qon|qon tahlili/i);
const tAlt = T(/ALT|alanin/i);
const tChol = T(/xolesterin|cholest/i);
const tUrine = T(/siydik/i);
const tTsh = T(/TTG|TSH/i);
const tCrea = T(/kreatinin/i);
done(`laboratoriya katalogi: ${tests.length} ta narxli tahlil`);

const S = {};
for (const [username] of STAFF) S[username] = await signIn(username);

// ===================================================================== warehouse
step("Ombor");
const omb = S.omborchi;
const item = {};
for (const [key, name, kind, unit, minStock, extra] of [
  ["gluReag", "Glyukoza reagenti (GOD-PAP)", "reagent", "ml", 50, {}],
  ["altReag", "ALT reagenti", "reagent", "ml", 40, {}],
  ["cholReag", "Xolesterin reagenti", "reagent", "ml", 40, {}],
  ["cbcDil", "Gematologik dilyuent", "reagent", "ml", 500, {}],
  ["calib", "Multikalibrator", "calibrator", "flakon", 2, {}],
  ["control", "Nazorat zardobi (2 daraja)", "control", "flakon", 2, {}],
  ["tubeEdta", "Probirka EDTA (binafsha)", "tube", "dona", 200, {}],
  ["tubeGel", "Probirka gel (sariq)", "tube", "dona", 200, {}],
  ["syringe", "Shprits 5 ml", "syringe", "dona", 100, {}],
  ["gloves", "Qo'lqop (nitril)", "consumable", "juft", 100, {}],
  ["ceftri", "Seftriakson 1 g", "medicine", "flakon", 20, { salePrice: 12000 }],
  ["nacl", "Natriy xlorid 0,9% 200 ml", "medicine", "flakon", 30, { salePrice: 8000 }],
  ["diclo", "Diklofenak 75 mg/3 ml", "medicine", "ampula", 20, { salePrice: 5000 }],
  ["septo", "Septosept antiseptik", "disinfectant", "l", 5, {}],
]) item[key] = await omb.must("POST", "/api/inventory/items", { name, kind, unit, minStock, isActive: true, ...extra });
const line = (key, lot, expiresInDays, quantity, purchasePrice) => ({ itemId: item[key].id, lotNumber: lot, expiresOn: expiresInDays === null ? null : day(expiresInDays), quantity, purchasePrice });
await omb.must("POST", "/api/inventory/receipts", {
  supplier: "Med Reagent Servis MChJ", documentNumber: "YuX-2026/311", receivedOn: day(-20), notes: "Oylik reagent buyurtmasi",
  lines: [line("gluReag", "GL-2611", 240, 500, 900), line("altReag", "AL-2610", 180, 300, 1400), line("cholReag", "CH-2609", 25, 120, 1100), line("cbcDil", "DL-2611", 300, 5000, 60), line("calib", "MC-77", 120, 6, 180000), line("control", "QC-1", 90, 8, 150000)],
});
await omb.must("POST", "/api/inventory/receipts", {
  supplier: "Farm Distribyutor", documentNumber: "FD-4412", receivedOn: day(-7),
  lines: [line("ceftri", "CF-2701", 400, 60, 8000), line("ceftri", "CF-2612", 45, 15, 7500), line("nacl", "NC-2705", 500, 80, 5000), line("diclo", "DK-2702", 300, 50, 2500), line("syringe", "SH-01", 900, 400, 600), line("tubeEdta", "PE-55", 600, 500, 900), line("tubeGel", "PG-56", 600, 160, 1100), line("gloves", "QL-9", null, 300, 700), line("septo", "SP-3", 365, 12, 45000)],
});
done("2 kirim hujjati, 14 mahsulot (biri muddati yaqin, biri kam qolgan)");
await omb.must("POST", "/api/inventory/issues", { kind: "department", departmentId: dep.stat.id, receivedBy: "Mirzayeva Dilnoza", issuedOn: day(-3), lines: [{ itemId: item.syringe.id, quantity: 60 }, { itemId: item.gloves.id, quantity: 40 }, { itemId: item.septo.id, quantity: 2 }] });
await omb.must("POST", "/api/inventory/issues", { kind: "writeoff", reason: "damaged", issuedOn: day(-1), notes: "Tashishda singan", lines: [{ itemId: item.tubeGel.id, quantity: 12 }] });
done("bo'limga chiqim va hisobdan chiqarish");
const count = await omb.must("POST", "/api/inventory/counts", { countedOn: today, kinds: ["tube", "syringe", "consumable"], notes: "Oylik inventarizatsiya" });
const countDetail = await omb.must("GET", `/api/inventory/counts/${count.id}`);
const countLines = countDetail.lines ?? [];
await omb.must("PUT", `/api/inventory/counts/${count.id}/lines`, { entries: countLines.map((l, i) => ({ lineId: l.id, counted: Math.max(0, Number(l.expected ?? l.systemQuantity ?? l.bookQuantity ?? 0) - (i === 0 ? 3 : 0)) })) });
await omb.must("POST", `/api/inventory/counts/${count.id}/post`, {});
done("inventarizatsiya o'tkazildi (bitta kamomad bilan)");
for (const [test, key, quantity] of [[tGlu, "gluReag", 0.5], [tAlt, "altReag", 0.6], [tChol, "cholReag", 0.5], [tCbc, "cbcDil", 20]]) {
  const n = await omb.must("POST", "/api/consumption/norms", { testId: test.id, itemId: item[key].id, quantity });
  await S.labmudir.must("POST", `/api/consumption/norms/${n.id}/approve`, {});
}
done("4 reagent normasi (omborchi taklif qildi, lab mudiri tasdiqladi)");

// ===================================================================== lab equipment and QC
step("Analizatorlar va sifat nazorati");
const dev = {};
for (const [key, name, manufacturer, model, direction, connection, status, location] of [
  ["bio", "Biokimyoviy analizator", "Mindray", "BS-240", "biokimyo", "rs232", "active", "Lab, 2-xona"],
  ["hem", "Gematologik analizator", "Sysmex", "XN-350", "gematologiya", "tcp", "active", "Lab, 1-xona"],
  ["urine", "Siydik analizatori", "Dirui", "H-500", "siydik", "manual", "maintenance", "Lab, 3-xona"],
]) dev[key] = await admin.must("POST", "/api/devices", { name, manufacturer, model, serialNumber: `SN-${model}-0${Object.keys(dev).length + 1}`, direction, connection, status, location, installedOn: day(-400) });
const devErr = await S.lab1.must("POST", `/api/devices/${dev.bio.id}/errors`, { occurredAt: ago(2, 3), severity: "error", code: "E-217", message: "Kyuveta harorati me'yordan chiqdi", actionTaken: "Kyuvetalar yuvildi, qayta kalibrovka" });
await S.labmudir.must("POST", `/api/device-errors/${devErr.id}/resolve`, { resolution: "Servis muhandisi termostatni almashtirdi" });
await S.lab2.must("POST", `/api/devices/${dev.hem.id}/errors`, { severity: "warning", code: "W-04", message: "Dilyuent kam qoldi", actionTaken: null });
done("3 analizator, xatolar jurnali (biri hal qilingan, biri ochiq)");
const mat = await S.labmudir.must("POST", "/api/qc/materials", { name: "Bio-Rad Lyphochek", manufacturer: "Bio-Rad", lotNumber: "26341", level: "1-daraja (normal)", expiresOn: day(200) });
const target = await S.labmudir.must("POST", "/api/qc/targets", { materialId: mat.id, testId: tGlu.id, deviceId: dev.bio.id, mean: 5.5, sd: 0.2, unit: "mmol/l" });
const qcValues = [5.4, 5.6, 5.5, 5.3, 5.7, 5.5, 5.6, 5.4, 5.8, 5.5, 5.2, 5.6, 5.5, 5.9, 5.4, 6.2, 5.5, 5.6, 5.4, 5.5];
let violation = null;
for (let i = 0; i < qcValues.length; i++) {
  const r = await S.lab1.must("POST", `/api/qc/targets/${target.id}/results`, { value: qcValues[i], measuredAt: ago(qcValues.length - 1 - i, 1), reagentLot: "GL-2611" });
  if (qcValues[i] === 6.2) violation = r;
}
if (violation?.id) await S.labmudir.call("POST", `/api/qc/results/${violation.id}/review`, { correctiveAction: "Reagent yangilandi, nazorat qayta o'lchandi — me'yorda" });
await S.labmudir.must("POST", "/api/qc/calibrations", { deviceId: dev.bio.id, testId: tGlu.id, performedAt: ago(10), calibratorName: "Multikalibrator", calibratorLot: "MC-77", result: "passed" });
await S.labmudir.must("POST", "/api/qc/maintenance", { deviceId: dev.hem.id, performedAt: ago(1), kind: "daily", description: "Kunlik yuvish va fon tekshiruvi", nextDueOn: day(0) });
await S.labmudir.must("POST", "/api/qc/eqa", { provider: "Randox RIQAS", cycle: "2026-11", sampleCode: "RQ-11-04", testId: tGlu.id, deviceId: dev.bio.id, sampleDate: day(-12), reportedValue: 6.1, assignedValue: 6.0, sdpa: 0.25 });
done("QC: 20 kunlik Levey-Jennings (bitta 3SD buzilish ko'rib chiqilgan), kalibrovka, xizmat, EQA");

// ===================================================================== patients
step("Bemorlar");
const reg = S.reg1;
const P = {};
for (const [key, fullName, gender, age, address] of [
  ["sevara", "Aliyeva Sevara Rustamovna", "ayol", 34, "Chilonzor, 9-kvartal"],
  ["bobur", "Toshmatov Bobur Akramovich", "erkak", 58, "Yunusobod, 4-mavze"],
  ["gulnora", "Raximova Gulnora Ilhomovna", "ayol", 46, "Mirzo Ulug'bek tumani"],
  ["jasur", "Qodirov Jasur Shavkatovich", "erkak", 29, "Sergeli, 7-mavze"],
  ["malika", "Usmonova Malika Baxtiyorovna", "ayol", 63, "Olmazor tumani"],
  ["sardor", "Nurmatov Sardor Olimovich", "erkak", 41, "Yakkasaroy tumani"],
  ["dilnoza", "Ergasheva Dilnoza Farhodovna", "ayol", 25, "Shayxontohur tumani"],
  ["anvar", "Hamidov Anvar Toirovich", "erkak", 67, "Bektemir tumani"],
  ["kamola", "Saidova Kamola Anvarovna", "ayol", 38, "Uchtepa tumani"],
  ["otabek", "Yo'ldoshev Otabek Murodovich", "erkak", 52, "Mirobod tumani"],
  ["zuhra", "Karimova Zuhra Sobirovna", "ayol", 71, "Chilonzor, 19-kvartal"],
  ["shoxrux", "Azimov Shoxrux Baxromovich", "erkak", 19, "Yashnobod tumani"],
  ["nilufar", "Mahmudova Nilufar Akmalovna", "ayol", 31, "Yunusobod, 11-mavze"],
  ["rustam", "Xo'jayev Rustam Valiyevich", "erkak", 60, "Sergeli, 3-mavze"],
  ["madina", "Islomova Madina Rahimovna", "ayol", 8, "Chilonzor, 2-kvartal"],
  ["ulugbek", "Ganiyev Ulug'bek Hamroyevich", "erkak", 45, "Olmazor tumani"],
]) P[key] = await reg.must("POST", "/api/patients", { fullName, phone: phone(), gender, age, address });
for (const [key, allergen, reaction] of [["malika", "Penitsillin", "Toshma, qichishish"], ["anvar", "Aspirin", "Bronxospazm"], ["zuhra", "Yod", null]]) {
  await S.terapevt.call("POST", `/api/patients/${P[key].id}/allergies`, { allergen, reaction, severity: "moderate" });
}
done(`${Object.keys(P).length} bemor (bola va keksalar bilan), 3 tasida allergiya`);

// ===================================================================== ambulatory: queue, exams, referrals
step("Navbat va qabullar (bugun)");
const slotsLeft = {};
async function book(doctorKey, patientKey, opts = {}) {
  const d = doc[doctorKey];
  const date = opts.date ?? today;
  const k = `${doctorKey}|${date}`;
  if (!slotsLeft[k]) slotsLeft[k] = (await reg.must("GET", `/api/doctors/${d.id}/slots?date=${date}`)).slots.filter((s) => s.available).map((s) => s.startTime);
  const startTime = slotsLeft[k].shift();
  if (!startTime) throw new Error(`${doctorKey}: ${date} kuni bo'sh vaqt qolmadi`);
  return reg.must("POST", "/api/appointments", { patientId: P[patientKey].id, doctorId: d.id, serviceId: opts.serviceId ?? null, date, startTime, reason: opts.reason ?? null, referralId: opts.referralId ?? null });
}
const status = (a, s, who = reg, reason) => who.must("POST", `/api/appointments/${a.id}/status`, { status: s, reason });

/** A whole consultation: arrive, start, examine, (refer), sign, complete. */
async function examine(doctorKey, patientKey, text, opts = {}) {
  const D = S[doctorKey];
  let a = await book(doctorKey, patientKey, { reason: text.reason });
  a = await status(a, "arrived");
  await status(a, "in_progress", D);
  let rec = await D.must("POST", `/api/appointments/${a.id}/record`, {});
  rec = await D.must("PATCH", `/api/records/${rec.id}`, {
    revision: rec.revision,
    complaints: text.complaints,
    anamnesis: text.anamnesis,
    examination: text.examination,
    preliminaryDiagnosis: text.preliminary,
    ...(opts.sign ? { finalDiagnosis: text.final, recommendations: text.recommendations, prescriptions: text.prescriptions ?? [] } : {}),
  });
  const refs = [];
  for (const r of opts.referrals ?? []) refs.push(...[].concat(await D.must("POST", `/api/appointments/${a.id}/referrals`, r)));
  if (opts.sign) {
    rec = await D.must("POST", `/api/records/${rec.id}/sign`, { revision: rec.revision });
    if (opts.complete !== false) await status(a, "completed", D);
  }
  return { appt: a, record: rec, refs };
}
const rx = (id, name, dose, route, regimen, days, extra = {}) => ({ id, kind: "medicine", itemId: null, serviceId: null, name, dose, route, regimen, days, sessions: null, notes: null, ...extra });

const visits = {};
visits.sevara = await examine("terapevt", "sevara", {
  reason: "Holsizlik", complaints: "Holsizlik, tez-tez chanqash, kechasi siyishga turish", anamnesis: "Belgilar 1 oydan beri. Onasida qandli diabet.", examination: "Teri qoplamalari quruq. AQB 125/80, puls 78.", preliminary: "Qandli diabetga shubha",
  final: "Qandli diabet 2-tur, birinchi aniqlangan", recommendations: "Parhez №9, kunlik glyukometriya, 2 haftadan keyin nazorat", prescriptions: [rx("rx1", "Metformin 500 mg", "500 mg", "oral", "kuniga 2 mahal ovqatdan keyin", 30)],
}, { sign: true, referrals: [{ kind: "lab", testIds: [tGlu.id, tCbc.id, tAlt.id], note: "Och qoringa" }] });
visits.bobur = await examine("kardiolog", "bobur", {
  reason: "Ko'krakda og'riq", complaints: "Jismoniy zo'riqishda ko'krak ortida siquvchi og'riq", anamnesis: "Arterial gipertenziya 10 yil, chekadi", examination: "AQB 160/95, puls 88, yurak tonlari bo'g'iq", preliminary: "YuIK. Zo'riqish stenokardiyasi?",
  final: "YuIK. Zo'riqish stenokardiyasi, II FS. Arterial gipertenziya II daraja", recommendations: "Chekishni tashlash, tuzni cheklash", prescriptions: [rx("rx1", "Bisoprolol 5 mg", "5 mg", "oral", "ertalab 1 marta", 30), rx("rx2", "Atorvastatin 20 mg", "20 mg", "oral", "kechqurun 1 marta", 90)],
}, { sign: true, referrals: [{ kind: "lab", testIds: [tChol.id, tGlu.id, tCrea.id], note: null }, { kind: "exam", serviceIds: [svc.exokg.id], note: "Chap qorincha funksiyasi" }] });
visits.gulnora = await examine("nevrolog", "gulnora", {
  reason: "Bosh og'rig'i", complaints: "Bosh og'rig'i, bosh aylanishi, quloqda shovqin", anamnesis: "2 haftadan beri, stress bilan bog'laydi", examination: "Nevrologik statusda o'choqli belgilar yo'q", preliminary: "Tarangdlik tipidagi bosh og'rig'i",
  final: "Tarangdlik tipidagi surunkali bosh og'rig'i", recommendations: "Uyqu rejimi, massaj kursi", prescriptions: [{ id: "rx1", kind: "procedure", itemId: null, serviceId: svc.massaj.id, name: "Davolovchi massaj", dose: null, route: null, regimen: "kunora", days: null, sessions: 10, notes: "Bo'yin-yoqa sohasi" }],
}, { sign: true, referrals: [{ kind: "consult", targetSpecialty: "Kardiolog", targetDoctorId: doc.kardiolog.id, note: "AQB nazorati" }] });
visits.jasur = await examine("terapevt", "jasur", {
  reason: "Isitma", complaints: "Isitma 38°C, tomoq og'rig'i", anamnesis: "2 kundan beri", examination: "Tomoq giperemiyali, bodomsimon bezlar kattalashgan", preliminary: "O'tkir tonzillit",
}, { sign: false, referrals: [{ kind: "lab", testIds: [tCbc.id], note: "Cito" }] });
done("4 ko'rik: 3 tasi tasdiqlangan (davolash bilan), 1 tasi davom etmoqda; lab, EXO-KG va konsultatsiya yo'llanmalari");

// The rest of today's queue, in every state.
const waiting = [];
for (const [doctorKey, patientKey] of [["terapevt", "malika"], ["terapevt", "sardor"], ["kardiolog", "anvar"], ["nevrolog", "kamola"]]) waiting.push(await status(await book(doctorKey, patientKey), "arrived"));
await book("terapevt", "otabek");
await book("kardiolog", "zuhra", { reason: "Rejali nazorat" });
await book("nevrolog", "nilufar");
const noShow = await book("terapevt", "shoxrux");
await status(noShow, "no_show");
const cancelled = await book("kardiolog", "rustam");
await status(cancelled, "cancelled", reg, "Bemor qo'ng'iroq qilib bekor qildi");
// Referrals booked by the registrar: the EXO-KG and the cardiology consultation.
const exoRef = visits.bobur.refs.find((r) => r.kind === "exam");
const exo = await book("uzist", "bobur", { serviceId: svc.exokg.id, referralId: exoRef.id });
await status(exo, "arrived");
const consultRef = visits.gulnora.refs.find((r) => r.kind === "consult");
await book("kardiolog", "gulnora", { referralId: consultRef.id, reason: "Nevrolog yo'llanmasi" });
// Tomorrow and the day after.
for (const [doctorKey, patientKey, d] of [["terapevt", "ulugbek", 1], ["kardiolog", "otabek", 1], ["nevrolog", "madina", 2], ["uzist", "kamola", 1]]) await book(doctorKey, patientKey, { date: day(d), serviceId: doctorKey === "uzist" ? svc.uziQalqon.id : null });
done("bugungi navbat: kutayotgan 5, yozilgan 4, kelmagan 1, bekor 1; yo'llanma bo'yicha EXO-KG va konsultatsiya; ertangi 4 ta yozuv");

// ===================================================================== laboratory
step("Laboratoriya");
const lab = S.lab1;
const mud = S.labmudir;
const orderOf = (v, i = 0) => v.refs.filter((r) => r.kind === "lab")[i].order.id;
async function collect(orderId) {
  await lab.must("PATCH", `/api/orders/${orderId}/sample`, { status: "olindi" });
  await lab.must("PATCH", `/api/orders/${orderId}/sample`, { status: "qabul_qilindi" });
}
async function enter(orderId, values) {
  const o = await lab.must("GET", `/api/orders/${orderId}`);
  await lab.must("POST", `/api/orders/${orderId}/results`, { results: o.items.map((it, i) => ({ id: it.id, ...(values[i] ?? { result: "norma", flag: "normal" }) })) });
  return o;
}
// Sevara: verified, high glucose — her doctor is notified.
await collect(orderOf(visits.sevara));
await enter(orderOf(visits.sevara), [{ result: "9.8", flag: "high" }, { result: "Hb 128 g/l, L 6.4", flag: "normal" }, { result: "34", flag: "normal" }]);
await mud.must("POST", `/api/orders/${orderOf(visits.sevara)}/verify`, {});
// Bobur: verified, then one value amended with a reason.
const boburOrder = await (async () => {
  const id = orderOf(visits.bobur);
  await collect(id);
  const o = await enter(id, [{ result: "6.9", flag: "high" }, { result: "5.4", flag: "normal" }, { result: "98", flag: "normal" }]);
  await mud.must("POST", `/api/orders/${id}/verify`, {});
  await mud.must("POST", `/api/orders/${id}/items/${o.items[0].id}/amend`, { result: "6.7", flag: "high", notes: null, reason: "Qayta o'lchov natijasi kiritildi" });
  return id;
})();
// Jasur: results entered, waiting for verification.
await collect(orderOf(visits.jasur));
await enter(orderOf(visits.jasur), [{ result: "L 13.2, ECHT 28", flag: "high" }]);
// Walk-in orders made at the desk, in other states.
const walk = {};
walk.malika = await reg.must("POST", "/api/orders", { patientId: P.malika.id, testIds: [tTsh.id, tChol.id], referrer: "Tashqi klinika" });
await collect(walk.malika.id);
const mo = await enter(walk.malika.id, [{ result: "6.8", flag: "high" }, { result: "4.9", flag: "normal" }]);
await mud.must("POST", `/api/orders/${walk.malika.id}/return`, { itemIds: [mo.items[0].id], reason: "Gemoliz shubhasi, qayta o'lchansin" });
walk.dilnoza = await reg.must("POST", "/api/orders", { patientId: P.dilnoza.id, testIds: [tUrine.id, tCbc.id] });
await lab.must("PATCH", `/api/orders/${walk.dilnoza.id}/sample`, { status: "olindi" });
walk.shoxrux = await reg.must("POST", "/api/orders", { patientId: P.shoxrux.id, testIds: [tGlu.id] });
await lab.must("PATCH", `/api/orders/${walk.shoxrux.id}/sample`, { status: "olindi" });
await lab.must("PATCH", `/api/orders/${walk.shoxrux.id}/sample`, { status: "rad_etildi", rejectReason: "Gemoliz", rejectNote: "Qayta topshirish kerak" });
walk.nilufar = await reg.must("POST", "/api/orders", { patientId: P.nilufar.id, testIds: [tCbc.id, tAlt.id, tCrea.id] });
walk.ulugbek = await reg.must("POST", "/api/orders", { patientId: P.ulugbek.id, testIds: [tGlu.id, tChol.id] });
await collect(walk.ulugbek.id);
await enter(walk.ulugbek.id, [{ result: "5.1", flag: "normal" }, { result: "5.8", flag: "high" }]);
await mud.must("POST", `/api/orders/${walk.ulugbek.id}/verify`, {});
walk.rustam = await reg.must("POST", "/api/orders", { patientId: P.rustam.id, testIds: [tTsh.id] });
await S.labmudir.must("PATCH", `/api/orders/${walk.rustam.id}`, { status: "cancelled", cancelReason: "Bemor tahlildan rad etdi" });
await lab.must("POST", "/api/consumption", { itemId: item.gluReag.id, testId: tGlu.id, quantity: 2, reason: "repeat", note: "Gemoliz — qayta o'lchov" });
done("tahlillar: tasdiqlangan 3 (biri tuzatilgan), tasdiq kutayotgan 1, qayta o'lchashga qaytarilgan 1, namuna olingan 1, rad etilgan 1, yangi 1, bekor 1; reagent sarfi normadan va qo'shimcha");

// ===================================================================== inpatient
step("Statsionar");
const ward = {};
for (const [key, name, floor, gender, dayPrice, beds] of [["w301", "301", 3, "male", 180000, 3], ["w302", "302", 3, "female", 180000, 3], ["w303", "303 (lyuks)", 3, "mixed", 350000, 1]]) {
  ward[key] = await admin.must("POST", "/api/wards", { departmentId: dep.stat.id, name, floor, gender, dayPrice });
  await admin.must("POST", `/api/wards/${ward[key].id}/beds`, { count: beds });
}
const bedsOf = async (key) => (await admin.must("GET", "/api/wards")).find((w) => w.id === ward[key].id).beds;
const stays = {};
const admit = async (patientKey, wardKey, bedIndex, daysAgo, reason) => {
  const bed = (await bedsOf(wardKey))[bedIndex];
  return reg.must("POST", "/api/admissions", { patientId: P[patientKey].id, bedId: bed.id, doctorId: doc.statsionar.id, admittedAt: ago(daysAgo, 2), reason });
};
stays.anvar = await admit("anvar", "w301", 0, 4, "O'ng tomonlama pnevmoniya");
stays.rustam = await admit("rustam", "w301", 1, 2, "Gipertonik kriz");
stays.zuhra = await admit("zuhra", "w302", 0, 3, "Surunkali yurak yetishmovchiligi dekompensatsiyasi");
stays.malika = await admit("malika", "w302", 1, 7, "Qandli diabet dekompensatsiyasi");
// Transfer to the private room.
await reg.must("POST", `/api/admissions/${stays.rustam.id}/transfer`, { bedId: (await bedsOf("w303"))[0].id, note: "Bemor iltimosi bilan lyuks palataga" });
const D = S.statsionar;
const H = S.hamshira1;
const histories = {
  anvar: { complaints: "Yo'tal, balg'am, isitma 38.6°C", anamnesis: "5 kun oldin shamollagan. Aspiringa allergiya.", examination: "O'pkada o'ngda pastda nam xirillashlar", diagnosis: "O'ng tomonlama pastki bo'lak pnevmoniyasi", treatmentPlan: "Seftriakson 1 g v/i 2 mahal, ingalyatsiya" },
  rustam: { complaints: "Kuchli bosh og'rig'i, ko'ngil aynishi", anamnesis: "AQB 210/120 gacha ko'tarilgan", examination: "AQB 190/110, puls 92", diagnosis: "Gipertonik kriz, asoratlanmagan", treatmentPlan: "AQB nazorati, gipotenziv terapiya" },
  zuhra: { complaints: "Hansirash, oyoqlarda shish", anamnesis: "YuIK 15 yil", examination: "O'pka pastida krepitatsiya, oyoqlarda shish", diagnosis: "SYuE IIB, NYHA III", treatmentPlan: "Diuretiklar, suyuqlikni cheklash" },
  malika: { complaints: "Chanqash, holsizlik", anamnesis: "Qandli diabet 8 yil", examination: "Glyukoza 16 mmol/l", diagnosis: "Qandli diabet 2-tur, dekompensatsiya", treatmentPlan: "Insulin terapiyasi, parhez" },
};
for (const [k, h] of Object.entries(histories)) await D.must("POST", `/api/admissions/${stays[k].id}/history`, { baseVersion: 0, ...h });
for (const [k, readings] of Object.entries({
  anvar: [[3, 38.9, 104, 130, 85, 93], [2, 38.1, 96, 125, 80, 95], [1, 37.4, 84, 120, 80, 97], [0, 36.8, 76, 120, 75, 98]],
  rustam: [[1, 37.0, 92, 190, 110, 98], [0, 36.7, 80, 150, 90, 98]],
  zuhra: [[2, 36.9, 98, 140, 90, 91], [1, 36.8, 90, 135, 85, 93], [0, 36.6, 86, 130, 80, 95]],
  malika: [[1, 36.7, 80, 130, 80, 98], [0, 36.6, 78, 125, 80, 98]],
})) {
  for (const [daysAgo, temperature, pulse, systolic, diastolic, spo2] of readings) {
    await H.must("POST", `/api/admissions/${stays[k].id}/observations`, { observedAt: ago(daysAgo, daysAgo === 0 ? 0.5 : 4), temperature, pulse, systolic, diastolic, spo2, note: daysAgo === 0 ? "Holati barqaror" : null });
  }
}
// Orders: a dose due shortly (to give now), later ones today, and a course from yesterday (an overdue dose to mark missed).
const soon = new Date(Date.now() + 10 * 60_000);
const later = new Date(Date.now() + 90 * 60_000);
const sameDay = (d) => dayOf(d) === today;
const timesToday = [soon, later].filter(sameDay).map(timeOf);
const orderAnvar = await D.must("POST", `/api/admissions/${stays.anvar.id}/orders`, { kind: "medicine", itemId: item.ceftri.id, name: "", dose: "1 g", route: "iv", times: timesToday.length ? timesToday : ["08:00"], issueQty: 1, startOn: timesToday.length ? today : day(1), days: 5 });
await D.must("POST", `/api/admissions/${stays.anvar.id}/orders`, { kind: "procedure", serviceId: svc.tomchi.id, name: "", times: ["09:00"], startOn: day(1), days: 3 });
const orderZuhra = await D.must("POST", `/api/admissions/${stays.zuhra.id}/orders`, { kind: "medicine", itemId: item.nacl.id, name: "", dose: "200 ml", route: "iv", times: [timeOf(soon)], issueQty: 1, startOn: dayOf(soon), days: 3 });
await D.must("POST", `/api/admissions/${stays.rustam.id}/orders`, { kind: "medicine", itemId: item.diclo.id, name: "", dose: "75 mg", route: "im", times: [timeOf(soon)], issueQty: 1, startOn: dayOf(soon), days: 2 });
const tasksNow = await H.must("GET", `/api/procedure-tasks?day=${dayOf(soon)}`);
let given = 0;
for (const t of tasksNow.filter((t) => t.status === "planned" && Date.parse(t.plannedAt) - Date.now() < 30 * 60_000)) {
  if (t.orderId === orderZuhra.id) await H.must("POST", `/api/procedure-tasks/${t.id}/missed`, { reason: "Bemor tekshiruvda edi" });
  else {
    await H.must("POST", `/api/procedure-tasks/${t.id}/done`, { note: "Yaxshi o'tkazdi" });
    given++;
  }
}
await D.must("POST", `/api/admissions/${stays.anvar.id}/lab-orders`, { testIds: [tCbc.id, tCrea.id], note: "Davolash fonida nazorat" });
await D.must("POST", `/api/admissions/${stays.zuhra.id}/discharge-plan`, { date: day(2) });
await D.must("POST", `/api/admissions/${stays.anvar.id}/discharge-plan`, { date: day(1) });
// Malika is discharged today with an epicrisis.
const draft = await D.must("GET", `/api/admissions/${stays.malika.id}/epicrisis`);
await D.must("POST", `/api/admissions/${stays.malika.id}/epicrisis`, { baseVersion: draft.versionCount ?? 0, finalDiagnosis: "Qandli diabet 2-tur, subkompensatsiya", treatmentSummary: draft.draft?.treatmentSummary ?? null, epicrisis: (draft.draft?.epicrisis ?? "") + "\nDavolash fonida glyukoza 7-8 mmol/l gacha tushdi.", recommendations: "Endokrinolog nazorati, glyukometriya, parhez №9" });
await D.must("POST", `/api/admissions/${stays.malika.id}/discharge`, {});
// Bed states: one in maintenance; Malika's bed is now being cleaned.
await H.must("POST", `/api/beds/${(await bedsOf("w302"))[2].id}/state`, { state: "maintenance", note: "Karavot mexanizmi ta'mirda" });
done(`4 yotqizish (1 ko'chirilgan, 1 chiqarilgan epikriz bilan), kuzatuvlar, tayinlovlar, berilgan dozalar: ${given}, o'tkazib yuborilgan 1, yotoqlar: band, tozalashda, ta'mirda`);

// ===================================================================== cash desk
step("Kassa");
const k1 = S.kassa1;
const k2 = S.kassa2;
await k1.must("POST", "/api/cash-shifts", { openingCash: 200000 });
const pay = async (c, visitId, amount, method = "naqd") => {
  const bill = await c.must("GET", `/api/bills/${visitId}`);
  const a = amount === "all" ? bill.totals.due : Math.min(amount, bill.totals.due);
  if (a > 0) await c.must("POST", `/api/bills/${visitId}/payments`, { amount: a, method });
  return bill;
};
const visitOf = (v) => v.appt.visitId ?? v.appt.visit?.id;
await pay(k1, visitOf(visits.sevara), "all", "naqd");
await pay(k1, visitOf(visits.bobur), 150000, "karta"); // part-paid: a debtor
await S.rahbar.must("POST", `/api/bills/${visitOf(visits.gulnora)}/discounts`, { mode: "percent", value: 10, target: null, reason: "Nogironligi bor bemor (II guruh)" });
await pay(k1, visitOf(visits.gulnora), "all", "o'tkazma");
const ulugbekOrder = await reg.must("GET", `/api/orders/${walk.ulugbek.id}`);
await pay(k1, ulugbekOrder.visitId, "all", "naqd");
const malikaOrder = await reg.must("GET", `/api/orders/${walk.malika.id}`);
await pay(k1, malikaOrder.visitId, "all", "karta");
// The stay that ended is settled in full.
await pay(k1, stays.malika.visitId, "all", "karta");
await pay(k1, stays.anvar.visitId, 300000, "naqd"); // advance on a running stay
// A refund: a paid order cancelled leaves credit, asked back, approved by the head, paid out.
const refundOrder = await reg.must("POST", "/api/orders", { patientId: P.kamola.id, testIds: [tTsh.id] });
await pay(k1, refundOrder.visitId, "all", "naqd");
await S.labmudir.must("PATCH", `/api/orders/${refundOrder.id}`, { status: "cancelled", cancelReason: "Shifokor tahlilni bekor qildi" });
const refund = await k1.must("POST", `/api/bills/${refundOrder.visitId}/refunds`, { amount: tTsh.price, method: "naqd", reason: "Tahlil bekor qilindi, pul qaytariladi" });
await S.rahbar.must("POST", `/api/refunds/${refund.id ?? refund.refund?.id}/approve`, { note: "Tasdiqlandi" });
await k1.must("POST", `/api/refunds/${refund.id ?? refund.refund?.id}/pay`, {});
// One refund still waiting for the head.
const order2 = await reg.must("POST", "/api/orders", { patientId: P.otabek.id, testIds: [tUrine.id] });
await pay(k1, order2.visitId, "all", "naqd");
await S.labmudir.must("PATCH", `/api/orders/${order2.id}`, { status: "cancelled", cancelReason: "Takroriy buyurtma kiritilgan" });
await k1.must("POST", `/api/bills/${order2.visitId}/refunds`, { amount: tUrine.price, method: "naqd", reason: "Takroriy buyurtma bekor qilindi" });
// Second cashier: a short shift, already closed.
await k2.must("POST", "/api/cash-shifts", { openingCash: 0 });
const nilufarOrder = await reg.must("GET", `/api/orders/${walk.nilufar.id}`);
await pay(k2, nilufarOrder.visitId, 50000, "naqd");
const k2cur = await k2.must("GET", "/api/cash-shifts/current");
const expected = k2cur.shift.totals.expectedCash ?? k2cur.shift.totals.cashInDrawer ?? 50000;
await k2.must("POST", `/api/cash-shifts/${k2cur.shift.id}/close`, { countedCash: expected, carriedCash: 0, expectedCash: expected, note: "Smena yakunlandi" });
done("smena ochiq (kassir 1) va yopilgan (kassir 2); to'langan, qisman (qarzdorlar), chegirmali, statsionar avansi; qaytarish: to'langan va kutilayotgan");

// ===================================================================== expenses
step("Xarajatlar");
for (const [category, amount, method, payee, note, d] of [
  ["Ijara", 12000000, "o'tkazma", "Bunyodkor Savdo MChJ", "Noyabr oyi ijarasi", -22],
  ["Kommunal", 2350000, "o'tkazma", "Toshkent shahar elektr tarmoqlari", "Elektr energiyasi", -15],
  ["Reaktivlar", 4800000, "o'tkazma", "Med Reagent Servis MChJ", "YuX-2026/311 to'lovi", -19],
  ["Ish haqi", 38500000, "o'tkazma", "Xodimlar", "Oktyabr oyi ish haqi", -20],
  ["Jihoz", 1750000, "karta", "Texnomart", "Printer va kartrij", -9],
  ["Soliq", 5200000, "o'tkazma", "Davlat soliq qo'mitasi", "Oktyabr uchun", -5],
  ["Boshqa", 320000, "naqd", "Toza Makon", "Tozalash vositalari", -2],
]) await S.buxgalter.must("POST", "/api/expenses", { category, amount, method, payee, note, spentOn: day(d) });
done("7 xarajat oxirgi 3 haftada");

// ===================================================================== summary
console.log("\n══════════════════════════════════════════════════════════════");
console.log(" Demo tayyor. Har bir xodim paroli: " + PASSWORD + "   (admin: admin123)");
console.log("══════════════════════════════════════════════════════════════");
for (const [username, fullName, role] of STAFF) console.log(`  ${username.padEnd(11)} ${role.padEnd(12)} ${fullName}`);
console.log(`\n ${BASE}/login`);
