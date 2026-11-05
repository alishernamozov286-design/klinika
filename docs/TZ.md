# NEOGEN CLINIC — Boshlang‘ich texnik topshiriq (Technical Specification)

> Manba: buyurtmachi (Bobomurod aka, klinika), 03.11.2026.
> Bu fayl TZ matnining **o‘zgartirilmagan** nusxasi. Faqat Telegram nusxasida yo‘qolgan jadval chegaralari qayta tiklandi.
> TZ'ni o‘zgartirish faqat buyurtmachi bilan kelishilgandan keyin bo‘ladi. Ish rejasi va holati [CLAUDE.md](../CLAUDE.md) da.

- **Loyiha turi:** Yagona klinika boshqaruv va elektron tibbiy axborot tizimi
- **Arxitektura:** Cloud-based Web Application
- **Klinika hajmi:** 50–150 xodim
- **Interfeys tili:** O‘zbek tili (lotin yozuvi)
- **Loyiha versiyasi:** 1.0
- **Asosiy modullar:** Registratura, Shifokorlar, Laboratoriya, Ombor, Statsionar, Kassa.

---

## 1. LOYIHANING MAQSADI

NEOGEN CLINIC dasturining maqsadi klinikaning barcha bo‘limlarini yagona elektron boshqaruv tizimiga birlashtirish.

Tizim quyidagi muammolarni hal qilishi kerak:

- Bemor ma'lumotlarini yagona bazada saqlash.
- Qog‘oz shaklidagi hujjatlarni kamaytirish.
- Shifokorlar va laboratoriya o‘rtasidagi aloqani avtomatlashtirish.
- Laboratoriya natijalarini elektron shaklda yetkazish.
- Dori vositalari va reagentlar hisobini yuritish.
- Statsionar bemorlarning tibbiy tarixini yuritish.
- Barcha to‘lovlarni nazorat qilish.
- Rahbariyat uchun avtomatik hisobotlar shakllantirish.

## 2. TIZIMNING UMUMIY ARXITEKTURASI

Tizim yagona markaziy server va ma'lumotlar bazasi asosida ishlaydi.

### Ishlash sxemasi

Bemor → Registratura → Shifokor → Laboratoriya → Natija → Shifokor → Davolash → Kassa.

Statsionar bemorlar uchun:
Registratura → Statsionar → Shifokor → Laboratoriya → Ombor → Kassa → Chiqarish.

### Texnologiyalar

| Qism | Texnologiya |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| UI framework | React |
| Backend | Python, Django |
| API | Django REST Framework |
| Ma'lumotlar bazasi | PostgreSQL |
| Server | Cloud VPS yoki Cloud Server |
| Fayllar | S3-compatible Object Storage |
| Hisobotlar | PDF, Excel |
| Shtrix-kod | QR / Code 128 |
| Real vaqt xabarlari | WebSocket |
| Zaxira nusxa | Avtomatik backup |

Arxitektura dastlab modulga ajratilgan yagona backend (modular monolith) sifatida quriladi. Keyinchalik zarur bo‘lsa alohida xizmatlarga ajratish mumkin.

## 3. FOYDALANUVCHILAR VA HUQUQLAR

Har bir xodim o‘z login va paroli orqali tizimga kiradi.

| Foydalanuvchi | Ruxsat |
|---|---|
| Super administrator | Barcha tizim |
| Klinika rahbari | Umumiy boshqaruv |
| Registrator | Bemor va navbat |
| Shifokor | Tibbiy karta va buyurtmalar |
| Laborant | Tahlillar va natijalar |
| Laboratoriya mudiri | Natijalarni tasdiqlash |
| Omborchi | Kirim, chiqim va qoldiq |
| Statsionar hamshirasi | Bemor parvarishi va muolajalar |
| Kassa xodimi | To‘lovlar |
| Buxgalter | Moliyaviy hisobot |
| Auditor | Ruxsat etilgan tarix va hisobotlar |

**Muhim talab:** foydalanuvchi faqat o‘z vazifasiga tegishli ma'lumotlarni ko‘rishi va o‘zgartirishi mumkin bo‘ladi.

## 4. REGISTRATURA MODULI

### 4.1. Asosiy ekranlar

1. **Bosh sahifa** — Bugungi bemorlar. Navbatdagi bemorlar. Qabulga kelganlar. Yangi ro‘yxatdan o‘tganlar. To‘lov holati.
2. **Yangi bemor** — F.I.Sh. Tug‘ilgan sana. Jinsi. Telefon raqami. Manzil. Pasport yoki identifikatsiya ma'lumoti (zarur bo‘lsa). Favqulodda aloqa ma'lumoti.
3. **Bemorlar ro‘yxati** — Bemor ID. F.I.Sh. Telefon. Oxirgi tashrif. Shaxsiy karta.
4. **Navbat** — Shifokor tanlash. Qabul vaqti. Navbat raqami. Qabul holati.
5. **Xizmatlar** — Shifokor ko‘rigi. Laboratoriya. UZI. Muolajalar. Boshqa xizmatlar.

### 4.2. Asosiy funksiyalar

- Yagona bemor ID yaratish.
- Takroriy bemorlarni aniqlash.
- Bemor kartasini ochish.
- Shifokorga elektron yo‘llanma yuborish.
- Laboratoriyaga buyurtma yuborish.
- To‘lovni rasmiylashtirish.
- Bemor tashriflari tarixini saqlash.

## 5. SHIFOKORLAR MODULI

### 5.1. Asosiy ekranlar

1. **Shifokor kabineti** — Bugungi qabul. Kutayotgan bemorlar. Qabul qilingan bemorlar. Tugallanmagan tibbiy kartalar.
2. **Elektron tibbiy karta** — Bemor ma'lumotlari. Shikoyatlar. Anamnez. Allergiyalar. Avvalgi tashxislar. Laboratoriya natijalari. UZI va boshqa tekshiruvlar. Davolash tarixi.
3. **Ko‘rik oynasi** — Shikoyatlar. Anamnez. Ko‘rik natijalari. Dastlabki tashxis. MKB-10 kodi. Yakuniy tashxis. Tavsiyalar.
4. **Yo‘llanma** — Laboratoriya tahlillari. UZI. Boshqa tekshiruvlar. Mutaxassis konsultatsiyasi.
5. **Davolash** — Dori nomi. Doza. Qabul qilish tartibi. Davomiyligi. Muolajalar.

### 5.2. Asosiy funksiyalar

- Elektron tibbiy karta.
- Tashxislar tarixi.
- Laboratoriya natijalarini ko‘rish.
- Elektron yo‘llanma.
- Davolash rejasini shakllantirish.
- Elektron retsept yoki tayinlov.
- Ko‘rik xulosasini PDF shaklida chiqarish.

Tibbiy hujjatlarni tasdiqlash, imzolash va tuzatish alohida vakolatlar bilan boshqariladi. Avval tasdiqlangan hujjatning tarixiy nusxasi saqlanadi.

## 6. LABORATORIYA MODULI (LIS)

Bu loyiha ichidagi eng muhim modullardan biri.

### 6.1. Asosiy ekranlar

1. **Laboratoriya bosh sahifasi** — Bugungi buyurtmalar. Namuna kutilmoqda. Tahlil jarayonida. Natija tayyor. Tasdiqlanishi kerak. Bekor qilingan buyurtmalar.
2. **Buyurtmalar** — Bemor ID. F.I.Sh. Yo‘llanma raqami. Tahlil turi. Buyurtma vaqti. Buyurtma holati.
3. **Namuna qabul qilish** — Shtrix-kod yaratish. Probirkani belgilash. Namuna turi. Qabul qilingan vaqt. Namuna sifati. Rad etish sababi.
4. **Tahlil kiritish** — Tahlil nomi. Natija. O‘lchov birligi. Referens oraliq. Me'yoriy holat. Izoh.
5. **Natijalarni tasdiqlash** — Laborant natijasi. Laboratoriya mudiri tekshiruvi. Tasdiqlash. PDF blankani yaratish.

### 6.2. Laboratoriya katalogi

Tahlillar quyidagi guruhlarga ajratiladi:

| Guruh | Tahlillar |
|---|---|
| Gematologiya | UQT, leykotsit, trombotsit, SOE |
| Biokimyo | ALT, AST, glyukoza, kreatinin, mochevina |
| Gormonlar | TSH, FT3, FT4, T3, T4, kortizol |
| Immunologiya | Anti-TPO, Anti-TG, IgG, IgM, IgA |
| Koagulologiya | PT, INR, APTT, fibrinogen, D-dimer |
| Diabet diagnostikasi | HbA1c, insulin, C-peptid |
| Infeksiyalar | HBsAg, Anti-HCV va boshqalar |
| Siydik tahlili | Umumiy siydik tahlili |

### 6.3. Laboratoriya blankasi

Har bir natija blankasida: Klinika logotipi. Bemor F.I.Sh. Bemor ID. Tug‘ilgan sana. Namuna raqami. Tahlil nomi. Natija. O‘lchov birligi. Referens qiymat. Natija sanasi. Laborant va tasdiqlovchi mutaxassis. Elektron tasdiqlash belgisi.

### 6.4. Analizatorlar bilan integratsiya

Kelajakdagi integratsiya ro‘yxati:

| Analizator | Yo‘nalish |
|---|---|
| Snibe MAGLUMI X3 | Immunoferment / immunoxemilyuminessensiya |
| Snibe MAGLUMI 600 | Immunologiya |
| Mindray BA-88A | Biokimyo |
| Mindray BS-240 Pro | Biokimyo |
| Dymind DH26 | Gematologiya |
| Merilyzer EIAQUANT | IFA |

Talablar:

- Analizator natijalarini avtomatik qabul qilish.
- Bemor va namuna ID bilan moslashtirish.
- Natijani avtomatik tekshirish.
- Takroriy natijalarni nazorat qilish.
- Operator tomonidan tasdiqlash.
- Qurilma xatolarini qayd etish.

Har bir qurilma uchun RS-232, TCP/IP, HL7 yoki ishlab chiqaruvchi protokoli mavjudligi alohida tekshiriladi. Qurilma protokoli qo‘llab-quvvatlamasa, natija qo‘lda kiritiladi.

### 6.5. Sifat nazorati

LIS tarkibida quyidagilar ham bo‘lishi kerak: Ichki laboratoriya nazorati. Nazorat materiallari. Levey–Jennings nazorat kartasi. Westgard qoidalari. Kalibratsiya tarixi. Reagent LOT raqami. Reagent yaroqlilik muddati. Analizator texnik xizmat jurnali. Laboratoriyalararo sifat nazorati natijalari.

## 7. OMBOR MODULI

### 7.1. Ekranlar

Ombor bosh sahifasi. Mahsulotlar katalogi. Kirim. Chiqim. Bo‘limlarga berish. Qoldiq. Yaroqlilik muddati. Inventarizatsiya. Hisobotlar.

### 7.2. Mahsulot turlari

Laboratoriya reagentlari. Kalibratorlar. Nazorat materiallari. Probirkalar. Shpritslar. Tibbiy sarf materiallari. Dori vositalari. Dezinfeksiya vositalari.

### 7.3. Ombor funksiyalari

Kirim hujjati. Yetkazib beruvchi. LOT raqami. Yaroqlilik muddati. Miqdor. Xarid narxi. Sotuv yoki hisobdan chiqarish narxi. Qaysi bo‘limga berilgani. Qoldiq miqdori.

Tizim muddati yaqinlashayotgan mahsulotlar haqida ogohlantiradi.
Laboratoriya buyurtmasi bajarilganda reagent sarfi avtomatik hisoblanadi, lekin faqat tasdiqlangan sarf normasi va real ishlatilgan miqdorga asoslanadi.

## 8. STATSIONAR MODULI

### 8.1. Asosiy ekranlar

1. **Statsionar bosh sahifasi** — Jami bemorlar. Bo‘sh o‘rinlar. Band o‘rinlar. Yangi yotqizilganlar. Chiqarilayotgan bemorlar.
2. **Bemorni yotqizish** — Bemor ID. Bo‘lim. Palata. Yotoq raqami. Yotqizish sanasi. Qabul qiluvchi shifokor.
3. **Kasallik tarixi** — Shikoyatlar. Anamnez. Tashxis. Kundalik kuzatuv. Laboratoriya natijalari. Tekshiruvlar. Davolash rejasi.
4. **Muolajalar** — Shifokor tayinlovi. Dori vositasi. Dozasi. Vaqti. Bajaruvchi hamshira. Bajarilganlik holati.
5. **Chiqarish** — Yakuniy tashxis. Davolash xulosasi. Epikriz. Tavsiyalar. Chiqarilgan sana.

### 8.2. Integratsiya

- Shifokor tayinlovi statsionar kartasiga tushadi.
- Laboratoriya natijalari shu kartaga biriktiriladi.
- Dori tayinlovlari ombor bilan bog‘lanadi.
- Xizmatlar kassa hisobiga yuboriladi.
- Bemor chiqarilganda yakuniy epikriz yaratiladi.

## 9. KASSA VA MOLIYA MODULI

### 9.1. Ekranlar

Kassa bosh sahifasi. To‘lov qabul qilish. Bemor hisobvarag‘i. Qarzdorlik. Qaytarilgan to‘lovlar. Kunlik tushum. Xizmatlar narxlari. Moliyaviy hisobotlar.

### 9.2. Funksiyalar

Naqd to‘lov. Terminal to‘lovi. Bank orqali to‘lov. Bir nechta xizmat uchun umumiy to‘lov. Qisman to‘lov. Qarzdorlik nazorati. Chegirmalar. To‘lovni qaytarish. Kassa smenasini yopish.

To‘lov qaytarish faqat vakolatli shaxs tasdig‘i bilan bajariladi.

## 10. YAGONA MA'LUMOTLAR BAZASI

Barcha modullar umumiy PostgreSQL bazasidan foydalanadi.

| Jadval | Vazifasi |
|---|---|
| users | Foydalanuvchilar |
| roles | Xodimlar rollari |
| permissions | Ruxsatlar |
| patients | Bemorlar |
| patient_contacts | Bemor aloqa ma'lumotlari |
| appointments | Qabul va navbat |
| visits | Tashriflar |
| doctors | Shifokorlar |
| departments | Bo‘limlar |
| diagnoses | Tashxislar |
| medical_records | Elektron tibbiy karta |
| prescriptions | Dori tayinlovlari |
| lab_orders | Laboratoriya buyurtmalari |
| lab_tests | Tahlillar katalogi |
| lab_results | Tahlil natijalari |
| lab_samples | Namunalar |
| lab_devices | Analizatorlar |
| lab_qc | Sifat nazorati |
| inventory_items | Ombor mahsulotlari |
| inventory_batches | LOT va yaroqlilik |
| stock_movements | Kirim va chiqim |
| admissions | Statsionarga yotqizish |
| beds | Palata va yotoqlar |
| procedures | Muolajalar |
| invoices | Hisobvaraq |
| payments | To‘lovlar |
| audit_logs | Harakatlar tarixi |

Har bir muhim jadvalda identifikator, yaratilgan vaqt, o‘zgartirilgan vaqt va tegishli foydalanuvchi identifikatori saqlanadi.
Tibbiy hujjatlar, laboratoriya natijalari va moliyaviy operatsiyalar uchun o‘chirish o‘rniga bekor qilish yoki versiyalash mexanizmi qo‘llanadi.

## 11. MODULLARARO INTEGRATSIYA

| Qaysi modul | Qaysi modul bilan | Almashinadigan ma'lumot |
|---|---|---|
| Registratura | Shifokorlar | Bemor va qabul |
| Shifokorlar | Laboratoriya | Tahlil buyurtmasi |
| Laboratoriya | Shifokorlar | Tasdiqlangan natija |
| Laboratoriya | Ombor | Reagent sarfi |
| Shifokorlar | Statsionar | Yotqizish va tayinlov |
| Statsionar | Laboratoriya | Tahlil buyurtmasi |
| Statsionar | Ombor | Dori sarfi |
| Barcha modullar | Kassa | Xizmat va to‘lov |
| Barcha modullar | Rahbariyat | Hisobot |

Integratsiya REST API va zarur joylarda real vaqt xabarlari orqali amalga oshiriladi.

## 12. XAVFSIZLIK VA MA'LUMOTLARNI HIMOYALASH

Bu tibbiy tizim bo‘lgani uchun quyidagi talablar majburiy:

- HTTPS orqali shifrlangan aloqa.
- Parollarni xavfsiz xeshlash.
- Ikki bosqichli autentifikatsiya imkoniyati.
- Har bir xodim uchun alohida hisob.
- Rollar bo‘yicha ruxsatlar.
- Tibbiy ma'lumotlarga kirish tarixini saqlash.
- Avtomatik zaxira nusxalar.
- Zaxira nusxadan tiklash sinovlari.
- Faol bo‘lmagan seanslarni yopish.
- Muhim o‘zgarishlar audit jurnali.

Bemor ma'lumotlari faqat qonuniy asos va vakolat doirasida ko‘riladi.
Cloud server tanlashda ma'lumotlarni saqlash joyi, O‘zbekistonning shaxsga doir ma'lumotlar va tibbiy axborotga oid talablariga muvofiqlik alohida tekshiriladi.

## 13. HISOBOTLAR

Rahbariyat uchun alohida boshqaruv paneli yaratiladi.

Hisobotlar: Kunlik bemorlar soni. Shifokorlar faoliyati. Laboratoriya tahlillari soni. Eng ko‘p buyuriladigan tahlillar. Reagentlar sarfi. Ombor qoldig‘i. Statsionar bandligi. Kunlik va oylik tushum. Xizmatlar daromadi. Qarzdorlik. Xarajatlar.

Hisobotlar PDF va Excel formatida chiqariladi.

## 14. TEXNIK TALABLAR

- Tizim 50–150 xodimning bir vaqtning o‘zida ishlashiga mo‘ljallanadi.
- Kompyuter va planshetda ishlash.
- Mobil qurilmalarga moslashuvchan interfeys.
- Zamonaviy brauzerlar bilan ishlash.
- Markaziy server.
- Avtomatik zaxiralash.
- Monitoring.
- Xatolar jurnalini yuritish.
- Modul bo‘yicha ishlash tezligini nazorat qilish.

Ishlash tezligi va foydalanuvchilar soniga oid ko‘rsatkichlar yuklama sinovlarida tekshiriladi.

## 15. ISHLAB CHIQISH BOSQICHLARI

1. **Loyihaning poydevori** — Ma'lumotlar bazasi. Login va parol. Foydalanuvchilar. Rollar va ruxsatlar. Bemor ID.
2. **Registratura** — Bemor kartasi. Navbat. Qabul. Xizmatlar katalogi.
3. **Shifokorlar** — Elektron tibbiy karta. Tashxis. Ko‘rik. Yo‘llanma.
4. **Laboratoriya** — LIS. Tahlillar katalogi. Shtrix-kod. Natijalar. PDF blankalar. Sifat nazorati.
5. **Ombor** — Kirim. Chiqim. Reagentlar. Dori vositalari. Qoldiq.
6. **Statsionar** — Palatalar. Bemorlar. Kasallik tarixi. Muolajalar. Epikriz.
7. **Kassa** — To‘lovlar. Hisob-kitob. Chek. Moliyaviy hisobot.
8. **Yakuniy integratsiya** — Modullararo test. Xavfsizlik sinovi. Yuklama sinovi. Xodimlarni o‘qitish. Ishga tushirish.

## 16. LOYIHANI QABUL QILISH MEZONLARI

Dastur tayyor deb hisoblanishi uchun:

1. Bitta bemor barcha modullarda yagona ID bilan aniqlanishi.
2. Registraturadan shifokorga buyurtma uzatilishi.
3. Shifokordan laboratoriyaga yo‘llanma tushishi.
4. Laboratoriya natijasi tasdiqlangach shifokorga yetib borishi.
5. Ombordagi kirim va chiqim to‘g‘ri hisoblanishi.
6. Statsionar bemorining elektron tarixi shakllanishi.
7. Barcha xizmatlar kassa bilan bog‘lanishi.
8. Xodimlar vakolatlari to‘g‘ri ishlashi.
9. Audit jurnali barcha muhim o‘zgarishlarni qayd etishi.
10. Zaxira nusxadan ma'lumotlarni tiklash muvaffaqiyatli sinovdan o‘tishi.

**Yakuniy natija:** barcha bo‘limlari yagona tizimda ishlaydigan, kengaytirish imkoniyatiga ega NEOGEN CLINIC axborot tizimi.
