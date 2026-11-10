# NEOGEN CLINIC — loyiha qo‘llanmasi va ish rejasi

Bu repo hozircha **MedLab** (laboratoriya + kassa tizimi). Maqsad uni **NEOGEN CLINIC** yagona klinika axborot tizimiga aylantirish.
Talablar manbai: [docs/TZ.md](docs/TZ.md), buyurtmachining texnik topshirig‘i (o‘zgartirilmagan matn). **TZ — yagona haqiqat manbai.** Har bir vazifa TZ bo‘limiga havola qiladi (masalan `§6.1.5`).

---

## 0. Ish tartibi (har sessiyada)

1. **Keyingi vazifani** shu fayldagi "Ish rejasi" bo‘limidan ol: ro‘yxatdagi birinchi `[ ]` yoki `[~]`. Bosqichlarni tartib bilan bajar, chunki keyingilari oldingilariga tayanadi.
2. Vazifani boshlashdan oldin unga havola qilingan TZ bo‘limini [docs/TZ.md](docs/TZ.md) dan o‘qi. TZ'da yo‘q narsani o‘ylab topma; noaniq joyni foydalanuvchidan so‘ra.
3. **Bitta vazifa = bitta tugallangan qism**: sxema → storage (ikkala implementatsiya) → API → UI → test → audit.
4. Tugatgach:
   - `npm run check` (tsc) va `npm test` (vitest) o‘tsin.
   - Ilovani ishga tushirib, o‘zgarishni brauzerda tekshir.
   - Shu fayldagi belgini `[x]` ga o‘zgartir. Qisman bajarilgan bo‘lsa `[~]` qo‘y va nima qolganini yoz.
   - "O‘zgarishlar jurnali"ga bitta qator qo‘sh.
5. Commit faqat foydalanuvchi so‘raganda. Commit xabari: `feat(<modul>): <vazifa ID> <qisqa tavsif>`.

**Belgilar:** `[x]` bajarilgan · `[~]` qisman / boshlangan · `[ ]` boshlanmagan · `[-]` buyurtmachi bilan kelishib bekor qilingan / kechiktirilgan.

---

## 1. Texnik asos (hozirgi holat)

| Qism | Texnologiya |
|---|---|
| Frontend | React 18 + Vite, TypeScript, Tailwind, shadcn/ui (Radix), wouter, TanStack Query |
| Backend | Node.js + Express (TypeScript, `tsx`), Passport (local) + express-session |
| Baza | PostgreSQL (Neon, `@neondatabase/serverless`) + Drizzle ORM. `DATABASE_URL` bo‘lmasa `.data/db.json` fayl ombori |
| Hisobot | jspdf + jspdf-autotable (PDF), xlsx (Excel), CSV eksport |
| Boshqa | QR-kod, Telegram bot (natija yuborish), Vercel serverless (`api/index.js`) |

### Buyruqlar
- `npm run dev`: dev server, http://localhost:5000 (API + Vite bitta portda)
- `npm run check`: TypeScript tekshiruvi
- `npm test`: vitest
- `npm run db:push`: Drizzle sxemasini bazaga yozish (diqqat: real Neon bazasi)
- `npm run build` / `npm run vercel-build`

### Papkalar
- `shared/schema.ts`: **barcha** jadvallar, enumlar, Zod sxemalari, yorliqlar (`*_LABELS`). Yangi jadval shu yerga qo‘shiladi.
- `server/storage-types.ts`: `IStorage` interfeysi.
- `server/storage-pg.ts`, `server/storage-file.ts`: **ikkala** implementatsiya. Yangi metod ikkalasiga ham yoziladi, aks holda tsc xato beradi. `storage-file.test.ts` fayl omborini testlaydi.
- `server/routes.ts`: asosiy API. `server/routes-clinic.ts`: xizmatlar, qabullar, shifokor kabineti. `server/routes-medical.ts`: ko'rik yozuvlari, tibbiy karta, allergiyalar, yo'llanmalar. Umumiy yordamchilar (`handle`, `audit`, `actorOf`, `emptyIfMissing`, `logPatientView`) — `server/route-helpers.ts`. Ruxsat `requirePermission("modul.amal")`, o‘zgarishlar `audit(req, ...)` orqali. Storage'ning `StorageConflict` xatosi avtomatik 409 bo‘ladi.
- `shared/appointment.ts`: qabul qoidalari (bo‘sh vaqtlar to‘ri, ustma-ust tushish, holat mashinasi va kim qaysi o‘tishni qiladi). Server ham, UI ham shundan foydalanadi.
- `shared/medical-record.ts`: ko'rik yozuvi qoidalari (tasdiqlash shartlari, versiyalar orasidagi farq, tashxislar tarixi).
- `shared/icd10.ts` + `data/icd10/`: MKB-10 katalogini o'qish, kod normallash, o'zbekcha nomlar importi (B3.4).
- `server/result-delivery.ts`: tasdiqlangan natijani yo'llagan shifokorga yetkazish (B3.9).
- `shared/inventory.ts`: ombor mahsulot turlari (TZ §7.2), birliklar, nom qoidalari (B5). `server/routes-inventory.ts`: ombor API.
- `shared/qc.ts`: sifat nazorati qoidalari — Westgard, z-score, EQA bahosi, muddatlar (B4.8). `server/routes-qc.ts`: QC API. `client/src/components/qc/`: Levey–Jennings kartasi va QC panellari.
- `shared/lab-devices.ts`: analizatorlar yorliqlari va qoidalari, TZ §6.4 ro'yxati (B4.9). `server/routes-lab.ts`: analizatorlar va xatolar jurnali API.
- `shared/branding.ts`: klinika logotipini tekshirish qoidalari (B4.7).
- `shared/lab-board.ts`: lab bosh sahifasi ko'rsatkichlarining ta'riflari (B4.1).
- `shared/lab-catalogue.ts`: TZ §6.2 guruhlari, namuna turlari va probirkalar, sifat, `classifyTest`, `tubesFor`. `shared/code128.ts`: Code 128 kodlovchi (`client/src/components/barcode.tsx` SVG).
- `shared/lab-verification.ts`: natija qatorining holati va qachon tashqariga chiqishi (B4.5). `server/lab-rules.ts`: tasdiqlash va tuzatishning yozish qoidalari.
- `shared/patient-links.ts`: bemorga bog'langan jadvallar reyestri (birlashtirish va o'chirish qoidalari). `shared/ledger.ts`: nima o'chirilmaydi (to'lov, natijali buyurtma, ishlatilgan tahlil). `shared/reception.ts`: registratura panelining hisob-kitobi. `shared/referral.ts`: yo'llanma holati va qabulga mosligi.
- `server/auth.ts`: sessiya, Passport, login blokirovkasi, `forgetSessionUser`, `requireMfaEnrollment`.
- `server/mfa.ts`: TOTP, kalitni shifrlash, zaxira kodlar (B1.8).
- `shared/permissions.ts`: **ruxsatlar katalogi** (`PERMISSIONS`) va TZ §3 dagi 11 ta rolning boshlang‘ich ruxsatlari (`SYSTEM_ROLES`).
- `server/rbac.ts`: `requirePermission`, `hasPermission`, `toSessionUser`, rollar keshi (60 s, `invalidateRoles()`).
- `client/src/lib/access.ts`: qaysi sahifa qaysi ruxsat bilan ochiladi (router, sidebar, command palette uchun yagona jadval).
- Menyu tuzilmasi: Ish maydoni (Bosh sahifa, Mening kabinetim, Bemorlar, Navbat, Buyurtmalar, Natijalar, Sifat nazorati, Ombor) · Klinika (Shifokorlar, Bo'limlar, Xizmatlar, Analizatorlar, Xodimlar) · Boshqaruv (Hisobotlar, Xarajatlar, Sozlamalar). Yangi modul sahifasi shu bo'limlardan biriga qo'shiladi.
- Migratsiyalar: `npm run db:upgrade` hammasini ketma-ket bajaradi (har biri qayta ishga tushirsa xavfsiz).
- `client/src/pages/*`: sahifalar. `client/src/App.tsx`: routing (og‘ir sahifalar `lazy`). `client/src/components/app-sidebar.tsx`: menyu.
- `client/src/components/ui-kit.tsx`: `PageHeader`, `SectionCard`, `StatCard`, badge'lar, `EmptyState`, `TableSkeleton`, `Pagination`… **Yangi UI shulardan quriladi.**
- `client/src/lib/format.ts`: pul, telefon, sana formatlari.
- `scripts/*.mjs`: bir martalik migratsiyalar.

### Kod qoidalari
- **Interfeys tili: o‘zbek (lotin).** Barcha yorliqlar, xabarlar, xatolar o‘zbekcha. Kod va identifikatorlar inglizcha.
- Format: telefon `+998 XX XXX XX XX`, pul `1 000 000 so'm`, faqat `format.ts` orqali.
- Dizayn: oddiy shadcn defaultlari yetarli emas. `ui-kit.tsx` va `index.css` dizayn tizimidan foydalan (premium ko‘rinish).
- Tibbiy hujjatlar, natijalar va moliyaviy yozuvlar **o‘chirilmaydi**: bekor qilinadi (`cancelled*`, to'lovlar `voided*`) yoki versiyalanadi (`§10`). Qoidalar va xabarlar `shared/ledger.ts` da.
- Har bir muhim jadvalda `id`, `createdAt`, `updatedAt`, `createdBy` / `updatedBy` bo‘ladi (`§10`).
- Har bir yozish amali `audit()` ga tushadi. Tibbiy ma'lumotni o‘qish ham alohida jurnalga yoziladi (B1.6 dan keyin).
- Ruxsat **serverda** tekshiriladi. UI'da yashirish faqat qulaylik uchun.
- **Yangi modul qo‘shilganda ruxsatlar:**
  1. `shared/permissions.ts` → `PERMISSIONS` ga `modul.amal` kalitlarini qo‘sh (guruh, o‘zbekcha label, tavsif, xavfli bo‘lsa `sensitive: true`). Kerak bo‘lsa `PERMISSION_GROUPS` ga yangi guruh qo‘sh.
  2. `SYSTEM_ROLES` dagi tegishli rollarga standart sifatida qo‘sh. Diqqat: bu faqat **yangi** bazaga ta'sir qiladi. Mavjud bazada rol qatorlari o‘zgarmaydi, ularni admin "Rollar" ekranidan yoqadi (yoki migratsiya skripti).
  3. Har bir route'ga `requirePermission(...)`, handler ichidagi nozik holatlarga `hasPermission(req, ...)`.
  4. Sahifa bo‘lsa `client/src/lib/access.ts` ga qo‘sh, UI'da `can("...")`.
  5. `super_admin` hamma ruxsatni avtomatik oladi, unga qo‘shish shart emas.
- Rol kalitlari: `super_admin`, `rahbar`, `registrator`, `shifokor`, `laborant`, `lab_mudiri`, `omborchi`, `hamshira`, `kassir`, `buxgalter`, `auditor`. Eski `admin` = `super_admin` (`canonicalRoleKey`).
- **Vaqt:** qabul vaqtlari devor soati sifatida saqlanadi (`date` = YYYY-MM-DD, `start_time` = SS:DD), shifokor jadvali bilan bir xil. "Bugun" va "hozir" `localDay()` / `clockNow()` orqali serverning mahalliy soatidan olinadi, shuning uchun deployda `TZ=Asia/Tashkent` bo‘lishi shart.
- **Kesh:** ilovada global `refetchOnMount: false`, `staleTime: Infinity`. Tez o'zgaradigan ish ekranlari (navbat, kabinet, ko'rik oynasi, tibbiy karta) `refetchOnMount: "always"` bilan so'raladi, aks holda invalidatsiyadan keyin sahifaga qaytilganda eski holat ko'rinadi.
- Baza masofaviy (Neon, so‘rov 0.3–1.8 s): bitta sahifa uchun bir nechta ketma-ket so‘rov qilma, JOIN yoki bitta CTE bilan ol.
- **Drizzle tuzog'i:** bitta jadvalli `select` ichida `${table.column}` jadval nomisiz yoziladi. Ichki so'rovda (`(SELECT …)`, `EXISTS`) tashqi ustunni hech qachon `${…}` bilan yozma — `"orders"."id"` kabi aniq nom va ichkarida taxallus ishlat. `server/storage-pg-sql.test.ts` buni tekshiradi. Fayl ombori testlari bu xatoni ko'rmaydi, shuning uchun Postgres so'rovlarini haqiqiy bazada ham tekshir.
- Migratsiya: sxema o‘zgarsa mavjud ma'lumotni buzmasin (yangi ustunlar nullable yoki default bilan). Real bazaga `db:push` qilishdan oldin foydalanuvchidan so‘ra.

---

## 2. Ochiq qarorlar (buyurtmachi bilan hal qilinadi)

| ID | Masala | Holat |
|---|---|---|
| D-1 | **Backend stack.** TZ: Python/Django + DRF (`§2`). Loyiha: Node/Express/TS. Qolgan hamma narsa (React, PostgreSQL, PDF/Excel, modular monolith) mos. | ✅ **Hal qilindi (2026-11-05):** Django kerak emas. Node.js + Express + TypeScript + Drizzle'da davom etiladi. Django'ga o‘tishni qayta taklif qilma. |
| D-2 | **Hosting va ma'lumot joylashuvi.** TZ O‘zbekiston qonunchiligiga muvofiqlikni talab qiladi (`§12`). Hozir Neon (xorij) + Vercel. | ❓ |
| D-3 | **Fayl ombori** (UZI rasmlari, PDF arxiv): S3-compatible (`§2`). Provayder tanlanmagan. | ❓ |
| D-4 | **Analizatorlar protokoli** (`§6.4`): har bir qurilma uchun RS-232 / TCP/IP / HL7 hujjatlari kerak. Brauzer COM-portga ulana olmaydi, shuning uchun klinikada lokal "ko‘prik" xizmati kerak bo‘ladi. | ❓ Qurilma hujjatlari kutilmoqda |
| D-5 | **MKB-10 katalogi** manbai va tili (o‘zbek/rus). | ✅ **Hal qilindi (2026-11-06):** ikkala til. Ruscha nomlar — Rossiya SSV NSI rasmiy ma'lumotnomasi (OID 1.2.643.5.1.13.13.11.1005, v2.27, `data/icd10`). O'zbekcha nomlar alohida ustunda, klinika to'ldiradi (ochiq rasmiy o'zbekcha MKB-10 topilmadi). Kod hozircha **ixtiyoriy**. |

---

## 3. Ish rejasi (TZ `§15` bosqichlari bo‘yicha)

> Holat 2026-11-10. Hisoblash: `[x]` = 1, `[~]` = 0.5, `[ ]` = 0. Umumiy: **76 banddan 46.5 → ≈61%**.

### Bosqich 1: Loyihaning poydevori (`§3`, `§10`, `§12`, `§15.1`) 100%

- [x] **B1.1** Ma'lumotlar bazasi: PostgreSQL + Drizzle, fayl ombori zaxira varianti.
- [x] **B1.2** Login va parol: scrypt xesh, brute-force blokirovka (username+IP), eskalatsiyali bloklash.
- [x] **B1.3** Foydalanuvchilar: CRUD, faollashtirish/bloklash, parol almashtirish.
- [x] **B1.4** Rollar va ruxsatlar (`§3`, `§10`). 11 ta tizim roli + klinikaning o‘z rollari; 26 ta ruxsat 6 guruhda.
  - `roles` jadvali (ruxsatlar `text[]` ustunida; katalog kodda, chunki ularni kod tekshiradi). Migratsiya: `npm run db:roles`. Jadval yo‘q bo‘lsa ilova standart rollarda ishlayveradi.
  - Barcha API `requirePermission` bilan; o‘qish ham yopiq ("faqat o‘z bo‘limini ko‘radi"). Bekor qilish (`orders.cancel`) va pul qaytarish (`payments.refund`, TZ §9.2) alohida ruxsat. Moliyaviy raqamlar `finance.view` siz qaytmaydi.
  - Huquqni oshirishdan himoya: o‘zida yo‘q ruxsatli rolni berib bo‘lmaydi; super adminni faqat super admin boshqaradi; oxirgi faol super admin o‘chirilmaydi/bloklanmaydi; o‘z rolini va o‘zini bloklab bo‘lmaydi; `super_admin` roli tahrirlanmaydi; tizim rollari va xodimi bor rol o‘chirilmaydi.
  - UI: Sozlamalar → Rollar (rol kartalari, ruxsatlar matritsasi, tahrirlovchi), Xodimlar (rol tanlash, filtr, qidiruv), ruxsatsiz sahifa uchun "Ruxsat yo‘q" ekrani, sidebar/command palette ruxsat bo‘yicha, Sozlamalar tablari ruxsat bo‘yicha (parol tabi hammaga).
  - Testlar: `shared/permissions.test.ts`, `server/storage-file.test.ts` (roles), 60 ta API e2e tekshiruv (vaqtinchalik skript bilan).
  - Neon'da `npm run db:roles` bajarildi (2026-11-05): `roles` jadvali, 11 tizim roli, admin → `super_admin`.
  - **Qoldi:** `api/index.js` (Vercel) ni `npm run build:api` bilan qayta yig‘ish, deploydan oldin.
- [x] **B1.5** Bo'limlar va shifokorlar (`§10` `departments`, `doctors`).
  - Bo'lim: nom (takrorlanmas), tur (ambulator / diagnostika / laboratoriya / statsionar / boshqa), tavsif, faol/yopilgan. Shifokori bor bo'lim o'chirilmaydi, yopiladi.
  - Shifokor profili: xodimga 1:1 bog'langan; mutaxassislik, bo'lim, kabinet, qabul narxi, qabul davomiyligi (daqiqa), haftalik ish jadvali (`scheduleSchema`: ustma-ust oraliqlar va noto'g'ri vaqt rad etiladi). Xodim o'chirilsa profil ham o'chadi.
  - Ruxsatlar: `departments.manage`, `doctors.manage` (yangi "Klinika tuzilmasi" guruhi). Ro'yxatlarni (`GET /api/departments`, `/api/doctors`) har bir xodim ko'radi.
  - UI: Sozlamalar → Bo'limlar (kartalar, namuna to'plam), Shifokorlar (jadval, filtr, ish jadvali muharriri va tayyor shablonlar).
  - Migratsiya: `npm run db:clinic`. Jadvallar yo'q bo'lsa ro'yxatlar bo'sh qaytadi, yozish 503 va tushunarli xabar beradi.
  - Qabullar tarixi bor shifokorni o'chirib bo'lmaydi (409), faqat nofaol qilinadi (B2.7 da bajarildi).
- [x] **B1.6** Audit jurnali (`§12`): barcha yozish amallari "nima o'zgardi" tafsiloti bilan; tibbiy ma'lumotni *ko'rish* ham yoziladi — bemor kartasi ochilganda (`view`, bir xodim + bir karta uchun 10 daqiqada bir marta). Kartada "Kirishlar tarixi" tabi (`audit.read`), jurnalda `entityId`/`action` filtrlari.
- [x] **B1.7** Seans xavfsizligi (`§12`).
  - Server (`server/session-policy.ts`): har bir API so'rovida faolsizlik (standart 30 daq) va umumiy muddat (standart 12 soat) tekshiriladi; oshsa seans yopiladi va 401 `{code: SESSION_IDLE | SESSION_MAX}`. Eski seanslarga yangi soat beriladi (deploy paytida hech kim chiqarib yuborilmaydi).
  - Mijoz (`SessionGuard`): yopilishdan 1 daqiqa oldin teskari sanoqli ogohlantirish; faollik oynalar orasida `localStorage` orqali bo'lishiladi; faol ishlayotganda `/api/session/ping`. Har qanday 401 → tabdan chiqish va login sahifasida sabab.
  - Faol seanslar: Sozlamalar → Xavfsizlik (qurilma, IP, vaqt; bittasini yoki boshqalarini yopish). Admin xodimning barcha seanslarini yopa oladi. Parol almashganda / xodim bloklanganda seanslar avtomatik yopiladi.
  - Siyosat `app_settings` jadvalida (`security` kaliti), `settings.manage` bilan o'zgartiriladi. Migratsiya: `npm run db:security`; jadvalsiz standart siyosat ishlaydi.
  - Yo'l-yo'lakay: `ApiError` (toast'larda xom JSON o'rniga toza xabar), `npm run db:upgrade` (barcha migratsiyalar ketma-ket).
- [x] **B1.8** Ikki bosqichli autentifikatsiya (`§12`): TOTP (Google Authenticator), ixtiyoriy, rol bo‘yicha majburiy qilish imkoni bilan.
  - Yadro `server/mfa.ts` (RFC 6238, `node:crypto`; RFC test vektorlari bilan tekshirilgan). Kalit AES-256-GCM bilan shifrlanadi (`MFA_ENCRYPTION_KEY`, bo‘lmasa `SESSION_SECRET` dan), zaxira kodlar faqat SHA-256 xesh sifatida saqlanadi.
  - `user_mfa` jadvali (alohida, `users` qatoriga sir tushmasin). Migratsiya: `npm run db:mfa` (`db:upgrade` ichida). Jadval yo‘q bo‘lsa kirish avvalgidek ishlaydi, hech kimda 2FA yo‘q deb hisoblanadi.
  - Kirish: parol → `mfaRequired` → `POST /api/login/mfa` (6 xonali kod yoki zaxira kod). Noto‘g‘ri kod parol xatosi bilan **bir xil eskalatsiyali qulfga** hisoblanadi; kutish holati 5 daqiqa / 5 xato bilan tugaydi. Kod qadami bir marta ishlaydi (replay yo‘q), sarflash atomik (`UPDATE … WHERE last_used_step < $step`), parallel so‘rovda ham bittasi o‘tadi.
  - Yoqish: Sozlamalar → Xavfsizlik (parol → QR → birinchi kod → 10 ta zaxira kod, bir marta ko‘rsatiladi). O‘chirish va zaxira kodlarni yangilash parol/kod talab qiladi. Boshqa qurilmalardagi seanslar yoqilganda yopiladi.
  - Rol bo‘yicha majburiylik: `app_settings.security.mfaRequiredRoles` (Sozlamalar → "2FA ni majburiy qilish", `settings.manage`). Majburiy roldagi 2FA'siz xodim kirgach faqat sozlash ekrani (`MfaEnrollmentGate`) ochiladi; server qolgan barcha API'ni 403 `MFA_SETUP_REQUIRED` bilan yopadi (`requireMfaEnrollment`). Majburiy rol 2FA'ni o‘zi o‘chira olmaydi.
  - Telefon yo‘qolsa: Xodimlar → "2FA ni o‘chirish" (`users.manage`; super adminnikini faqat super admin; seanslar yopiladi). Oxirgi chora: `npm run mfa:reset -- <login>`.
  - Testlar: `server/mfa.test.ts` (14), `server/storage-file.test.ts` (2FA bloki), 42 ta API e2e tekshiruv (vaqtinchalik skript bilan).
  - Neon'da `npm run db:mfa` bajarildi (2026-11-05); atomik so‘rovlar real bazada tranzaksiya ichida sinovdan o‘tdi.
  - Brauzerda (headless Chrome, CDP orqali) tekshirildi: kod bosqichi, noto‘g‘ri kod ogohlantirishi, kirish, Sozlamalar paneli (telefon o‘lchami ham), majburiy sozlash ekrani, QR, zaxira kodlar. `api/index.js` qayta yig‘ildi.
- [x] **B1.9** Bemor ID (`§4.2`, qabul mezoni 16.1): har bir modul bemorga faqat `patients.id` (`patient_id` ustuni) orqali bog'lanadi. `patientNumber` hamma joyda ko'rsatiladi, lekin u orqali bog'lanilmaydi.
  - `shared/patient-links.ts` (`PATIENT_LINKS`): `patient_id` li har bir jadval uchun birlashtirishda va o'chirishda nima bo'lishi yozilgan. `patient-links.test.ts` sxemani o'qiydi va ro'yxatga kiritilmagan jadval bo'lsa build yiqiladi. **Yangi modul jadvali avval shu yerga, so'ng ikkala storage'dagi `mergePatients` / `deletePatient` ga qo'shiladi.**
  - Kartani o'chirish: buyurtma, qabul, ko'rik yozuvi yoki allergiyasi bor karta o'chirilmaydi (409, "birlashtiring" degan xabar bilan). Tekshiruv va o'chirish bitta tranzaksiyada, karta qatori qulflangan holda bajariladi. Postgres'da modullar soni qancha bo'lishidan qat'i nazar 2 ta so'rov.
- [x] **B1.10** Umumiy ustunlar (`§10`: identifikator, yaratilgan va o'zgartirilgan vaqt, tegishli foydalanuvchi).
  - Qo'shildi: `users` (`created_by`, `updated_at`, `updated_by`; kirish blokirovkasi "o'zgartirish" hisoblanmaydi), `roles` / `departments` / `doctors` / `patients` (`created_by`), `tests` (to'rttala ustun), `orders` (`updated_at`, `updated_by`: tahrir, natija, to'lov). Eski qatorlarda bu ustunlar NULL qoladi, o'ylab topilgan qiymat yozilmaydi. Mijoz bu ustunlarni yubora olmaydi (insert sxemalaridan chiqarilgan).
  - Atayin qo'shilmadi: `visits`, `medical_record_versions`, `samples`, `patient_allergies`. Ular o'zgarmas yozuvlar yoki har bir hodisada o'z kim/qachon belgisiga ega. `order_tests` natijalari B4.5 da versiyalanadi.
  - **Moliyaviy va tibbiy yozuvlar o'chirilmaydi** (`shared/ledger.ts`): to'lov yozuvi endi o'chirilmaydi, sabab bilan **bekor qilinadi** (`POST /api/payments/:id/void`, `payments.delete` ruxsati; `voided_*` ustunlari; to'langan summaga kirmaydi, tarixda chizilgan holda qoladi; ikki marta bekor qilish 409). To'lovi (bekor qilingani ham) yoki natijasi bor buyurtma o'chirilmaydi, faqat bekor qilinadi. Buyurtmalarda ishlatilgan tahlil katalogdan o'chirilmaydi, faolsizlantiriladi.
  - Migratsiya: `npm run db:columns` (`db:upgrade` ichida). **Yangi kod deploy qilinishidan OLDIN bajarilishi shart:** kod bu ustunlarni har bir buyurtma, tahlil va xodim so'rovida o'qiydi. Neon'da avval ROLLBACK qilingan tranzaksiyada sinab ko'rildi, so'ng bajarildi (2026-11-06); yangi storage kodi real bazada o'qish rejimida tekshirildi.

### Bosqich 2: Registratura (`§4`, `§15.2`) 95%

- [x] **B2.1** Yangi bemor formasi (`§4.1.2`): F.I.Sh., jins, telefon, manzil, tug'ilgan sana (yosh avtomatik; sana noma'lum bo'lsa taxminiy yosh), pasport/ID, JShShIR, favqulodda aloqa (`patient_contacts`). Migratsiya: `npm run db:patients`.
- [x] **B2.2** Takroriy bemorni aniqlash (`§4.2`, `shared/patient-identity.ts`): yozish paytida tekshiruv; kuchli moslik (JShShIR, pasport, ism+telefon, ism+tug'ilgan sana — kirill/lotin farqisiz) saqlashni 409 bilan to'xtatadi, ro'yxatchi "shu bemor"ni tanlaydi yoki aniq tasdiqlaydi; kuchsiz moslik (faqat telefon/ism) faqat ogohlantiradi. Dublikat kartalarni birlashtirish (`patients.delete` ruxsati): buyurtmalar, aloqalar, Telegram ko'chadi, bo'sh maydonlar to'ldiriladi.
- [x] **B2.3** Bemorlar ro'yxati (`§4.1.3`): ID, F.I.Sh., telefon, yosh/tug'ilgan sana, oxirgi tashrif va tashriflar soni; qidiruv pasport va JShShIR bo'yicha ham. ("Shaxsiy karta" — B2.4.)
- [x] **B2.4** Bemor shaxsiy kartasi (`/patients/:id`, `§4.1.3`, `§4.2`): sarlavha (yosh, hujjatlar, Telegram), ko'rsatkichlar (tashriflar, oxirgi tashrif, jami, qarz), tablar — tashriflar xronologiyasi, natijalar dinamikasi, to'lovlar daftari, ma'lumotlar (aloqa, hujjatlar), kirishlar tarixi. Rol bo'yicha qisqartiriladi: `orders.read`siz buyurtmalar, moliya ruxsatisiz summalar ko'rinmaydi. Statsionar tarixi B6 bilan qo'shiladi.
- [x] **B2.5** Tashriflar (`visits`, `§10`): bemor + kun uchun bitta tashrif (unique), buyurtma yaratilganda avtomatik (`ON CONFLICT`, parallel saqlashda ham bitta). Eski buyurtmalar migratsiyada kunlar bo'yicha bog'landi (`npm run db:visits`). Birlashtirishda bir kunlik tashriflar qo'shiladi. **Keyin:** qabul (B2.7) va xizmatlar (B2.6) ham tashrifga bog'lanadi.
- [x] **B2.6** Xizmatlar katalogi (`§4.1.5`): `services` (turi: shifokor ko‘rigi / laboratoriya / UZI / muolaja / boshqa, narx, bo‘lim). Lab `tests` katalogi shu tizimga ulanadi.
  - `services` jadvali: nom (katta-kichik harfga qaramay takrorlanmas), tur (`konsultatsiya`, `uzi`, `muolaja`, `boshqa`), bo'lim, narx, davomiyligi, tavsif, faol. Qabullarda ishlatilgan xizmat o'chirilmaydi, to'xtatiladi.
  - Lab tahlillari `services` ga ko'chirilmadi (birliklar, referens, natijalar `tests` ga bog'liq). Ular "Narxlar ro'yxati"da (`GET /api/price-list`, TZ §9.1 "Xizmatlar narxlari") xizmatlar bilan birga, `laboratoriya` turi sifatida chiqadi.
  - Ruxsat: `services.manage` (rahbar). Ro'yxat va narxlarni har bir xodim ko'radi.
  - UI: Klinika → Xizmatlar (katalog: statistika, filtr, namuna to'plam; narxlar ro'yxati: qidiruv, Excel/PDF).
- [x] **B2.7** Navbat va qabul (`§4.1.4`): `appointments`: shifokor tanlash, qabul vaqti (shifokor jadvali bo‘yicha bo‘sh slotlar), navbat raqami (kunlik, shifokor bo‘yicha), holat (yozildi → keldi → qabulda → yakunlandi / kelmadi / bekor).
  - Bo'sh vaqtlar to'ri shifokorning haftalik jadvali va `slotMinutes` dan quriladi (`GET /api/doctors/:id/slots`). O'tgan, band, jadvaldan tashqari va 90 kundan uzoq vaqtlar rad etiladi. Bemor bir kunda bitta shifokorga ikki marta yozilmaydi.
  - **Poyga himoyasi:** yozish va ko'chirish storage ichida, shifokor+kun bo'yicha `pg_advisory_xact_lock` ostida tekshiriladi. Oxirgi himoya — `UQ_appointments_slot` qisman unique indeksi (bekor qilingan va kelmaganlar slotni bo'shatadi). Sinov: bir slotga 5 ta parallel so'rovdan faqat 1 tasi o'tadi.
  - Navbat raqami shifokor+kun bo'yicha, yozilish tartibida beriladi (`UQ_appointments_queue`). Narx yozilish paytida muzlatiladi: xizmat narxi, xizmat tanlanmasa shifokorning qabul narxi.
  - Holat mashinasi `shared/appointment.ts` da. Registratura (`appointments.manage`): keldi, bekor qilish (sabab majburiy), "keldi"ni bekor qilish, ko'chirish. Shifokor (`appointments.serve`, faqat o'z qabuli): chaqirish, yakunlash, navbatga qaytarish. Ikkalasi ham: kelmadi. Holatni yangilash `WHERE status = from` bilan, ikki kishi bir vaqtda bosganda bittasi yutadi. Hech narsa o'chirilmaydi.
  - "Keldi" bugungi tashrifni (B2.5) yaratadi yoki biriktiradi. Bemor kartasida tashrif sifatida (lab buyurtmasi bilan bir kunda bitta tashrif) va "Qabullar" tabida ko'rinadi; bemorlar ro'yxatidagi "oxirgi tashrif" ham qabullarni hisobga oladi. Birlashtirishda qabullar ko'chadi, qabul tarixi bor bemorni o'chirib bo'lmaydi.
  - Ruxsatlar: `appointments.read` (rahbar, registrator, kassir, auditor), `appointments.manage` (registrator), `appointments.serve` (shifokor).
  - UI: Ish maydoni → Navbat (kun bo'yicha, shifokor chiplari, statistika, qidiruv, eksport); qabulga yozish dialogi (bemor qidiruvi, shifokor, xizmat, 7 kunlik tasma, bo'sh vaqtlar to'ri, ko'chirish); bemor kartasida "Qabulga yozish" va "Qabullar" tabi.
  - Migratsiya: `npm run db:appointments` (`db:upgrade` ichida). Jadvallar va indekslarni yaratadi va mavjud tizim rollariga yangi ruxsatlarni **faqat qo'shadi**. Neon'da avval ROLLBACK qilingan tranzaksiyada sinab ko'rildi, so'ng bajarildi (2026-11-06): ikkala jadval, indekslar, 5 ta rolga ruxsatlar. Jadvalsiz bazada ro'yxatlar bo'sh qaytadi, yozish 503 beradi.
  - **Keyin:** qabul to'lovi B7.1 (umumiy hisobvaraq) bilan; real vaqtda yangilanish B8.1 (hozir 15–30 s polling).
- [x] **B2.8** Shifokorga elektron yo‘llanma (`§4.2`): qabul yaratilganda shifokor kabinetida paydo bo‘ladi. Qabul shifokorning kabinetiga darhol tushadi ("Yozilganlar"), "keldi" belgisi bilan "Kutayotganlar"ga o'tadi; murojaat sababi ham ko'rinadi.
- [x] **B2.9** Laboratoriyaga buyurtma yuborish (`§4.2`).
- [~] **B2.10** To‘lovni rasmiylashtirish (`§4.2`): lab buyurtmalari uchun bor. Bosqich 7 da umumiy hisobvaraqqa o‘tadi.
- [x] **B2.11** Registratura bosh sahifasi (`§4.1.1`): bugungi bemorlar, navbatdagilar, qabulga kelganlar, yangi ro‘yxatdan o‘tganlar, to‘lov holati.
  - `GET /api/reception` (`appointments.read` yoki `orders.read`): Postgres'da bitta so'rov + kunlik qabullar, parallel. Har bir bo'lim o'z ruxsati bilan qaytadi: navbat `appointments.read`, to'lov holati `orders.read` (summalar `finance.view`), yangi bemorlar `patients.read`. Ruxsat bo'lmasa `null`.
  - Bosh sahifada (`appointments.read` egalari uchun) "Registratura · Bugungi kun" paneli: 5 ta ko'rsatkich, qabulga kelganlar (qabuldagi, so'ng kelish tartibida), navbatdagilar (vaqt bo'yicha, kechikayotganlar belgilanadi, to'g'ridan-to'g'ri "Keldi"), yangi bemorlar, to'lov holati (to'liq / qisman / to'lanmagan). Kechikish server soati bo'yicha. 20 s da yangilanadi va amallardan keyin darhol invalidatsiya qilinadi.
  - Hisoblash qoidalari `shared/reception.ts` da (test bilan). "To'lov holati" hozircha lab buyurtmalari bo'yicha. Qabul to'lovlari B7.1 (umumiy hisobvaraq) bilan qo'shiladi.

### Bosqich 3: Shifokorlar (`§5`, `§15.3`) 83%

- [x] **B3.1** Shifokor kabineti (`§5.1.1`): bugungi qabul, kutayotganlar, qabul qilinganlar, tugallanmagan kartalar. Navbatdan bemorni "chaqirish".
  - `/cabinet` ("Mening kabinetim"): statistika, qabuldagi bemor kartasi (o'tgan vaqt, bemor kartasiga havola, yakunlash, navbatga qaytarish), "Keyingi bemorni chaqirish" (`POST /api/cabinet/call-next`: kelganlardan eng erta yozilgan), kutayotganlar (qancha kutayotgani bilan), yozilganlar, qabul qilinganlar, kun bo'yicha ko'rish.
  - Bir vaqtda faqat bitta bemor qabulda bo'ladi (409). "Tugallanmagan" hozircha oldingi kunlarda boshlanib yakunlanmagan qabullar; B3.3 dan keyin yakunlanmagan ko'rik kartalari qo'shiladi.
  - `appointments.read` egasi (rahbar) istalgan shifokor kabinetini faqat ko'rish uchun ochadi. Shifokor profili yo'q xodimga tushunarli xabar chiqadi.
- [~] **B3.2** Elektron tibbiy karta (`§5.1.2`, `medical_records`): bemor ma'lumotlari, allergiyalar, avvalgi tashxislar, lab natijalari, UZI/tekshiruvlar, davolash tarixi. Bitta umumlashgan ko‘rinish.
  - `GET /api/patients/:id/medical` (`records.read`): bemor, allergiyalar (faol emaslari ham tarixda), barcha ko'riklar, tasdiqlangan ko'riklardan yig'ilgan tashxislar tarixi, lab natijalari (faqat `orders.read` bilan). Qoralamalarni faqat muallifi ko'radi. Ochilishi audit jurnaliga yoziladi ("tibbiy kartasi ochildi").
  - Allergiyalar `patient_allergies` jadvalida. O'chirilmaydi, sabab bilan "faol emas" qilinadi. Takrorlanmaydi (katta-kichik harfga qaramay). Yozish `records.write` bilan. Ko'rik oynasining tepasida qizil ogohlantirish chiqadi.
  - UI: bemor kartasida "Tibbiy karta" tabi, ko'rik oynasining yon paneli.
  - UZI va boshqa tekshiruvlar kartada "Yo'llanmalar" bo'limida ko'rinadi (B3.5): nima buyurilgan, qachon va kimga yozilgan, bajarildimi.
  - **Qoldi:** tekshiruv xulosasi va rasmlari (B8.2 fayl ombori), davolash tarixi retseptlar bilan (B3.6). Hozir davolash ko'rikning "Tavsiyalar" maydonida.
- [x] **B3.3** Ko‘rik oynasi (`§5.1.3`): shikoyat, anamnez, ko‘rik natijasi, dastlabki tashxis, yakuniy tashxis, tavsiyalar.
  - `medical_records`: har bir qabulga bitta yozuv (`UQ_medical_records_appointment`), olti maydon (har biri ko'pi bilan 4000 belgi). Faqat qabulning o'z shifokori yozadi, qabul "qabulda" yoki "yakunlandi" holatida bo'lishi kerak (yakunlangandan keyin ham yozuvni tugatish mumkin).
  - `/cabinet/visit/:appointmentId`: "Keyingi bemorni chaqirish" to'g'ridan-to'g'ri shu oynani ochadi. Qoralama yozish to'xtagach 1.2 s da va `Ctrl+S` bilan saqlanadi, saqlanmagan matn bilan sahifani tark etishdan himoyalangan.
  - **To'qnashuv himoyasi:** har bir saqlash `revision` ni ko'rsatadi (`WHERE revision = n`). Ikkinchi oyna birinchisining matnini yozib yubora olmaydi, foydalanuvchiga ogohlantirish va "oxirgi holatni yuklash" tugmasi chiqadi.
  - Kabinet: qabuldagi bemor uchun "Ko'rik oynasi" tugmasi, qatorlarda yozuv holati (qoralama yoki tasdiqlangan), "Tugallanmagan tibbiy kartalar" (shifokorning tasdiqlanmagan yozuvlari).
  - Tashxis hozircha erkin matn. MKB-10 kodi B3.4 da (D-5 qarori kerak).
  - Migratsiya: `npm run db:medical` (`db:upgrade` ichida). Jadvallar va indekslarni yaratadi, shifokor (`records.*`) va rahbarga (`records.read`) ruxsatlarni **faqat qo'shadi**. Neon'da avval ROLLBACK qilingan tranzaksiyada sinab ko'rildi, so'ng bajarildi (2026-11-06).
  - Testlar: `shared/medical-record.test.ts`, `storage-file.test.ts` (yozuvlar, allergiyalar), 43 ta API E2E, brauzerda butun shifokor yo'li (chaqirish → yozish → avtosaqlash → tasdiqlash va yakunlash → tuzatish → tarix).
- [x] **B3.4** Tashxislar va MKB-10 (`§5.1.3`, `diagnoses`): MKB-10 katalogi + qidiruv (D-5), tashxislar tarixi.
  - `icd10` jadvali: 15 038 yozuv (22 bob, 274 blok, 2 058 rubrika, 12 684 kod; 101 tasi eskirgan). Ierarxiya (bob, blok, ota kod), `selectable` (faqat amaldagi rubrika yoki kod; bob/blok/eskirgan tanlanmaydi). O'qish va ierarxiya `shared/icd10.ts` (`parseNsiIcd10`), testlar real fayl bilan.
  - Ko'rik yozuvida ikkita ixtiyoriy ustun: `preliminary_diagnosis_code`, `final_diagnosis_code` (versiyalarda ham). Matn — tashxisning o'zi, kod yonida. Server kodni katalogda tekshiradi (yo'q, eskirgan, blok — 400); yozuvda avvaldan turgan kod qayta tekshirilmaydi. Kod o'zgarishi tuzatish hisoblanadi va auditda nomi bilan yoziladi. Kodli, matnsiz tashxis ham tasdiqlashga yetadi.
  - Qidiruv (`GET /api/icd10`): kod boshi bo'yicha (`i1`, kirillcha `е11,9` ham normallashadi) yoki ruscha/o'zbekcha nomdagi so'zlar bo'yicha. `GET /api/icd10/lookup`, `/stats`.
  - UI: ko'rik oynasida har ikki tashxis ostida MKB-10 tanlagich (klaviatura, o'zbekcha nom bo'lsa birinchi, ruscha ostida, blok ko'rsatkichi); kod tanlansa va matn bo'sh bo'lsa nom yoziladi. Kod belgisi: ko'rik ko'rinishida, tashxislar tarixida, versiyalarda, xulosa PDF'ida (kod, o'zbekcha va ruscha nom).
  - O'zbekcha nomlar: Sozlamalar → MKB-10 (`settings.manage`): qidiruv, joyida tahrirlash, CSV import (`kod;nom`, noma'lum kodlar va o'qilmagan qatorlar hisoboti), qamrov ko'rsatkichi. Audit.
  - Migratsiya: `npm run db:icd10` (`db:upgrade` ichida, `tsx` bilan): jadval, kod ustunlari, katalogni bitta tranzaksiyada yuklash (≈15 s). Qayta ishga tushirsa ruscha nomlarni yangilaydi, o'zbekchaga tegmaydi. **Yangi kod deploy qilinishidan OLDIN bajarilishi shart.** Neon'da avval ROLLBACK qilingan tranzaksiyada sinab ko'rildi, so'ng bajarildi (2026-11-06): 15 038 yozuv, 14 641 tanlanadigan. Fayl omborida katalog `data/icd10` dan o'qiladi, o'zbekcha nomlar `db.json` da.
  - Testlar: `shared/icd10.test.ts` (6), `medical-record.test.ts` (+4), `storage-file.test.ts` (3), 20 ta API E2E, brauzerda tanlagich va sozlamalar ekrani.
- [x] **B3.5** Yo‘llanma (`§5.1.4`): lab tahlillari (lab buyurtmasini yaratadi, `§11` Shifokor→Lab), UZI, boshqa tekshiruvlar, mutaxassis konsultatsiyasi (boshqa shifokorga qabul).
  - `referrals` jadvali, uch turi bor: `lab`, `exam` (katalogdagi UZI va "boshqa" xizmatlar), `consult` (mutaxassislik, ixtiyoriy aniq shifokor). Yo'llanma raqami identity ketma-ketligidan ("Yo'llanma №12"). Faqat qabulning o'z shifokori, qabul boshlangan yoki yakunlangan bo'lsa beradi (`referrals.create`).
  - **Laboratoriya:** yo'llanma bilan bir tranzaksiyada lab buyurtmasi yaratiladi (`orders.referral_id`, `UQ_orders_referral`). Probirka bilan, to'lanmagan holda, "yo'naltirgan" va ko'rsatma bilan. Registratura uni buyurtmalarda "Yo'llanma №" bilan ko'radi va to'lovni oladi, laboratoriya odatdagidek ishlaydi. Desk va yo'llanma buyurtmasi bitta `insertOrderTx` / `placeOrder` dan o'tadi.
  - **Tekshiruv va konsultatsiya:** registratura navbatga yozadi (`appointments.referral_id`). Qabul yo'llanmaga mos bo'lishi shart (`referralBookingProblem`): o'sha bemor, o'sha xizmat, so'ralgan shifokor yoki mutaxassislik. Ko'chirishda ham tekshiriladi. Bitta yo'llanmaga bitta faol qabul: referral qatori `FOR UPDATE` va `UQ_appointments_referral` qisman indeksi.
  - **Holat saqlanmaydi, hisoblanadi** (`shared/referral.ts` `referralStage`): lab — buyurtma holatidan ("Laboratoriyada" / "Bajarildi"), boshqalari — faol qabuldan ("Navbatga yozilmagan" / "Navbatga yozilgan" / "Bajarildi"). Qabul bekor qilinsa yo'llanma o'zi yana kutishga qaytadi. Sinxronlash xatosi bo'lishi mumkin emas.
  - **Bekor qilish** (sabab bilan, o'chirilmaydi): bergan shifokor yoki registratura (`referrals.manage`). To'lanmagan va natijasiz lab buyurtmasi ham bekor bo'ladi, to'lovli yoki natijali bo'lsa rad etiladi. Navbatga yozilgan yo'llanma uchun avval qabul bekor qilinadi.
  - UI: ko'rik oynasida "Yo'llanmalar" paneli va yo'llanma dialogi (Tahlil / Tekshiruv / Konsultatsiya: qidiruv, guruhlar, summa). Registratura bosh sahifasida "Navbatga yozilmagan yo'llanmalar" (eng eskisi birinchi). Qabulga yozish dialogi yo'llanmadan ochiladi: bemor va xizmat qulflanadi, shifokorlar mosi bilan cheklanadi. Bemor kartasining "Qabullar" tabida, tibbiy kartada, buyurtmalar ro'yxatida va buyurtma oynasida "Yo'llanma №".
  - Ruxsatlar: `referrals.read` (shifokor, registrator, rahbar, auditor), `referrals.create` (shifokor), `referrals.manage` (registrator). Audit: har bir berish, navbatga yozish va bekor qilish.
  - Migratsiya: `npm run db:referrals` (`db:upgrade` ichida). **Yangi kod deploy qilinishidan OLDIN bajarilishi shart:** kod `orders.referral_id` va `appointments.referral_id` ni har bir so'rovda o'qiydi. Neon'da avval ROLLBACK qilingan tranzaksiyada sinab ko'rildi (Drizzle generatsiya qilgan aynan shu SQL bilan), so'ng bajarildi (2026-11-06).
  - Testlar: `shared/referral.test.ts`, `storage-file.test.ts` (6 ta), 40 ta API E2E, brauzerda shifokor → registratura yo'li (telefon o'lchami bilan).
- [ ] **B3.6** Davolash va retsept (`§5.1.5`, `prescriptions`): dori nomi (ombor katalogidan, B5 dan keyin), doza, tartib, davomiylik, muolajalar.
- [x] **B3.7** Hujjatni tasdiqlash, imzolash, tuzatish (`§5.2`): imzolangan ko‘rik qulflanadi; tuzatish yangi versiya yaratadi, eskisi saqlanadi (`medical_record_versions`).
  - Alohida vakolatlar: `records.write` (qoralama), `records.sign` (tasdiqlash), `records.amend` (tuzatish, `sensitive`). Tasdiqlash uchun shikoyat va kamida bitta tashxis shart (`signProblem`). Tasdiqlangan yozuv qoralama sifatida o'zgartirilmaydi.
  - Tuzatish bitta tranzaksiyada bajariladi (`FOR UPDATE`): joriy matn `medical_record_versions` ga yoziladi (kim, qachon, sabab; versiya raqami takrorlanmas), yangi matn keyingi versiya bo'lib tuzatuvchi nomidan tasdiqlanadi. Sabab majburiy, o'zgarishsiz tuzatish rad etiladi. Audit qaysi maydonlar o'zgarganini yozadi.
  - UI: "Tuzatish kiritish" (o'zgargan maydonlar belgilanadi), "Tarix" dialogi (joriy va barcha oldingi versiyalar).
  - "Imzolash" — tizim ichidagi tasdiqlash (kim, qachon). Elektron raqamli imzo (ERI) TZ'da talab qilinmagan.
- [x] **B3.8** Ko‘rik xulosasi PDF (`§5.2`).
  - Faqat tasdiqlangan ko'rik yozuvidan (qoralama 409). `GET /api/records/:id/summary` (`records.read`) bitta so'rovda: yozuv, qabul, faol allergiyalar, shu qabul yo'llanmalari (bekor qilinganlarsiz) tasdiqlangan natijalari bilan, klinika rekvizitlari. Har bir chiqarish auditga yoziladi (`export`, "ko'rik xulosasi chiqarildi").
  - PDF `client/src/lib/visit-summary-pdf.ts` (jspdf + Roboto, kirill harflari ham): klinika sarlavhasi, bemor bloki (ID, tug'ilgan sana/yosh, jinsi, qabul, shifokor, xona), allergiyalar qizil, ko'rikning to'ldirilgan maydonlari, yo'llanmalar va natijalar jadvali (me'yordan tashqarisi rangli), shifokor imzosi, elektron tasdiq belgisi (kim, qachon, versiya), tuzatilgan nusxa izohi, har sahifada pastki qism va sahifa raqami. Uzun matn sahifalar bo'ylab o'tadi.
  - Bitta tuzilish: dialog aynan shu PDF faylni ko'rsatadi, chop etadi va yuklab beradi (`xulosa-<bemorID>-<sana>.pdf`). Tugmalar: ko'rik oynasida "Xulosa", tibbiy kartada tasdiqlangan ko'rik ostida "Xulosa (PDF)".
  - Testlar: `visit-summary-pdf.test.ts` (bir sahifa, ko'p sahifa, fayl nomi), 8 ta API E2E (qoralama, ruxsatlar, audit), brauzerda dialog. PDF real ma'lumot bilan rasmga aylantirib ko'zdan kechirildi.
- [x] **B3.9** Natija shifokorga (`§11`, qabul mezoni 16.4): lab natijasi tasdiqlangach buyurtma bergan shifokorga bildirishnoma va kartaga biriktirish.
  - Yo'llanma bo'yicha buyurtma to'liq tasdiqlanganda (B4.5) yo'llanma bergan shifokorga bildirishnoma (`server/result-delivery.ts`): bemor, yo'llanma va buyurtma raqami, tahlillar, me'yordan tashqaridagilar ("muhim" belgisi). Bir marta (`dedupe_key`), qayta tasdiqlash takrorlamaydi. Tasdiqdan keyingi tuzatish alohida "Natija tuzatildi: eski → yangi" xabari bilan.
  - Bildirishnoma tasdiqlashni hech qachon buzmaydi (xatosi faqat logga yoziladi); serverless'da javobdan oldin kutiladi.
  - Natija kartaga biriktirilgan: ko'rik oynasida yo'llanma qatorida tasdiqlangan qiymatlar (me'yordan tashqarisi rangli), tibbiy kartada lab natijalari. Tasdiqlanmagan qiymat shifokorga ko'rinmaydi.
  - `notifications` jadvali — umumiy (B8.1 WebSocket shu qatorlarni yuboradi). API: `GET /api/notifications`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all` — faqat o'ziniki.
  - UI: yuqori paneldagi qo'ng'iroqcha (o'qilmaganlar soni, 30 s polling), shifokor kabinetida "Yangi tahlil natijalari" (bosilsa ko'rik oynasi ochiladi va o'qilgan bo'ladi).
  - Migratsiya: `npm run db:notifications` (`db:upgrade` ichida). Jadvalsiz bazada qo'ng'iroqcha bo'sh, boshqa hech narsa buzilmaydi. Neon'da avval ROLLBACK qilingan tranzaksiyada sinab ko'rildi, so'ng bajarildi (2026-11-06).
  - Testlar: `storage-file.test.ts` (3 ta), TZ §2 asosiy oqimi bo'yicha 18 ta API E2E (registratura → shifokor → yo'llanma → kassa → laborant → mudiri → shifokor), brauzerda shifokor tomoni.

### Bosqich 4: Laboratoriya / LIS (`§6`, `§15.4`) 91%

- [x] **B4.1** Lab bosh sahifasi (`§6.1.1`): TZ'dagi oltita ko'rsatkich.
  - `GET /api/lab-board` (`orders.read`): bugungi buyurtmalar, namuna kutilmoqda (rad etilganlar alohida), tahlil jarayonida, tasdiqlanishi kerak, bugun tayyor bo'lganlar, bugun bekor qilinganlar; bugungi buyurtmalar guruhlar bo'yicha; namuna kutayotgan eng eski 6 ta buyurtma. Postgres'da bitta CTE + ro'yxat parallel.
  - Qoidalar `shared/lab-board.ts` da (`summarizeLabBoard`, testlar bilan). Ish navbatlari kun bilan cheklanmaydi (kechagi tugallanmagan probirka bugungi ish). Namuna qabul qilinmagan buyurtma "jarayonda"ga kirmaydi. "Tayyor": hamma qatori tasdiqlangan, oxirgisi bugun. "Bekor qilingan": oxirgi o'zgarishi bugun. SQL va qoida real Neon ma'lumotida solishtirildi.
  - UI: bosh sahifada lab rollari uchun (`samples.manage`, `results.enter` yoki `results.verify`) "Laboratoriya · Bugungi kun" paneli. Har bir karta kerakli navbatni ochadi (`/results?queue=review`, `/orders?status=cancelled`). Ro'yxatdagi qator buyurtma oynasini ochadi. Eski "kutilayotgan/tayyor tahlillar" kartalari panel bor joyda ko'rsatilmaydi. 20 s da yangilanadi.
- [x] **B4.2** Buyurtmalar ro‘yxati (`§6.1.2`): bemor ID, F.I.Sh., yo'llanma raqami, **tahlil turi** (B4.6 guruhlari), buyurtma vaqti, holat. Guruh har o'qishda katalogdan JOIN bilan olinadi (`groups`), shuning uchun tahlil qayta tasniflansa ro'yxat ham o'zgaradi; migratsiya kerak emas. `?group=` filtri va guruh chiplari (sonlar boshqa filtrlar bilan, guruh filtrisiz). Eksportda ham. Chiplar katalog bilan umumiy (`GroupFilter`).
- [x] **B4.3** Namuna qabul qilish (`§6.1.3`, `§2`): namuna turi, probirka, sifat, Code 128.
  - Namuna turi va idish katalogi `shared/lab-catalogue.ts` (`SAMPLE_TYPES`, `TUBES`: qon EDTA / zardob / sitrat, siydik, najas, surtma, boshqa — idish nomi va qopqoq rangi). Buyurtma qatori tahlilning namuna turini **muzlatib** oladi (`order_tests.sample_type`): katalog keyin o'zgarsa ham olingan probirka o'zgarmaydi.
  - Buyurtma oynasida qaysi idishlar kerakligi (`tubesFor`): har biri o'z kodi va tahlillari bilan. Yorliq har bir idish uchun alohida, 58×30 mm, **Code 128** (`shared/code128.ts`, python-barcode bilan 95 belgida solishtirilgan), chetida qopqoq rangi. Kod: `LAB-1042-E` (buyurtma + namuna harfi); skanerlansa buyurtma ochiladi, eski `LAB-1042` ham ishlaydi.
  - Qabul qilishda laborant sifatni belgilaydi (`samples.quality`: yaxshi, gemoliz, lipemiya, ikterik, laxta, kam hajm + izoh). Nuqsonli namuna qabul qilinishi mumkin (belgi buyurtma bilan yuradi), ishlatib bo'lmasa rad etiladi. Orqaga qaytarishda sifat tozalanadi. Audit: "qabul qilindi, sifati: Gemoliz (izoh)".
- [x] **B4.4** Tahlil kiritish (`§6.1.4`): natija, birlik, referens, me'yor belgisi, izoh.
- [x] **B4.5** Natijalarni tasdiqlash (`§6.1.5`): laborant kiritadi → **lab mudiri** tekshiradi va tasdiqlaydi (yoki qaytaradi). Faqat tasdiqlangan natija blankaga va shifokorga chiqadi. Tasdiqlangandan keyin tuzatish versiya bilan.
  - Har bir tahlil qatorida holat (`shared/lab-verification.ts`): kiritilmagan → tasdiqlash kutilmoqda → tasdiqlangan; mudiri sabab bilan qaytarsa "qaytarilgan", laborant qiymatni qayta kiritganda belgi o'zi tushadi. Holat saqlanmaydi, `verified_at` / `returned_at` dan hisoblanadi.
  - Mudiri bir tugma bilan barcha kiritilganlarni tasdiqlaydi; qisman chiqarish mumkin (tayyor qatorlar tasdiqlanadi, qolganlari kutadi). Kim tasdiqladi, qachon; o'zi kiritganini tasdiqlasa auditda belgilanadi.
  - Tasdiqlangan qiymat qulflanadi: oddiy saqlash 409. Tuzatish (`results.amend`, sensitive) bitta tranzaksiyada: eski qiymat `order_test_versions` ga (kim, qachon, sabab), yangi qiymat keyingi versiya bo'lib tuzatuvchi nomidan tasdiqlanadi. Natija tarixi dialogi.
  - O'zgarmagan qatorni qayta saqlash kiritgan odam va vaqtni o'zgartirmaydi (`planResultSave`, ikkala storage uchun bitta qoida). Saqlash va tasdiqlash qatorlarni `FOR UPDATE` bilan qulflaydi.
  - **Faqat tasdiqlangan natija tashqariga chiqadi:** blanka (tasdiqlanmagani "tayyor emas", tasdiqlovchi, elektron tasdiqlash belgisi, namuna raqami), Telegram (`isOrderReady` = to'liq tasdiqlangan), tibbiy karta va natijalar dinamikasi, yo'llanma "Bajarildi" holati.
  - Navbatlar: Kiritish (bo'sh yoki qaytarilgan qator), Tasdiqlash (kiritilgan, tekshirilmagan), Tayyor (hammasi tasdiqlangan). Buyurtma ikki navbatda bo'lishi mumkin. Mudiri "Tasdiqlash" navbatida ochadi.
  - Ruxsatlar: `results.verify`, `results.amend` (lab mudiri). Audit: `verify`, `return`, `amend`.
  - Eski natijalar: migratsiya ustunlarni birinchi marta qo'shganda ularni "Tasdiqlash joriy etilishidan oldingi natija" deb belgilaydi (o'ylab topilgan tasdiqlovchi yo'q); keyingi ishga tushirishlar ularga tegmaydi. Fayl omborida `backfillVerification`.
  - Migratsiya: `npm run db:results` (`db:upgrade` ichida). **Yangi kod deploy qilinishidan OLDIN bajarilishi shart.** Neon'da avval ROLLBACK qilingan tranzaksiyada sinab ko'rildi, so'ng bajarildi (2026-11-06): 1 ta eski natija belgilandi, lab mudiriga ruxsatlar qo'shildi.
  - Testlar: `shared/lab-verification.test.ts`, `storage-file.test.ts` (8 ta), 22 ta API E2E, brauzerda mudiri yo'li (navbat → qaytarish → tasdiqlash → blanka).
- [x] **B4.6** Tahlillar katalogi (`§6.2`): TZ'dagi 8 guruh (`tests.group`: gematologiya, biokimyo, gormonlar, immunologiya, koagulologiya, diabet, infeksiyalar, siydik + "boshqa") va namuna turi (`tests.sample_type`). Mavjud kategoriya (bo'lim sarlavhasi) saqlanadi, guruh uning ustida. Sozlamalar → Tahlillar: guruh filtrlari, "Guruh · kategoriya" va "Namuna" ustunlari, formada guruh va namuna (yangi tahlilda nomidan taklif qilinadi, `classifyTest`), eksportda ham.
  - Sarf normasi **B5.6 ga ko'chirildi**: u ombor mahsulotlariga (B5.1) havola qiladi, ular hali yo'q.
  - Migratsiya: `npm run db:lab-catalog` (`db:upgrade` ichida, `tsx`). Ustunlar; mavjud tahlillar faqat **birinchi** ishga tushishda tasniflanadi (keyin qo'lda o'zgartirilgani ustidan yozilmaydi); eski buyurtma qatorlariga namuna turi; `samples.quality`. **Yangi kod deploy qilinishidan OLDIN bajarilishi shart.** Neon'da avval ROLLBACK qilingan tranzaksiyada sinab ko'rildi, so'ng bajarildi (2026-11-06): 119 tahlil tasniflandi, 9 qator to'ldirildi; qayta ishga tushirish hech narsani o'zgartirmadi.
  - Testlar: `shared/lab-catalogue.test.ts`, `shared/code128.test.ts`, `shared/sample.test.ts`, `storage-file.test.ts` (5 ta), API va brauzerda katalog → buyurtma → qabul → yorliqlar → skan.
- [x] **B4.7** Natija blankasi (`§6.3`): TZ ro'yxatidagi hamma maydon — **klinika logotipi**, bemor F.I.Sh. va ID, tug'ilgan sana, namuna raqami, tahlil, natija, birlik, referens, natija sanasi, laborant va tasdiqlovchi, elektron tasdiqlash belgisi.
  - Logo: Sozlamalar → Klinika → "Klinika logotipi" (`settings.manage`). Brauzer rasmni 640×240 ichiga kichraytirib qayta kodlaydi (`client/src/lib/logo.ts`). Server faqat PNG/JPEG qabul qiladi, haqiqiy baytlar e'lon qilingan turga mos bo'lishi va hajm 300 KB dan oshmasligi kerak (`shared/branding.ts` `checkLogo`; SVG ataylab rad etiladi). `app_settings` jadvalidagi `logo` kalitida saqlanadi (D-3 fayl ombori kerak emas, migratsiya yo'q). `GET/PUT/DELETE /api/settings/logo`, audit bilan. JSON chegarasi faqat shu yo'l uchun 512 KB, qolganlari 100 KB; 413 xabari o'zbekcha.
  - Natija blankasi shapkasida va ko'rik xulosasi PDF'ida (B3.8) chiqadi; chizib bo'lmaydigan logo hujjatni to'xtatmaydi.
  - "QR orqali tekshirish" TZ §6.3 da yo'q, shuning uchun qilinmadi. U bemor natijasiga ochiq havola demak (xavfsizlik qarori), buyurtmachi so'rasa alohida vazifa bo'ladi.
- [x] **B4.8** Sifat nazorati (`§6.5`): TZ'dagi to'qqizta band.
  - **Nazorat materiallari** (`qc_materials`): nomi, ishlab chiqaruvchi, **LOT**, daraja, **yaroqlilik muddati**, faol. Nom + LOT + daraja takrorlanmaydi. **Seriya** (`qc_targets`): material + tahlil + qurilma (ixtiyoriy) uchun o'rtacha qiymat va SD (musbat, CHECK), birlik katalogdan. Bitta material/tahlil/qurilmaga bitta seriya (`UQ_qc_targets_series`, 409).
  - **Ichki nazorat** (`qc_results`): natija kiritilganda seriyaning oldingi natijalari bilan **Westgard** qoidalari (1₂s ogohlantirish; 1₃s, 2₂s, R₄s, 4₁s, 10x̄ rad) bo'yicha baholanadi (`shared/qc.ts` `judgeQcRun`, ikkala storage uchun bitta). Seriya `FOR UPDATE` bilan qulflanadi. O'sha paytdagi o'rtacha/SD va hukm natija bilan saqlanadi: keyin seriya o'zgarsa ham eski baho o'zgarmaydi. Orqa sanali natija o'zidan oldingi tarix bilan baholanadi. Muddati o'tgan material bilan natija kiritilmaydi (409), muddati o'tgan reagent rad etiladi (400), kelajak vaqti rad etiladi. Reagent LOT va muddati natija bilan yoziladi (TZ §6.5).
  - **Chora**: ogohlantirish yoki rad etilgan natijaga bir marta (`reviewed_*`). **Bekor qilish** (`qc.manage`): sabab bilan, o'chirilmaydi, seriyadan va grafikdan chiqadi.
  - **Levey–Jennings kartasi** (`client/src/components/qc/lj-chart.tsx`): SD birliklarida (har bir nuqta o'z bahosidagi z bilan), x̄ va ±1/2/3SD chiziqlari joriy qiymatlari bilan, holat rang **va shakl** bilan (doira / uchburchak / romb), eng yaqin nuqtaga yopishadigan kursor va tooltip, klaviatura (←/→), pastida jadval. Dataviz qoidalari bo'yicha.
  - **Kalibratsiya tarixi** (`calibrations`): qurilma, tahlil, kalibrator nomi/LOT/muddati, reagent LOT/muddati, natija; muddati o'tgan kalibrator yoki reagent rad etiladi. **Texnik xizmat jurnali** (`device_maintenance`): turi (kundalik … servis muhandisi), nima qilindi, keyingi sana; 7 kun ichida yoki kechikkanlar ko'rsatiladi. **Tashqi nazorat** (`eqa_results`): dastur, tsikl, namuna, bizning natija, belgilangan qiymat, SD → z va ISO 13528 bahosi (|z| ≤ 2 qoniqarli, 2–3 shubhali, > 3 qoniqarsiz), bekor qilish sabab bilan.
  - Ruxsatlar: `qc.read` (laborant, lab mudiri, rahbar, auditor), `qc.enter` (laborant, lab mudiri), `qc.manage` (lab mudiri). API `server/routes-qc.ts` (`/api/qc…`), har bir amal auditda (`qc`).
  - UI: Ish maydoni → Sifat nazorati (`/qc`): ko'rsatkichlar (faol seriyalar, bugun o'lchangan, chora kutilmoqda, material muddati), tablar — Ichki nazorat (seriyalar, karta, kiritish, tarix), Nazorat materiallari, Kalibratsiya, Texnik xizmat, Tashqi nazorat. `?tab=` bilan to'g'ridan-to'g'ri ochiladi.
  - Migratsiya: `npm run db:qc` (`db:upgrade` ichida): 6 jadval, indekslar, tizim rollariga ruxsatlarni **faqat qo'shadi**. Jadvalsiz bazada sahifa bo'sh, yozish 503; boshqa hech narsa bu jadvallarni o'qimaydi. Neon'da avval ROLLBACK qilingan tranzaksiyada sinab ko'rildi (migratsiya ikki marta, unique va CHECK cheklovlari, board so'rovi, Westgard oqimi), so'ng bajarildi (2026-11-07): 6 jadval, indekslar, 4 ta rolga ruxsatlar; qayta ishga tushirish hech narsani o'zgartirmadi.
  - Testlar: `shared/qc.test.ts` (Westgard, statistika, EQA, sanalar), `storage-file.test.ts` (5 ta), brauzerda lab mudiri, laborant va auditor yo'li (37 tekshiruv, telefon o'lchami bilan).
  - Reagent partiyalari ombor bilan bog'lanishi (LOT ni ombordan tanlash) — B5.2 dan keyin.
- [x] **B4.9** Analizatorlar ro‘yxati (`§6.4`, `lab_devices`): qurilmalar va xatolar jurnali.
  - `lab_devices`: nom (katta-kichik harf va bo'shliqqa qaramay takrorlanmas), ishlab chiqaruvchi, model, seriya raqami, yo'nalish (biokimyo, gematologiya, immunologiya, IXLA, IFA, koagulologiya, siydik, boshqa), **ulanish usuli** (qo'lda / RS-232 / TCP/IP / HL7 / ishlab chiqaruvchi protokoli — TZ §6.4 bo'yicha qurilma-qurilma tekshiriladi, D-4 hal bo'lguncha "qo'lda"), holat (ishlamoqda / texnik xizmatda / ishdan chiqqan), joylashuv, o'rnatilgan sana, izoh, §10 ustunlari.
  - `lab_device_errors` (TZ §6.4 "Qurilma xatolarini qayd etish"): daraja (ogohlantirish / xato / jiddiy), kod, nima bo'ldi, ko'rilgan chora, qachon (kelajak vaqti rad etiladi), kim yozdi. **O'chirilmaydi va tahrirlanmaydi**, "hal qilindi" deb sabab bilan bir marta yopiladi (shartli `UPDATE … WHERE resolved_at IS NULL`, ikkinchisi 409). Yozish bilan birga qurilmani "ishdan chiqqan" deb belgilash mumkin (bitta tranzaksiya; "jiddiy" tanlansa taklif qilinadi).
  - Jurnali bor qurilma o'chirilmaydi (409, `FOR UPDATE` ostida tekshiriladi), faqat holati o'zgartiriladi. Qoidalar va yorliqlar `shared/lab-devices.ts`.
  - Ruxsatlar (laboratoriya guruhi): `devices.read` (laborant, lab mudiri, rahbar, auditor), `devices.log` (laborant, lab mudiri), `devices.manage` (lab mudiri). API `server/routes-lab.ts`: `GET/POST/PATCH/DELETE /api/devices`, `GET /api/device-errors?deviceId=&open=1`, `POST /api/devices/:id/errors`, `POST /api/device-errors/:id/resolve`. Har bir amal auditda (`device`).
  - UI: Klinika → Analizatorlar (`/devices`): statistika (jami, ishlamayotgan, ochiq xatolar, qo'lda kiritiladiganlar), qurilma kartalari (holat, yo'nalish, ulanish, joylashuv, S/N, ochiq xatolar), TZ §6.4 dagi 6 ta analizatorni bir bosishda qo'shish, xatolar jurnali (ochiq / hammasi, qurilma bo'yicha), xato yozish va yopish dialoglari.
  - Migratsiya: `npm run db:devices` (`db:upgrade` ichida): ikkala jadval, indeks, tizim rollariga ruxsatlarni **faqat qo'shadi**. Jadvalsiz bazada sahifa bo'sh, yozish 503; boshqa hech narsa bu jadvallarni o'qimaydi. Neon'da avval ROLLBACK qilingan tranzaksiyada sinab ko'rildi (migratsiya ikki marta, storage so'rovlari aynan shu ko'rinishda), so'ng bajarildi (2026-11-07): ikkala jadval, 4 ta rolga ruxsatlar; qayta ishga tushirish hech narsani o'zgartirmadi.
  - Testlar: `shared/lab-devices.test.ts`, `storage-file.test.ts` (4 ta), brauzerda lab mudiri, laborant va auditor yo'li (telefon o'lchami bilan). Kalibratsiya tarixi va texnik xizmat jurnali B4.8 da (TZ §6.5).
- [ ] **B4.10** Analizator integratsiyasi (`§6.4`): import API + lokal ko‘prik (D-4), namuna ID bo‘yicha moslashtirish, avtotekshiruv, takroriy natija nazorati, operator tasdig‘i. Protokol bo‘lmasa qo‘lda kiritish qoladi.
- [x] **B4.11** Natijani bemorga elektron yetkazish (`§1`): Telegram bot.

### Bosqich 5: Ombor (`§7`, `§15.5`) 43%

- [x] **B5.1** Mahsulotlar katalogi (`§7.2`, `inventory_items`): 8 tur, o‘lchov birligi, minimal qoldiq.
  - `inventory_items`: nomi, turi (TZ §7.2 dagi 8 tur: reagentlar, kalibratorlar, nazorat materiallari, probirkalar, shpritslar, sarf materiallari, dori vositalari, dezinfeksiya vositalari), artikul (ixtiyoriy), ishlab chiqaruvchi, o'lchov birligi (erkin, takliflar bilan; turga qarab standart taklif), minimal qoldiq (kasr ham, manfiy emas), sotuv yoki hisobdan chiqarish narxi (TZ §7.3, butun so'm, ixtiyoriy), faol, izoh, §10 ustunlari. Nom va artikul katta-kichik harf va bo'shliqqa qaramay takrorlanmaydi: route tekshiradi, Postgres'da `UQ_inventory_items_name` / `_code` oxirgi himoya (poygada ham 409). Qoidalar `shared/inventory.ts`.
  - Yangi ruxsat guruhi "Ombor": `inventory.read` (omborchi, lab mudiri, rahbar, buxgalter, auditor), `inventory.manage` (omborchi). Kirim/chiqim ruxsatlari o'z route'lari bilan (B5.2, B5.3). API `server/routes-inventory.ts`, audit (`inventory`).
  - Kirim yoki chiqimi bor mahsulot o'chirilmaydi (B5.2 dan, 409), faqat faolsizlantiriladi.
  - UI: Ish maydoni → Ombor (`/inventory`): ko'rsatkichlar (faol, turlar 8 dan, narxi belgilanmagan, faolsiz), qidiruv (nom, artikul, ishlab chiqaruvchi), tur chiplari (ikonkalar bilan), faolsizlarni ko'rsatish, jadval, joyida faol/faolsiz, dialog, Excel/PDF eksport. Keyingi bosqichlar shu sahifaga tab bo'lib qo'shiladi.
  - Migratsiya: `npm run db:inventory` (`db:upgrade` ichida): jadval, unique indekslar, CHECK'lar, tizim rollariga ruxsatlarni **faqat qo'shadi**. Neon'da avval ROLLBACK qilingan tranzaksiyada sinab ko'rildi, so'ng bajarildi (2026-11-07): jadval, indekslar, 5 ta rolga ruxsatlar; qayta ishga tushirish hech narsani o'zgartirmadi.
  - Testlar: `shared/inventory.test.ts`, `storage-file.test.ts`, brauzerda omborchi, lab mudiri (faqat ko'radi) va registrator (ruxsat yo'q) yo'li (29 tekshiruv, telefon o'lchami bilan).
- [x] **B5.2** Kirim hujjati (`§7.3`): yetkazib beruvchi, LOT, yaroqlilik muddati, miqdor, xarid narxi (`inventory_batches`, `stock_movements`).
  - `stock_receipts`: raqam (identity, "Kirim №12"), yetkazib beruvchi (oldingilaridan taklif), uning hujjat raqami, sana (kelajak emas), izoh, jami, kim. **O'chirilmaydi**: partiyalaridan hech narsa ishlatilmagan bo'lsa sabab bilan bekor qilinadi (`inventory.manage`); ishlatilgan bo'lsa 409.
  - Har bir qator — **partiya** (`inventory_batches`): mahsulot, LOT, yaroqlilik muddati, kelgan miqdor, `remaining`, xarid narxi. `stock_movements` — qoldiq daftari (+ kirim, − bekor qilish / keyin chiqim); `remaining` shu daftarning keshi, har bir harakat bilan bitta tranzaksiyada yangilanadi. CHECK: `0 ≤ remaining ≤ quantity`, miqdor > 0, harakat ≠ 0, narx ≥ 0.
  - Qoidalar (`shared/inventory.ts` `receiptLineProblem`): reagent, kalibrator, nazorat materiali va dori uchun LOT va muddat majburiy; **muddati o'tgan mahsulot qabul qilinmaydi**; faolsiz mahsulot qabul qilinmaydi; bir hujjatda bir mahsulot+LOT ikki marta bo'lmaydi. Xato qator raqami bilan qaytadi ("2-qator: …").
  - Katalog endi har bir mahsulotning **qoldig'ini** (tirik partiyalar yig'indisi) va eng yaqin muddatini ko'rsatadi; "kam qolgan" ko'rsatkichi. Jadvallar yo'q bazada katalog qoldiqni 0 deb ishlaydi.
  - Ruxsat: `inventory.receive` (omborchi). Audit: kirim (yetkazib beruvchi, qatorlar, LOT, jami) va bekor qilish.
  - UI: Ombor → "Kirim" tabi: oy bo'yicha jami, hujjatlar ro'yxati, yangi kirim (ko'p qatorli, telefonda har maydon nomi bilan, jami jonli hisoblanadi), hujjat ko'rinishi va **chop etish** (imzo joylari bilan), bekor qilingani muhr bilan.
  - Migratsiya: `npm run db:stock` (`db:upgrade` ichida). Neon'da avval ROLLBACK qilingan tranzaksiyada sinab ko'rildi (CHECK'lar, identity, katalog so'rovi, bekor qilishda daftar nolga tushishi), so'ng bajarildi (2026-11-08): 3 jadval, indekslar, omborchiga ruxsat; qayta ishga tushirish hech narsani o'zgartirmadi.
  - Testlar: `shared/inventory.test.ts` (+4), `storage-file.test.ts` (2), brauzerda omborchi va lab mudiri yo'li (26 tekshiruv, telefon o'lchami bilan).
- [x] **B5.3** Chiqim va bo‘limlarga berish (`§7.1`): qaysi bo‘limga, kim oldi. FEFO (muddati yaqinini birinchi).
  - `stock_issues` (raqam "Chiqim №"): **bo'limga berish** (bo'lim — faol bo'lishi shart, kim oldi — majburiy) yoki **hisobdan chiqarish** (sabab: muddati o'tgan, shikastlangan, boshqa). CHECK: bo'limga berishda bo'lim, hisobdan chiqarishda sabab bo'lmasa baza ham rad etadi. Sana kelajak emas. Tannarx (xarid narxlari bo'yicha) hujjatda.
  - Hujjat qatorlari — `stock_movements` dagi harakatlar (`issue_id`), har bir partiyaga bittadan. **FEFO** (`shared/inventory.ts` `allocateFefo`, `planIssue`): muddati eng yaqin partiya birinchi, muddatsiz oxirida, tenglarda eski kirim birinchi; **muddati o'tgan partiya bo'limga berilmaydi** (faqat hisobdan chiqariladi). Aniq partiyani tanlash mumkin (avval o'shalar, keyin FEFO qolganidan). Bir hujjatdagi bir mahsulotning ikki qatori bitta qoldiq nusxasida hisoblanadi. Yetishmasa qator raqami va qoldiq bilan rad etiladi ("1-qator: … qoldiq 3, so'ralgan 5").
  - Partiyalar `FOR UPDATE` (doimiy tartibda, deadlock'siz) ostida taqsimlanadi; `remaining` va harakatlar bitta tranzaksiyada. Bekor qilish (`inventory.manage`, sabab bilan, bir marta): har bir miqdor **o'zi olingan partiyaga** qaytadi (`issue_cancel` harakati). Chiqim bo'lgan kirimni bekor qilib bo'lmaydi (B5.2 qoidasi).
  - API: `GET /api/inventory/batches?itemId=` (tirik partiyalar, FEFO tartibida; B5.4 ning asosi), `GET/POST /api/inventory/issues`, `GET /api/inventory/issues/:id`, `POST /api/inventory/issues/:id/cancel`. Ruxsat `inventory.issue` (omborchi). Audit: bo'lim, kim oldi yoki sabab, mahsulotlar va LOT'lar, tannarx.
  - UI: Ombor → "Chiqim" tabi: oy bo'yicha bo'limlarga va hisobdan chiqarilgan jami, ro'yxat, "Bo'limga berish" / "Hisobdan chiqarish" dialogi (har qatorda qoldiq, ixtiyoriy partiya, **saqlashdan oldin qaysi partiyadan qancha olinishi** — server bilan bir xil qoida; yetishmasa darhol ko'rinadi; tannarx jonli), chop etiladigan hujjat (bo'limga berish yoki hisobdan chiqarish dalolatnomasi, imzo joylari), bekor qilish.
  - Migratsiya: `npm run db:issues` (`db:upgrade` ichida). **Yangi kod deploy qilinishidan OLDIN bajarilishi shart**: har bir harakat yozuvi (kirim ham) `issue_id` ni nomlaydi. Neon'da ROLLBACK qilingan tranzaksiyada sinab ko'rildi (mavjud jadvalga ustun, CHECK'lar, FEFO oqimi qulflangan qatorlarda, ro'yxat va tafsilot so'rovlari, daftar = qoldiq).
  - Testlar: `shared/inventory.test.ts` (+5: FEFO tartibi, muddati o'tgan, rejalash, xabarlar), `storage-file.test.ts` (3), brauzerda omborchi va lab mudiri yo'li (31 tekshiruv, telefon o'lchami bilan).
- [ ] **B5.4** Qoldiq va yaroqlilik muddati (`§7.1`, `§7.3`): partiyalar bo‘yicha qoldiq, muddati yaqinlashganlar haqida ogohlantirish.
- [ ] **B5.5** Inventarizatsiya (`§7.1`): hisoblangan va haqiqiy qoldiq farqi, tuzatish harakati.
- [ ] **B5.6** Reagent sarfini avtomatik hisoblash (`§7.3`, `§11` Lab→Ombor): tahlil uchun tasdiqlangan sarf normasi bo‘yicha (normani tahlil katalogida belgilash ham shu yerda, B4.6 dan ko'chirildi), real sarfni tuzatish imkoni bilan.
- [ ] **B5.7** Ombor bosh sahifasi va hisobotlari (`§7.1`).

### Bosqich 6: Statsionar (`§8`, `§15.6`) 0%

- [ ] **B6.1** Palata va yotoqlar (`beds`): bo‘lim → palata → yotoq, holati.
- [ ] **B6.2** Bemorni yotqizish (`§8.1.2`, `admissions`): bemor ID, bo‘lim, palata, yotoq, sana, qabul qiluvchi shifokor.
- [ ] **B6.3** Statsionar bosh sahifasi (`§8.1.1`): jami, bo‘sh/band o‘rinlar, yangi yotqizilgan, chiqarilayotganlar. Yotoqlar xaritasi.
- [ ] **B6.4** Kasallik tarixi (`§8.1.3`): shikoyat, anamnez, tashxis, kundalik kuzatuv, lab natijalari, tekshiruvlar, davolash rejasi.
- [ ] **B6.5** Muolajalar (`§8.1.4`, `procedures`): tayinlov → jadval → hamshira bajaradi (kim, qachon) → holat.
- [ ] **B6.6** Integratsiya (`§8.2`): lab buyurtmasi kartadan, dori sarfi omborga, xizmatlar (yotoq-kun, muolajalar) kassa hisobiga.
- [ ] **B6.7** Chiqarish va epikriz (`§8.1.5`): yakuniy tashxis, xulosa, epikriz (avto-to‘ldirish + tahrir), tavsiyalar, PDF.

### Bosqich 7: Kassa va moliya (`§9`, `§15.7`) 33%

- [ ] **B7.1** Bemor hisobvarag‘i (`§9.1`, `invoices`): barcha modullardagi xizmatlar (ko‘rik, lab, UZI, muolaja, statsionar) bitta hisobvaraqqa tushadi (`§11`).
- [~] **B7.2** To‘lov qabul qilish (`§9.2`): naqd, karta, o‘tkazma, qisman to‘lov, chegirma bor (faqat lab buyurtmasi uchun). **Qoldi:** bir nechta xizmat uchun umumiy to‘lov (hisobvaraq orqali), terminal va bank turlarini aniq ajratish.
- [~] **B7.3** Qarzdorlik nazorati (`§9.1`): buyurtma bo‘yicha bor. **Qoldi:** bemor bo‘yicha jamlangan qarzdorlik sahifasi.
- [~] **B7.4** To'lovni qaytarish (`§9.2`): qaytarish endi alohida `payments.refund` ruxsati bilan (standart: rahbar va super admin) — registrator/kassir qaytara olmaydi. **Qoldi:** "so'rov → tasdiq" oqimi (kassir so'raydi, rahbar tasdiqlaydi) va "qaytarilgan to'lovlar" ekrani.
- [ ] **B7.5** Kassa smenasi (`§9.2`): ochish, yopish, kassadagi summa, farq, smena hisoboti.
- [ ] **B7.6** Chek (`§15.7`): to‘lov cheki chop etish.
- [ ] **B7.7** Kassa bosh sahifasi, kunlik tushum, xizmatlar narxlari ekrani (`§9.1`).
- [~] **B7.8** Moliyaviy hisobotlar (`§9.1`): tushum va xarajatlar bor. **Qoldi:** buxgalter uchun davr bo‘yicha to‘liq hisobot.
- [x] **B7.9** Xarajatlar sahifasi (`§9`, `§10`, `§13`): to'lov usuli va oluvchi; o'chirish o'rniga sababli bekor qilish (yozuv saqlanadi, hisobotlarga kirmaydi); tahrirlash audit bilan; butun davr tahlili (`/api/expenses/summary`: kategoriya, to'lov usuli, kunlik dinamika, o'tgan davr bilan solishtirish); filtrlar (kategoriya, usul, matn, bekor qilinganlar); davr shablonlari; CSV. Migratsiya: `npm run db:expenses` (**yangi kod ishga tushishidan OLDIN** bajarilishi shart).

### Hisobotlar va rahbariyat paneli (`§13`) 32%

- [~] **R.1** Rahbariyat boshqaruv paneli: hozirgi bosh sahifa statistikasi asos.
- [~] **R.2** Kunlik bemorlar soni · [ ] shifokorlar faoliyati · [~] lab tahlillari soni · [ ] eng ko‘p buyuriladigan tahlillar · [ ] reagent sarfi · [ ] ombor qoldig‘i · [ ] statsionar bandligi · [x] kunlik/oylik tushum · [ ] xizmatlar daromadi · [~] qarzdorlik · [x] xarajatlar.
- [~] **R.3** PDF va Excel eksport: bor. Har yangi hisobotga qo‘shiladi.

### Bosqich 8: Yakuniy integratsiya va texnik talablar (`§11`, `§12`, `§14`, `§15.8`) 11%

- [ ] **B8.1** Real vaqt xabarlari (`§2`, `§11`): WebSocket; navbat, yangi natija, yangi yo‘llanma darhol ko‘rinadi.
- [ ] **B8.2** Fayl ombori (`§2`, D-3): UZI rasmlari, skanlar, PDF arxiv.
- [~] **B8.3** Avtomatik zaxira (`§12`, `§14`): `/api/backup` va `db:restore` bor. **Qoldi:** jadval bo‘yicha avtomatik backup va **tiklash sinovi** (qabul mezoni 16.10).
- [ ] **B8.4** Monitoring va xatolar jurnali (`§14`): server xatolari, modul bo‘yicha javob vaqti.
- [~] **B8.5** Moslashuvchan interfeys (`§14`): yangi sahifalar (rollar, xarajatlar, sozlamalar) telefon o'lchamida tekshirildi. **Qoldi:** eski sahifalarni (bemorlar, buyurtmalar, natijalar) planshet/telefonda to'liq tekshirish.
- [ ] **B8.6** Modullararo end-to-end test: TZ `§2` dagi ikkala sxema bo‘yicha to‘liq yo‘l.
- [ ] **B8.7** Xavfsizlik sinovi (`/security-review` + qo‘lda): ruxsatlarni chetlab o‘tish, IDOR, sessiya.
- [ ] **B8.8** Yuklama sinovi (`§14`): 150 ta parallel foydalanuvchi.
- [ ] **B8.9** Xodimlar uchun qo‘llanma (rol bo‘yicha) va ishga tushirish.

---

## 4. Qabul mezonlari (`§16`), yakuniy tekshiruv

| # | Mezon | Bog‘liq vazifalar | Holat |
|---|---|---|---|
| 16.1 | Bitta bemor barcha modullarda yagona ID bilan | B1.9, B2.5 | ✅ (yangi modullar `PATIENT_LINKS` ga yoziladi) |
| 16.2 | Registraturadan shifokorga buyurtma | B2.7, B2.8, B3.1 | ✅ |
| 16.3 | Shifokordan laboratoriyaga yo‘llanma | B3.5 | ✅ |
| 16.4 | Tasdiqlangan natija shifokorga yetadi | B4.5, B3.9 | ✅ |
| 16.5 | Ombor kirim/chiqim to‘g‘ri hisoblanadi | B5.2–B5.6 | 🟡 (kirim, chiqim, FEFO, daftar = qoldiq; inventarizatsiya va reagent sarfi qoldi) |
| 16.6 | Statsionar bemorining elektron tarixi | B6.* | ❌ |
| 16.7 | Barcha xizmatlar kassa bilan bog‘langan | B2.6, B7.1 | 🟡 |
| 16.8 | Xodimlar vakolatlari to‘g‘ri ishlaydi | B1.4, B8.7 | 🟡 |
| 16.9 | Audit barcha muhim o‘zgarishlarni qayd etadi | B1.6 | 🟡 |
| 16.10 | Zaxiradan tiklash sinovdan o‘tgan | B8.3 | 🟡 |

---

## 5. O‘zgarishlar jurnali

Har bir tugallangan vazifadan keyin bitta qator: `YYYY-MM-DD · ID · nima qilindi`.

- 2026-11-05 · — · Refresh tezligi: foydalanuvchi `localStorage` dan darhol chiziladi, `deserializeUser` 30 s keshlanadi.
- 2026-11-05 · — · TZ ([docs/TZ.md](docs/TZ.md)) va shu ish rejasi yaratildi.
- 2026-11-05 · D-1 · Stack qarori: Django o‘rniga joriy Node/Express/TS stack qoladi.
- 2026-11-05 · B1.4 · RBAC: 11 rol, 26 ruxsat, rollar ekrani, server himoyasi. Yo‘l-yo‘lakay: bazasiz (JSON) rejimni buzayotgan `db-pg` importi tuzatildi; registrator API orqali buyurtmani bekor qila olishi va pul qaytara olishi yopildi.
- 2026-11-05 · B1.5 · Bo'limlar va shifokorlar: jadvallar, API, Sozlamalar tablari, ish jadvali muharriri.
- 2026-11-05 · B1.7 · Seans xavfsizligi: faolsizlik/umumiy muddat, ogohlantirish oynasi, faol seanslar ro'yxati, parol almashganda seanslarni yopish.
- 2026-11-05 · B7.9 · Xarajatlar sahifasi to'liq; menyuda "Klinika" bo'limi (Shifokorlar, Bo'limlar, Xodimlar+Rollar alohida sahifalar); noma'lum /api yo'llari endi 404 JSON qaytaradi.
- 2026-11-05 · B2.1–B2.3 · Bemor ma'lumotlari: tug'ilgan sana, hujjatlar, favqulodda aloqa, takroriy bemorni aniqlash va bloklash, kartalarni birlashtirish, oxirgi tashrif.
- 2026-11-05 · B2.4–B2.5, B1.6 · Bemor kartasi sahifasi, tashriflar jadvali, kartani ochish jurnali.
- 2026-11-05 · B1.8 · Ikki bosqichli autentifikatsiya: TOTP, zaxira kodlar, rol bo'yicha majburiylik, admin reset, qulf bilan bog'langan kod xatolari.
- 2026-11-05 · B2.6–B2.8, B3.1 · Xizmatlar katalogi va narxlar ro'yxati, qabulga yozish (bo'sh vaqtlar, navbat raqami, poyga himoyasi), navbat sahifasi, shifokor kabineti, qabullar bemor kartasi va tashriflarida. Yo'l-yo'lakay: route yordamchilari `route-helpers.ts` ga chiqarildi.
- 2026-11-06 · B3.3, B3.7, B3.2 (qisman) · Ko'rik oynasi (avtosaqlash, revision to'qnashuvi himoyasi), tasdiqlash va versiyali tuzatish, elektron tibbiy karta (allergiyalar, tashxislar tarixi, lab natijalari), kabinetda tugallanmagan kartalar. Yo'l-yo'lakay: navbat va kabinet ekranlari eskirgan keshni ko'rsatardi (global `refetchOnMount: false`), tuzatildi.
- 2026-11-06 · B3.4, D-5 · MKB-10: rasmiy NSI katalogi (15 038 yozuv), o'zbekcha nomlar ustuni va uni to'ldirish ekrani/importi, ko'rik yozuvida ixtiyoriy dastlabki/yakuniy tashxis kodlari (versiyalar, tarix, PDF), kod va nom bo'yicha qidiruv.
- 2026-11-06 · B3.8 · Ko'rik xulosasi PDF: faqat tasdiqlangan yozuvdan, allergiyalar, yo'llanmalar va tasdiqlangan natijalar bilan, elektron tasdiq belgisi; bitta PDF ham ko'rinish, ham chop etish, ham yuklab olish; chiqarish auditga yoziladi.
- 2026-11-06 · B3.9 · Natija shifokorga: to'liq tasdiqlangan yo'llanma buyurtmasi haqida shifokorga bir martalik bildirishnoma (me'yordan tashqarisi belgilangan), tuzatish haqida alohida xabar; qo'ng'iroqcha, kabinetdagi "Yangi tahlil natijalari", ko'rik oynasida qiymatlar. 16.4 yopildi.
- 2026-11-06 · B4.5 · Natijalarni tasdiqlash: qator bo'yicha holat, mudiri tasdiqlaydi yoki sabab bilan qaytaradi, tasdiqlangan natija qulflanadi va versiya bilan tuzatiladi; blanka, Telegram, tibbiy karta va yo'llanma faqat tasdiqlangan natijani oladi; uch navbatli natijalar sahifasi.
- 2026-11-06 · B3.5 · Yo'llanmalar: laboratoriya (buyurtma darhol yaratiladi), UZI va boshqa tekshiruvlar, mutaxassis konsultatsiyasi; registratura navbatga yozadi, holat buyurtma yoki qabuldan hisoblanadi; bekor qilish sabab bilan. B1.9 reyestri yangi `referrals` jadvalini darhol ushladi.
- 2026-11-06 · B1.9, B1.10, B2.11 · Qarzlar yopildi: bemorga bog'langan jadvallar reyestri va o'chirish himoyasi, §10 umumiy ustunlari, to'lovni o'chirish o'rniga sababli bekor qilish, to'lovli yoki natijali buyurtma va ishlatilgan tahlil o'chirilmaydi, registratura bosh sahifasi. Yo'l-yo'lakay: buyurtma oynasi ro'yxatdagi qisqa nusxani ko'rsatardi, shuning uchun to'lovlar tarixi doim bo'sh chiqardi va to'lovdan keyin oyna yangilanmasdi. Endi oyna to'liq buyurtmani o'zi yuklaydi.
- 2026-11-10 · B5.3 · Chiqim: bo'limga berish (kim oldi) va hisobdan chiqarish (sabab), FEFO taqsimlash (muddati o'tgan partiya bo'limga berilmaydi), aniq partiya tanlash, saqlashdan oldin taqsimot ko'rinishi, bekor qilishda partiyalarga qaytarish, chop etiladigan hujjat.
- 2026-11-07 · B5.2 · Kirim hujjati: partiyalar (LOT, muddat, xarid narxi) va qoldiq daftari, muddati o'tgan mahsulot qabul qilinmaydi, kirimni faqat ishlatilmagan bo'lsa bekor qilish, katalogda qoldiq va eng yaqin muddat, hujjatni chop etish; harakati bor mahsulot o'chirilmaydi.
- 2026-11-07 · B5.1 · Ombor mahsulotlari katalogi: TZ'dagi 8 tur, o'lchov birligi, minimal qoldiq, sotuv/hisobdan chiqarish narxi, artikul; takrorlanmas nom va artikul (poygada ham), yangi "Ombor" ruxsat guruhi, Ombor sahifasi.
- 2026-11-07 · B4.8 · Sifat nazorati: nazorat materiallari (LOT, muddat) va seriyalar, Westgard bahosi natija bilan saqlanadi, Levey–Jennings kartasi, chora va bekor qilish, kalibratsiya tarixi, texnik xizmat jurnali (navbatdagi xizmatlar), tashqi nazorat (z, ISO 13528); muddati o'tgan material/reagent/kalibrator rad etiladi.
- 2026-11-07 · B4.9 · Analizatorlar: qurilmalar (yo'nalish, ulanish usuli, holat), o'chirilmaydigan xatolar jurnali (daraja, kod, chora, hal qilish), nosoz qurilmani bir qadamda ishdan chiqqan deb belgilash, TZ §6.4 dagi 6 ta analizator namuna sifatida, uchta yangi ruxsat.
- 2026-11-07 · B4.7 · Klinika logotipi: yuklash (brauzerda kichraytirish, serverda tur va hajm tekshiruvi, audit), natija blankasi va ko'rik xulosasi PDF'ida. Yo'l-yo'lakay: body-parser xatolari (413, buzuq JSON) endi o'z statusi va o'zbekcha xabar bilan qaytadi.
- 2026-11-07 · B4.2, B4.1 · Buyurtmalarda tahlil turi (ustun, filtr, chiplar) va bemor ID; laboratoriya bosh sahifasi: TZ'dagi oltita ko'rsatkich, namuna kutayotganlar ro'yxati, bugungi buyurtmalar guruhlar bo'yicha, kartalardan to'g'ri navbatga o'tish.
- 2026-11-06 · B4.6, B4.3 · Tahlillar TZ'dagi 8 guruh va namuna turi bo'yicha; buyurtma qatori namuna turini muzlatadi; har bir probirka uchun Code 128 yorlig'i (qopqoq rangi bilan) va o'z kodi bo'yicha skan; qabulda namuna sifati. Sarf normasi B5.6 ga ko'chirildi.
- 2026-11-05 · fix · Postgres'dagi ichki so'rovlar: natijalar navbati (kutilmoqda/tayyor), tahlil nomi bo'yicha qidiruv, bemorlarning oxirgi tashrifi, bo'limlardagi shifokorlar soni noto'g'ri edi; tuzatildi va himoya testi qo'shildi.
- 2026-11-05 · fix · Telegram polling 409 xatosi butun serverni o'chirardi; endi xato yoziladi va bot o'zi qayta ulanadi (409 da 35 s, boshqa xatolarda 5 s → 5 daq).
