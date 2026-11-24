/**
 * AI Hospital's knowledge: how the system is used, page by page and role by
 * role. The assistant answers from this text only, so keep it true to the UI
 * — when a button or a rule changes, change it here too.
 */
export const SYSTEM_GUIDE = `
# NEOGEN CLINIC tizimi — foydalanish qo'llanmasi

Tizim bitta bemorni barcha bo'limlar bo'ylab yagona karta va raqam (#12) bilan olib boradi.
Ish tartibi (TZ): Bemor → Registratura → Shifokor → Laboratoriya → Natija → Shifokor → Davolash → Kassa.
Statsionar: Registratura → Statsionar → Shifokor → Laboratoriya → Ombor → Kassa → Chiqarish.

Umumiy qoidalar:
- Har xodim o'z login va paroli bilan kiradi; menyuda faqat o'z roliga ruxsat etilgan sahifalar ko'rinadi.
- Tibbiy va moliyaviy yozuvlar o'chirilmaydi: xato bo'lsa sabab bilan bekor qilinadi yoki "tuzatish" kiritiladi; hammasi amallar jurnaliga (auditga) yoziladi.
- Sarlavhadagi yashil "Jonli" belgisi — boshqa xodimlar kiritgan o'zgarishlar bir necha soniyada ekranda o'zi paydo bo'ladi, sahifani yangilash shart emas.
- Qo'ng'iroqcha — shaxsiy bildirishnomalar (masalan, shifokorga tahlil natijasi tayyorligi).
- Ctrl+K (yoki "Qidiruv") — tezkor qidiruv: bemor, buyurtma, sahifa.
- Uzoq vaqt faollik bo'lmasa seans avtomatik yopiladi (bir daqiqa oldin ogohlantiriladi, "Ishni davom ettirish" bosilsa davom etadi).
- Telefon raqami: +998 XX XXX XX XX. Pul: so'mda, butun son.

Rollar:
- Super administrator — hamma narsa, xodimlar va rollar, sozlamalar.
- Klinika rahbari — hisobotlar, qaytarish va chegirmani tasdiqlash, smenalar, statsionar boshqaruvi, tizim holati.
- Registrator — bemorlar, navbat va qabulga yozish, tahlil buyurtma, to'lov qabul qilish, yotqizish.
- Shifokor — kabinet, ko'rik yozuvi, tashxis, davolash, yo'llanmalar; statsionar shifokori — kasallik tarixi, tayinlovlar, epikriz, chiqarish.
- Laborant — namuna, natija kiritish, QC natijalari, reagent sarfi.
- Laboratoriya mudiri — natijalarni tasdiqlash, qaytarish, tuzatish, QC boshqaruvi, sarf normalarini tasdiqlash, buyurtmani bekor qilish.
- Omborchi — mahsulotlar, kirim, chiqim, inventarizatsiya, sarf normalarini taklif qilish.
- Statsionar hamshirasi — kuzatuv (harorat, bosim), dozani berish/belgilash, yotoq holati.
- Kassa xodimi — smena, hisobvaraq, to'lov, qaytarish so'rovi.
- Buxgalter — xarajatlar, moliyaviy hisobotlar, eksport.
- Auditor — hamma narsani faqat ko'radi (o'zgartira olmaydi), amallar jurnali.

## Bosh sahifa (/home)
Maqsad: kunning holati bir qarashda. Registratura uchun: bugungi bemorlar, navbatdagilar, qabulga kelganlar, yangi kartalar, to'lov holati; ro'yxatlar "Qabulga kelganlar", "Navbatdagi bemorlar" (yonidagi "Keldi" tugmasi bilan), "Yangi bemorlar".
Tugmalar: "Yangi bemor", "Yangi buyurtma", "Qabulga yozish", "Navbat". Excel/PDF — kunlik hisobot.

## Bemorlar (/patients) — registrator
Maqsad: bemorlar bazasi. Qidiruv: raqam (#12), ism, telefon, manzil, pasport yoki JShShIR.
Yangi bemor qo'shish:
1. "Yangi bemor" tugmasini bosing.
2. F.I.Sh., telefon (+998 …), jinsi, tug'ilgan sana yoki yoshi, manzilni kiriting; xohlasa pasport/JShShIR, favqulodda aloqa.
3. "Saqlash". Tizim shu telefon yoki hujjat bilan karta bor-yo'qligini tekshiradi; takroriy bo'lsa ogohlantiradi — mavjud kartani tanlang, yangisini ochmang.
Bemorga tezda tahlil buyurtma: qatordagi menyu (⋮) yoki bemor kartasidagi "Tahlil buyurtma".
Ikki karta bitta odamniki bo'lsa: bemor kartasidagi birlashtirish tugmasi (yonidagi ikki strelkali belgi) — ma'lumotlar bitta kartaga o'tadi.

## Bemor kartasi (/patients/:id)
Maqsad: bemorning hammasi bitta joyda. Yuqorida: tashriflar soni, oxirgi tashrif, jami xizmatlar, qarzdorlik.
Tablar: Tashriflar (kunlar bo'yicha qabullar, tahlillar va summalar), Tibbiy karta (allergiyalar, tashxislar tarixi, ko'riklar, lab natijalari), Qabullar, Statsionar, Natijalar dinamikasi (bir tahlilning vaqt bo'yicha grafigi), To'lovlar, Ma'lumotlar, Kirishlar tarixi (kim kartani ochgan).
Tugmalar: "Qabulga yozish", "Tahlil buyurtma", "Tahrirlash".
Allergiya — "Tibbiy karta" tabida qo'shiladi; u statsionar va ko'rik oynasida qizil ogohlantirish bo'lib turadi.

## Navbat (/queue) — registrator
Maqsad: shifokorlar qabuliga yozish va kunlik navbat. Sana tanlanadi, yuqorida: jami, kutmoqda, qabulda, yakunlandi, kelmadi/bekor. Shifokor bo'yicha filtr.
Qabulga yozish:
1. "Qabulga yozish" → bemorni tanlang (yo'q bo'lsa shu yerning o'zida yangi bemor qo'shing).
2. Shifokor, kerak bo'lsa xizmat (masalan UZI), sana va bo'sh vaqtni tanlang.
3. Saqlang — bemorga navbat raqami (№) beriladi. Band vaqt va o'tib ketgan vaqtga yozib bo'lmaydi.
Bemor kelganda: qatordagi "Keldi" — shu payt tashrif ochiladi va hisobvaraq paydo bo'ladi.
Qatordagi menyu (⋮): kelmadi, bekor qilish (sabab majburiy), vaqtni o'zgartirish.
Shifokor yo'llanmasi (UZI, konsultatsiya) bo'yicha yozish: bemor kartasi → yo'llanma → "Navbatga yozish".

## Mening kabinetim (/cabinet) — shifokor
Maqsad: shifokorning bugungi navbati. "Keyingi bemorni chaqirish" — navbatdagi kelgan bemorni qabulga oladi. Qatorda: "Chaqirish", "Ko'rik oynasi", "Kelmadi", "Navbatga qaytarish", "Qabulni yakunlash".
Yangi tahlil natijalari bo'limi — siz yo'llagan bemorlarning tasdiqlangan natijalari.

## Ko'rik oynasi (/cabinet/visit/:id) — shifokor
Ko'rik yozuvi: shikoyatlar, anamnez, ob'ektiv holat, dastlabki va yakuniy tashxis (MKB-10 kodi ixtiyoriy), tavsiyalar. Yozganingiz avtomatik saqlanadi (qoralama).
Davolash: "Dori" yoki "Muolaja" qatori qo'shiladi — nomi (ombor katalogidan yoki qo'lda), doza, qabul qilish yo'li, tartibi, necha kun/seans.
Yo'llanma berish ("Yo'llanma berish"): Tahlil (laboratoriya — buyurtma darhol yaratiladi va laboratoriyaga tushadi), Tekshiruv (UZI, EKG — registratura navbatga yozadi), Konsultatsiya (boshqa mutaxassis).
Tasdiqlash: shikoyat va kamida bitta tashxis to'ldirilgach "Tasdiqlash" yoki "Tasdiqlash va qabulni yakunlash". Tasdiqlangan yozuv qulflanadi; o'zgartirish faqat "Tuzatish kiritish" orqali, sabab bilan (versiyalar saqlanadi).
"Retsept" — retsept chop etish, "Xulosa" — ko'rik xulosasi PDF (faqat tasdiqlangan yozuvdan).
Tahlil natijalari ko'rik oynasining o'zida ko'rinadi; tayyor bo'lganda qo'ng'iroqchaga xabar keladi.

## Buyurtmalar (/orders) — registrator, laboratoriya
Maqsad: laboratoriya buyurtmalari ro'yxati (holat, to'lov, namuna bo'yicha filtr).
Yangi tahlil buyurtma: "Yangi buyurtma" → bemor → tahlillarni tanlang (guruh yoki qidiruv) → kerak bo'lsa yo'naltirgan shifokor → saqlang. Narx narxlar ro'yxatidan olinadi; to'lov kassada (hisobvaraqda) qabul qilinadi.
Buyurtma oynasi (qatorni bosing): tahlillar va natijalar, namuna holati, to'lovlar, "Natija kiritish", "Blanka", "Telegramga yuborish" (bemor botga ulangan bo'lsa).
Bekor qilish: faqat bekor qilish huquqi borlar (laboratoriya mudiri, rahbar) — "Bekor qilish" → sababni yozing (kamida 5 belgi). Buyurtma o'chmaydi; to'langan bo'lsa pul kassada qaytarish uchun ko'rinadi.

## Laboratoriya jarayoni: namuna → natija → tasdiq
1. Namuna (laborant): buyurtma oynasida namuna paneli — "Namuna olindi", so'ng "Namunani qabul qilish" (sifati bilan). Yaroqsiz bo'lsa "Namunani rad etish" va sabab (gemoliz, miqdor yetarli emas …). "Yorliq" — probirka yorlig'i (shtrix-kod).
2. Natija (laborant): "Natijalar" sahifasi → "Kiritish" tabi → buyurtma → qiymatlarni kiriting; me'yordan chiqqanlari avtomatik belgilanadi (↑ ↓) → "Saqlash".
3. Tasdiq (laboratoriya mudiri): "Tasdiqlash" tabi → "Tekshirish" → hammasi to'g'ri bo'lsa "Tasdiqlash"; noto'g'ri qatorni "Qaytarish" (sabab bilan) — u laborantga qaytadi.
4. Tasdiqlangan natija qulflanadi; xato bo'lsa mudir "Tuzatish" (sabab bilan, versiya saqlanadi). Faqat tasdiqlangan natija shifokorga, blankaga, Telegramga va tibbiy kartaga chiqadi.
Reagentlar tasdiqlangan natija bo'yicha sarf normasiga ko'ra ombordan avtomatik yechiladi.

## Natijalar (/results)
Uchta navbat: Kiritish (natija kutayotganlar), Tasdiqlash (mudir tekshirishi kerak), Tayyor (tasdiqlangan, blanka chop etish/yuborish mumkin). Qidiruv: bemor, telefon, № yoki tahlil.

## Kassa (/cashier) — kassa xodimi
Avval smena: "Smenani ochish" → kassadagi boshlang'ich naqd summa. Smena ochilmasa to'lov qabul qilib bo'lmaydi.
To'lov qabul qilish:
1. "Hisobvaraqlar" tabi → bemorni toping (ism, raqam yoki telefon) → hisobvaraqni oching. Bitta tashrifning hamma xizmatlari (ko'rik, UZI, tahlillar, statsionar yotoq-kunlari, dori va muolajalar) bitta hisobvaraqda.
2. "To'lov qabul qilish" → summa (to'liq yoki qisman) va to'lov usuli: naqd, karta (terminal), o'tkazma.
3. Saqlang — kvitansiya raqamlanadi, "Chek"/"Chop etish". Qisman to'langan bo'lsa qolgani qarz bo'lib "Qarzdorlar"da ko'rinadi.
Chegirma: "Chegirma berish" (registrator yoki rahbar huquqi bilan) — foiz yoki summa, butun hisobvaraqqa yoki bitta xizmatga, sabab majburiy; faqat to'lanmagan qismga.
Qaytarish: hisobvaraqda ortiqcha pul bo'lsa (xizmat bekor qilingan) — kassir qaytarish so'raydi (sabab bilan) → rahbar tasdiqlaydi → kassir "Qaytarishlar" tabida pulni beradi.
Xato to'lov o'chirilmaydi — sabab bilan bekor qilinadi (huquqi borlar).
Smenani yopish: "Smenani yopish" → kassadagi naqdni sanab kiriting; tizim kutilgan summa bilan farqni ko'rsatadi; "Hisobot" — smena hisoboti.
Boshqa tablar: Bosh sahifa (bugungi tushum, oy, qarz, qaytarishlar), Qarzdorlar, Smenalar, Kunlik tushum, Narxlar.

## Statsionar (/inpatient)
Tablar: Bosh sahifa (bemorlar, bo'sh/band o'rinlar, bandlik, yangi yotqizilganlar, chiqarilayotganlar, yotoqlar xaritasi), Bemorlar, Muolajalar, Palata va yotoqlar.
Yotqizish (registrator/hamshira/rahbar): "Yotqizish" (yoki xaritada bo'sh yotoqni bosib "Shu yotoqqa yotqizish") → bemor, yotoq, qabul qiluvchi shifokor, sabab → "Bemorni yotqizish". Statsionar hisobvarag'i ochiladi, yotoq-kun narxi palatadan.
Ko'chirish: bemor qatori → "Ko'chirish" → yangi yotoq. Eski yotoq tozalashga o'tadi.
Chiqarish rejasi: bemor kartasida rejalashtirilgan chiqarish sanasi.
Yotoq holati (hamshira): tayyor, tozalanmoqda, ta'mirda — "Palata va yotoqlar"da yotoqni bosib "Holatni saqlash".
Palata/yotoq qo'shish (rahbar/admin): "Palata qo'shish", "Yotoq qo'shish"; palataga sutkalik narx beriladi.

## Kasallik tarixi (/inpatient/stays/:id) — statsionar shifokori va hamshira
Kasallik tarixi: shikoyatlar, anamnez, ob'ektiv holat, tashxis, davolash rejasi — har saqlash yangi versiya (avvalgilari "tarix"da).
Kundalik kuzatuv (hamshira/shifokor): harorat, puls, bosim, SpO2, izoh — qo'shish; me'yordan chiqqani rang bilan belgilanadi. Xato yozuv sabab bilan bekor qilinadi.
Tayinlovlar ("Tayinlovlar va muolajalar", shifokor): "Tayinlash" → dori (ombor katalogidan; bir dozaga necha birlik ketadi) yoki muolaja → doza, yo'li, kunlik vaqtlar, boshlanish kuni, necha kun. Tizim jadval tuzadi. "To'xtatish" — kursni muddatidan oldin to'xtatish (sabab).
Dozani berish (hamshira): Statsionar → "Muolajalar" tabi (yoki kasallik tarixi) → "Bajarildi" — dori ombordan muddati yaqin partiyadan (FEFO) avtomatik yechiladi va hisobvaraqqa sotuv narxida qo'shiladi. Berilmasa "Bajarilmadi" (sabab). Xato belgi — "Qaytarish". Muolajani vaqtidan 2 soatdan oldin belgilab bo'lmaydi.
Statsionarda tahlil: "Tahlil buyurish" — buyurtma laboratoriyaga tushadi, natijasi shu sahifada ko'rinadi.
Hisob: "Statsionar hisobi" kartasi — yotoq-kunlar, muolajalar, dorilar, to'langan va qarz.
Chiqarish: "Epikriz" → "Avto-to'ldirish" yotish davridan qoralama tuzadi (tashxis, berilgan davolash, tahlillar, dinamika) → tahrirlang, yakuniy tashxis, epikriz va tavsiyalarni to'ldiring → "Saqlash" → "Chiqarish". Chiqarilganda tayinlovlar to'xtaydi, yotoq tozalashga o'tadi. Epikrizni "Chop etish"/"Yuklab olish" (PDF). Chiqarilgandan keyin o'zgartirish — "Tuzatish kiritish" (sabab bilan).

## Ombor (/inventory) — omborchi
Tablar: Bosh sahifa (ombor qiymati, oylik kirim/chiqim, e'tibor talab qiladiganlar: muddati o'tgan/yaqin partiyalar, kam qolgan mahsulotlar), Mahsulotlar, Qoldiq va muddat, Kirim, Chiqim, Inventarizatsiya, Reagent sarfi, Hisobotlar.
Yangi mahsulot: "Mahsulotlar" → qo'shish → nomi, turi (reagent, kalibrator, nazorat, probirka, shprits, sarf materiali, dori, dezinfeksiya), o'lchov birligi, minimal qoldiq; dori uchun sotuv narxi.
Kirim: "Kirim" → "Yangi kirim" → yetkazib beruvchi, hujjat raqami, sana → "Qator qo'shish": mahsulot, LOT, yaroqlilik muddati, miqdor, xarid narxi → "Kirimni saqlash". Xato kirim — "Kirimni bekor qilish".
Chiqim: "Chiqim" → bo'limga berish (qaysi bo'lim, kim oldi) yoki hisobdan chiqarish (muddati o'tgan, shikastlangan — sabab). Partiya FEFO bo'yicha avtomatik tanlanadi.
Inventarizatsiya: yangi hujjat (sana, mahsulot turlari) → har qatorda sanalgan miqdorni kiriting → o'tkazish; farqlar qoldiqni to'g'rilaydi. "Dalolatnoma" — chop etish.
Reagent sarfi: sarf normasi (bir tahlilga qancha reagent) — omborchi taklif qiladi, laboratoriya mudiri tasdiqlaydi; tasdiqlangan natijalar bo'yicha avtomatik yechiladi. Qo'shimcha sarf (qayta o'lchov, kalibrovka) laborant tomonidan sabab bilan yoziladi. Qoldiq yetmasa kamomad sifatida turadi va kirimdan keyin yopiladi.
Hisobotlar: aylanma qaydnoma (davr boshi, kirim, chiqim, oxiri), bo'limlar bo'yicha chiqim; Excel/PDF.

## Sifat nazorati (/qc) — laboratoriya
Tablar: Ichki nazorat, Nazorat materiallari, Kalibratsiya, Texnik xizmat, Tashqi nazorat.
Sozlash (mudir): "Nazorat materiallari" — material (nomi, LOT, daraja, muddati) va har tahlil/analizator uchun maqsad (o'rtacha va SD).
Kunlik QC (laborant): "Ichki nazorat" → seriya → natijani kiriting. Levey-Jennings grafigi va Westgard qoidalari: ogohlantirish (sariq) yoki rad etish (qizil). Rad etilgan natijaga "chora" yoziladi (ko'rib chiqish).
Kalibrovka, texnik xizmat (kunlik/haftalik/oylik/ta'mir), tashqi nazorat (EQA: bizning natija va belgilangan qiymat, z-ball) — tegishli tablarda yoziladi.

## Analizatorlar (/devices)
Qurilmalar ro'yxati (yo'nalish, ulanish, holat: faol, xizmatda, ishdan chiqqan). Xato jurnali: qurilmada xato bo'lsa yoziladi (daraja, kod, nima bo'ldi, ko'rilgan chora; kerak bo'lsa "ishdan chiqqan" deb belgilash), hal bo'lgach "hal qilindi". Analizatordan avtomatik natija olish hali ulanmagan — natijalar qo'lda kiritiladi.

## Hisobotlar (/reports) — rahbar, buxgalter
Tablar: Moliyaviy hisobot (sof tushum, xarajatlar, sof foyda, qarzdorlik; ko'rsatilgan xizmatlar turi bo'yicha: narx, chegirma, hisoblangan, to'langan, qarz), Bemorlar (kunlik oqim: yangi va takroriy, xizmat turlari), Laboratoriya (tahlillar soni, eng ko'p buyuriladiganlar, tasdiqlash vaqti), Statsionar (bandlik, o'rtacha yotish kuni, bo'lim va palatalar).
Davr: Bu oy, O'tgan oy, Yil boshidan, 30 kun yoki ixtiyoriy. Yuqori o'ngdagi tugmalar — Excel va PDF.

## Xarajatlar (/expenses) — buxgalter
Xarajat qo'shish: tugma → toifa (Reaktivlar, Ish haqi, Ijara, Kommunal, Jihoz, Soliq, Boshqa), summa, to'lov usuli, kimga, sana, izoh. Xato xarajat sabab bilan bekor qilinadi (o'chirilmaydi). Davr va toifa bo'yicha filtr, jami summalar.

## Shifokorlar, Bo'limlar, Xizmatlar, Xodimlar (admin, rahbar)
- Shifokorlar: xodimni shifokor qilish — mutaxassislik, bo'lim, xona, ko'rik narxi, bitta qabul davomiyligi, haftalik ish jadvali.
- Bo'limlar: ambulator, diagnostika, laboratoriya, statsionar.
- Xizmatlar: konsultatsiya, UZI, muolaja va boshqa xizmatlar narxi; laboratoriya narxlari "Sozlamalar → Tahlillar"da.
- Xodimlar: yangi xodim (login, parol, F.I.Sh., rol), bloklash, qulfni ochish, parolni tiklash, 2FA ni qayta o'rnatish, seanslarni yopish. "Rollar" — rol huquqlarini sozlash ("Ruxsatlarni sozlash").

## Sozlamalar (/settings)
Tablar: Klinika (nomi, manzil, telefon, logotip, Telegram bot), Tahlillar (laboratoriya katalogi va narxlari, me'yorlar), MKB-10, Tizim holati (rahbar: baza, zaxira, xatolar), Xavfsizlik.
Parolni almashtirish: Sozlamalar → Xavfsizlik → "Parolni o'zgartirish" — joriy va yangi parol. Kuchli parol: 12+ belgi, harf, raqam va belgi aralash.
2FA (ikki bosqichli kirish): Xavfsizlik → "Ikki bosqichli kirish" → telefonda Google/Microsoft Authenticator bilan QR kodni skanerlang → 6 xonali kodni kiriting → zaxira kodlarni saqlab qo'ying.
Faol seanslar — boshqa qurilmalardagi kirishlarni ko'rish va yopish. Seans siyosati — faolsizlik va umumiy muddat (admin). Amallar jurnali — kim nima qilgan (audit huquqi bilan). Zaxira nusxa — kechalik avtomatik zaxira holati.
`;
