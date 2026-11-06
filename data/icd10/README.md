# MKB-10 katalogi (B3.4, D-5)

| Fayl | Manba |
|---|---|
| `mkb10-nsi-2.27.csv` | Rossiya Federatsiyasi Sog'liqni saqlash vazirligining NSI portali, ma'lumotnoma OID `1.2.643.5.1.13.13.11.1005`, versiya 2.27. Fayl [ak4nv/mkb10](https://github.com/ak4nv/mkb10) reposidan (MIT) olingan, o'zgartirilmagan. |

Kodlar va tasnif — JSST (WHO) ICD-10. Ruscha nomlar shu rasmiy ma'lumotnomadan.

**O'zbekcha nomlar** bu faylda yo'q: MKB-10 ning ochiq rasmiy o'zbekcha nashri topilmadi
(`terminology.dhp.uz` ochiq emas, JSST saytida o'zbekcha faqat MKB-11). O'zbekcha nomlar
tizimda alohida ustunda saqlanadi va klinika tomonidan to'ldiriladi:

- Sozlamalar → MKB-10: kod bo'yicha qo'lda tahrirlash;
- yoki o'sha ekrandan CSV import: `code;name_uz` (sarlavha qatori bilan, `;` yoki `,` ajratuvchi).

Katalogni bazaga yuklash: `npm run db:icd10` (qayta ishga tushirsa xavfsiz, o'zbekcha nomlarga tegmaydi).
