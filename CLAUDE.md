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
- `server/routes.ts`: barcha API. Ruxsat `requirePermission("modul.amal")`, o‘zgarishlar `audit(req, ...)` orqali.
- `server/auth.ts`: sessiya, Passport, login blokirovkasi, `forgetSessionUser`, `requireMfaEnrollment`.
- `server/mfa.ts`: TOTP, kalitni shifrlash, zaxira kodlar (B1.8).
- `shared/permissions.ts`: **ruxsatlar katalogi** (`PERMISSIONS`) va TZ §3 dagi 11 ta rolning boshlang‘ich ruxsatlari (`SYSTEM_ROLES`).
- `server/rbac.ts`: `requirePermission`, `hasPermission`, `toSessionUser`, rollar keshi (60 s, `invalidateRoles()`).
- `client/src/lib/access.ts`: qaysi sahifa qaysi ruxsat bilan ochiladi (router, sidebar, command palette uchun yagona jadval).
- Menyu tuzilmasi: Ish maydoni (Bosh sahifa, Bemorlar, Buyurtmalar, Natijalar) · Klinika (Shifokorlar, Bo'limlar, Xodimlar) · Boshqaruv (Hisobotlar, Xarajatlar, Sozlamalar). Yangi modul sahifasi shu bo'limlardan biriga qo'shiladi.
- Migratsiyalar: `npm run db:upgrade` hammasini ketma-ket bajaradi (har biri qayta ishga tushirsa xavfsiz).
- `client/src/pages/*`: sahifalar. `client/src/App.tsx`: routing (og‘ir sahifalar `lazy`). `client/src/components/app-sidebar.tsx`: menyu.
- `client/src/components/ui-kit.tsx`: `PageHeader`, `SectionCard`, `StatCard`, badge'lar, `EmptyState`, `TableSkeleton`, `Pagination`… **Yangi UI shulardan quriladi.**
- `client/src/lib/format.ts`: pul, telefon, sana formatlari.
- `scripts/*.mjs`: bir martalik migratsiyalar.

### Kod qoidalari
- **Interfeys tili: o‘zbek (lotin).** Barcha yorliqlar, xabarlar, xatolar o‘zbekcha. Kod va identifikatorlar inglizcha.
- Format: telefon `+998 XX XXX XX XX`, pul `1 000 000 so'm`, faqat `format.ts` orqali.
- Dizayn: oddiy shadcn defaultlari yetarli emas. `ui-kit.tsx` va `index.css` dizayn tizimidan foydalan (premium ko‘rinish).
- Tibbiy hujjatlar, natijalar va moliyaviy yozuvlar **o‘chirilmaydi**: bekor qilinadi (`cancelled*`) yoki versiyalanadi (`§10`).
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
| D-5 | **MKB-10 katalogi** manbai va tili (o‘zbek/rus). | ❓ |

---

## 3. Ish rejasi (TZ `§15` bosqichlari bo‘yicha)

> Holat 2026-11-05. Hisoblash: `[x]` = 1, `[~]` = 0.5, `[ ]` = 0. Umumiy: **76 banddan 25 → ≈33%**.

### Bosqich 1: Loyihaning poydevori (`§3`, `§10`, `§12`, `§15.1`) 90%

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
  - **B2.7 uchun eslatma:** qabullar shifokorga bog'langach `DELETE /api/doctors/:id` ni bloklash kerak (routes.ts dagi TODO).
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
  - **Qoldi:** real Neon'da `npm run db:mfa` hali bajarilmagan (foydalanuvchi ruxsati kerak); brauzerda qo‘lda ko‘rib chiqish; `api/index.js` ni qayta yig‘ish (deploydan oldin).
- [~] **B1.9** Bemor ID (`§4.2`): `patientNumber` bor. **Qoldi:** barcha yangi modullarda faqat shu ID orqali bog‘lanish (qabul mezoni 16.1).
- [~] **B1.10** Umumiy ustunlar (`§10`): `updatedAt`/`updatedBy` qo'shildi — roles, departments, doctors, expenses, patients. **Qoldi:** orders, tests, payments.

### Bosqich 2: Registratura (`§4`, `§15.2`) 59%

- [x] **B2.1** Yangi bemor formasi (`§4.1.2`): F.I.Sh., jins, telefon, manzil, tug'ilgan sana (yosh avtomatik; sana noma'lum bo'lsa taxminiy yosh), pasport/ID, JShShIR, favqulodda aloqa (`patient_contacts`). Migratsiya: `npm run db:patients`.
- [x] **B2.2** Takroriy bemorni aniqlash (`§4.2`, `shared/patient-identity.ts`): yozish paytida tekshiruv; kuchli moslik (JShShIR, pasport, ism+telefon, ism+tug'ilgan sana — kirill/lotin farqisiz) saqlashni 409 bilan to'xtatadi, ro'yxatchi "shu bemor"ni tanlaydi yoki aniq tasdiqlaydi; kuchsiz moslik (faqat telefon/ism) faqat ogohlantiradi. Dublikat kartalarni birlashtirish (`patients.delete` ruxsati): buyurtmalar, aloqalar, Telegram ko'chadi, bo'sh maydonlar to'ldiriladi.
- [x] **B2.3** Bemorlar ro'yxati (`§4.1.3`): ID, F.I.Sh., telefon, yosh/tug'ilgan sana, oxirgi tashrif va tashriflar soni; qidiruv pasport va JShShIR bo'yicha ham. ("Shaxsiy karta" — B2.4.)
- [x] **B2.4** Bemor shaxsiy kartasi (`/patients/:id`, `§4.1.3`, `§4.2`): sarlavha (yosh, hujjatlar, Telegram), ko'rsatkichlar (tashriflar, oxirgi tashrif, jami, qarz), tablar — tashriflar xronologiyasi, natijalar dinamikasi, to'lovlar daftari, ma'lumotlar (aloqa, hujjatlar), kirishlar tarixi. Rol bo'yicha qisqartiriladi: `orders.read`siz buyurtmalar, moliya ruxsatisiz summalar ko'rinmaydi. Statsionar tarixi B6 bilan qo'shiladi.
- [x] **B2.5** Tashriflar (`visits`, `§10`): bemor + kun uchun bitta tashrif (unique), buyurtma yaratilganda avtomatik (`ON CONFLICT`, parallel saqlashda ham bitta). Eski buyurtmalar migratsiyada kunlar bo'yicha bog'landi (`npm run db:visits`). Birlashtirishda bir kunlik tashriflar qo'shiladi. **Keyin:** qabul (B2.7) va xizmatlar (B2.6) ham tashrifga bog'lanadi.
- [ ] **B2.6** Xizmatlar katalogi (`§4.1.5`): `services` (turi: shifokor ko‘rigi / laboratoriya / UZI / muolaja / boshqa, narx, bo‘lim). Lab `tests` katalogi shu tizimga ulanadi.
- [ ] **B2.7** Navbat va qabul (`§4.1.4`): `appointments`: shifokor tanlash, qabul vaqti (shifokor jadvali bo‘yicha bo‘sh slotlar), navbat raqami (kunlik, shifokor bo‘yicha), holat (yozildi → keldi → qabulda → yakunlandi / kelmadi / bekor).
- [ ] **B2.8** Shifokorga elektron yo‘llanma (`§4.2`): qabul yaratilganda shifokor kabinetida paydo bo‘ladi.
- [x] **B2.9** Laboratoriyaga buyurtma yuborish (`§4.2`).
- [~] **B2.10** To‘lovni rasmiylashtirish (`§4.2`): lab buyurtmalari uchun bor. Bosqich 7 da umumiy hisobvaraqqa o‘tadi.
- [ ] **B2.11** Registratura bosh sahifasi (`§4.1.1`): bugungi bemorlar, navbatdagilar, qabulga kelganlar, yangi ro‘yxatdan o‘tganlar, to‘lov holati.

### Bosqich 3: Shifokorlar (`§5`, `§15.3`) 0%

- [ ] **B3.1** Shifokor kabineti (`§5.1.1`): bugungi qabul, kutayotganlar, qabul qilinganlar, tugallanmagan kartalar. Navbatdan bemorni "chaqirish".
- [ ] **B3.2** Elektron tibbiy karta (`§5.1.2`, `medical_records`): bemor ma'lumotlari, allergiyalar, avvalgi tashxislar, lab natijalari, UZI/tekshiruvlar, davolash tarixi. Bitta umumlashgan ko‘rinish.
- [ ] **B3.3** Ko‘rik oynasi (`§5.1.3`): shikoyat, anamnez, ko‘rik natijasi, dastlabki tashxis, yakuniy tashxis, tavsiyalar.
- [ ] **B3.4** Tashxislar va MKB-10 (`§5.1.3`, `diagnoses`): MKB-10 katalogi + qidiruv (D-5), tashxislar tarixi.
- [ ] **B3.5** Yo‘llanma (`§5.1.4`): lab tahlillari (lab buyurtmasini yaratadi, `§11` Shifokor→Lab), UZI, boshqa tekshiruvlar, mutaxassis konsultatsiyasi (boshqa shifokorga qabul).
- [ ] **B3.6** Davolash va retsept (`§5.1.5`, `prescriptions`): dori nomi (ombor katalogidan, B5 dan keyin), doza, tartib, davomiylik, muolajalar.
- [ ] **B3.7** Hujjatni tasdiqlash, imzolash, tuzatish (`§5.2`): imzolangan ko‘rik qulflanadi; tuzatish yangi versiya yaratadi, eskisi saqlanadi (`medical_record_versions`).
- [ ] **B3.8** Ko‘rik xulosasi PDF (`§5.2`).
- [ ] **B3.9** Natija shifokorga (`§11`, qabul mezoni 16.4): lab natijasi tasdiqlangach buyurtma bergan shifokorga bildirishnoma va kartaga biriktirish.

### Bosqich 4: Laboratoriya / LIS (`§6`, `§15.4`) 41%

- [~] **B4.1** Lab bosh sahifasi (`§6.1.1`): statistikalar bor. **Qoldi:** "tasdiqlanishi kerak" va "bekor qilingan" kartalari, holatlarni TZ bo‘yicha aniq ajratish.
- [~] **B4.2** Buyurtmalar ro‘yxati (`§6.1.2`). **Qoldi:** "yo‘llanma raqami" (B3.5 dan), tahlil turi ustuni.
- [~] **B4.3** Namuna qabul qilish (`§6.1.3`): shtrix-kod/QR, holatlar, rad sababi bor. **Qoldi:** namuna turi (qon, siydik, zardob…), probirka turi/rangi, namuna sifati maydoni, **Code 128** shtrix-kod (`§2`).
- [x] **B4.4** Tahlil kiritish (`§6.1.4`): natija, birlik, referens, me'yor belgisi, izoh.
- [ ] **B4.5** Natijalarni tasdiqlash (`§6.1.5`): laborant kiritadi → **lab mudiri** tekshiradi va tasdiqlaydi (yoki qaytaradi). Faqat tasdiqlangan natija blankaga va shifokorga chiqadi. Tasdiqlangandan keyin tuzatish versiya bilan.
- [~] **B4.6** Tahlillar katalogi (`§6.2`): katalog bor. **Qoldi:** TZ'dagi 8 guruh bo‘yicha qayta tasniflash, namuna turi, sarf normasi (B5.6 uchun).
- [~] **B4.7** Natija blankasi (`§6.3`): bor; tug'ilgan sana va undan hisoblangan yosh qo'shildi. **Qoldi:** klinika logotipi (yuklash), namuna raqami, tasdiqlovchi mutaxassis, elektron tasdiqlash belgisi (QR orqali tekshirish).
- [ ] **B4.8** Sifat nazorati (`§6.5`): nazorat materiallari, QC natijalari kiritish, Levey–Jennings grafigi, Westgard qoidalari (1-2s, 1-3s, 2-2s, R-4s, 4-1s, 10x) bilan avtomatik ogohlantirish, kalibratsiya tarixi, analizator xizmat jurnali, laboratoriyalararo QC natijalari.
- [ ] **B4.9** Analizatorlar ro‘yxati (`§6.4`, `lab_devices`): qurilmalar, xatolar jurnali.
- [ ] **B4.10** Analizator integratsiyasi (`§6.4`): import API + lokal ko‘prik (D-4), namuna ID bo‘yicha moslashtirish, avtotekshiruv, takroriy natija nazorati, operator tasdig‘i. Protokol bo‘lmasa qo‘lda kiritish qoladi.
- [x] **B4.11** Natijani bemorga elektron yetkazish (`§1`): Telegram bot.

### Bosqich 5: Ombor (`§7`, `§15.5`) 0%

- [ ] **B5.1** Mahsulotlar katalogi (`§7.2`, `inventory_items`): 8 tur, o‘lchov birligi, minimal qoldiq.
- [ ] **B5.2** Kirim hujjati (`§7.3`): yetkazib beruvchi, LOT, yaroqlilik muddati, miqdor, xarid narxi (`inventory_batches`, `stock_movements`).
- [ ] **B5.3** Chiqim va bo‘limlarga berish (`§7.1`): qaysi bo‘limga, kim oldi. FEFO (muddati yaqinini birinchi).
- [ ] **B5.4** Qoldiq va yaroqlilik muddati (`§7.1`, `§7.3`): partiyalar bo‘yicha qoldiq, muddati yaqinlashganlar haqida ogohlantirish.
- [ ] **B5.5** Inventarizatsiya (`§7.1`): hisoblangan va haqiqiy qoldiq farqi, tuzatish harakati.
- [ ] **B5.6** Reagent sarfini avtomatik hisoblash (`§7.3`, `§11` Lab→Ombor): tahlil uchun tasdiqlangan sarf normasi bo‘yicha, real sarfni tuzatish imkoni bilan.
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
| 16.1 | Bitta bemor barcha modullarda yagona ID bilan | B1.9, B2.5 | 🟡 |
| 16.2 | Registraturadan shifokorga buyurtma | B2.7, B2.8, B3.1 | ❌ |
| 16.3 | Shifokordan laboratoriyaga yo‘llanma | B3.5 | ❌ |
| 16.4 | Tasdiqlangan natija shifokorga yetadi | B4.5, B3.9 | ❌ |
| 16.5 | Ombor kirim/chiqim to‘g‘ri hisoblanadi | B5.2–B5.6 | ❌ |
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
- 2026-11-05 · fix · Postgres'dagi ichki so'rovlar: natijalar navbati (kutilmoqda/tayyor), tahlil nomi bo'yicha qidiruv, bemorlarning oxirgi tashrifi, bo'limlardagi shifokorlar soni noto'g'ri edi; tuzatildi va himoya testi qo'shildi.
- 2026-11-05 · fix · Telegram polling 409 xatosi butun serverni o'chirardi; endi xato yoziladi va bot o'zi qayta ulanadi (409 da 35 s, boshqa xatolarda 5 s → 5 daq).
