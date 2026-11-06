/**
 * Ko'rik xulosasi as a PDF (TZ §5.2 "ko'rik xulosasini PDF shaklida
 * chiqarish"; B3.8).
 *
 * The one layout: the dialog previews this same file, prints it and saves it,
 * so what the doctor sees is exactly what the patient takes home. Roboto is
 * embedded (lib/pdf-font) so Cyrillic names and Uzbek text render as text.
 */
import type { jsPDF as JsPdf } from "jspdf";
import { RECORD_CODE_FOR, RECORD_FIELDS, RECORD_FIELD_LABELS, REFERRAL_KIND_LABELS, REFERRAL_STAGE_LABELS, type VisitSummary } from "@shared/schema";
import { patientAge } from "@shared/patient-identity";
import { referralSubject } from "@shared/referral";
import { pdfSafe } from "./export";

const BRAND: [number, number, number] = [15, 118, 178];
const INK: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const RULE: [number, number, number] = [226, 232, 240];
const ALERT: [number, number, number] = [190, 18, 60];

const pad = (n: number) => String(n).padStart(2, "0");
const day = (v: string | null | undefined) => {
  if (!v) return "—";
  // YYYY-MM-DD stays a calendar day; a timestamp is read in local time.
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v.slice(8, 10)}.${v.slice(5, 7)}.${v.slice(0, 4)}`;
  const d = new Date(v);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};
const dateTime = (v: string | null | undefined) => {
  if (!v) return "—";
  const d = new Date(v);
  return `${day(v)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const gender = (g: string | null | undefined) => (g === "erkak" ? "Erkak" : g === "ayol" ? "Ayol" : "—");

export function visitSummaryFilename(s: VisitSummary): string {
  return `xulosa-${s.record.patientNumber}-${s.record.date}.pdf`;
}

export async function buildVisitSummaryPdf(s: VisitSummary): Promise<JsPdf> {
  const [{ jsPDF }, autoTableModule, font] = await Promise.all([import("jspdf"), import("jspdf-autotable"), import("./pdf-font")]);
  const autoTable = autoTableModule.default;

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  pdf.addFileToVFS("Roboto-Regular.ttf", font.ROBOTO_REGULAR_BASE64);
  pdf.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  pdf.addFileToVFS("Roboto-Bold.ttf", font.ROBOTO_BOLD_BASE64);
  pdf.addFont("Roboto-Bold.ttf", "Roboto", "bold");
  pdf.setProperties({
    title: pdfSafe(`Ko'rik xulosasi — ${s.record.patientName}`),
    subject: "Ko'rik xulosasi",
    author: pdfSafe(s.record.doctorName),
    creator: pdfSafe(s.clinic.labName),
  });

  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 42;
  const FOOT = 44;
  const contentW = W - M * 2;
  let y = M;

  const text = (value: string, x: number, at: number, opts: { size?: number; bold?: boolean; color?: [number, number, number]; align?: "left" | "right" | "center" } = {}) => {
    pdf.setFont("Roboto", opts.bold ? "bold" : "normal");
    pdf.setFontSize(opts.size ?? 10);
    pdf.setTextColor(...(opts.color ?? INK));
    pdf.text(pdfSafe(value), x, at, { align: opts.align ?? "left" });
  };
  const ensure = (needed: number) => {
    if (y + needed > H - FOOT) {
      pdf.addPage();
      y = M;
    }
  };
  /** A wrapped paragraph that may run over pages, line by line. */
  const paragraph = (value: string, opts: { size?: number; color?: [number, number, number]; indent?: number } = {}) => {
    const size = opts.size ?? 10.5;
    const lh = size * 1.42;
    pdf.setFont("Roboto", "normal");
    pdf.setFontSize(size);
    const lines: string[] = pdf.splitTextToSize(pdfSafe(value), contentW - (opts.indent ?? 0));
    for (const line of lines) {
      ensure(lh);
      pdf.setTextColor(...(opts.color ?? INK));
      pdf.text(line, M + (opts.indent ?? 0), y);
      y += lh;
    }
  };
  const heading = (value: string) => {
    ensure(34);
    y += 8;
    text(value.toUpperCase(), M, y, { size: 9, bold: true, color: BRAND });
    y += 6;
    pdf.setDrawColor(...RULE);
    pdf.setLineWidth(0.6);
    pdf.line(M, y, W - M, y);
    y += 15;
  };

  // ------------------------------------------------------------- letterhead
  pdf.setFillColor(...BRAND);
  pdf.rect(0, 0, W, 5, "F");
  text(s.clinic.labName, M, y + 16, { size: 19, bold: true });
  text(s.clinic.tagline, M, y + 32, { size: 9.5, color: MUTED });
  const contact = [s.clinic.address, s.clinic.phone ? `Tel: ${s.clinic.phone}` : null, s.clinic.licenseNumber ? `Litsenziya: ${s.clinic.licenseNumber}` : null].filter(
    (v): v is string => Boolean(v),
  );
  contact.forEach((line, i) => text(line, W - M, y + 12 + i * 12, { size: 8.5, color: MUTED, align: "right" }));
  y += 46;
  pdf.setDrawColor(...INK);
  pdf.setLineWidth(1.2);
  pdf.line(M, y, W - M, y);
  y += 28;

  text("KO'RIK XULOSASI", M, y, { size: 15, bold: true });
  text(`Sana: ${day(s.record.date)}`, W - M, y, { size: 10, align: "right" });
  y += 20;

  // ---------------------------------------------------------------- patient
  const a = s.appointment;
  const age = a ? patientAge({ birthDate: a.patientBirthDate, age: a.patientAge }) : null;
  const rows: [string, string][] = [
    ["Bemor", s.record.patientName],
    ["Bemor ID", `#${s.record.patientNumber}`],
    ["Tug'ilgan sana", a?.patientBirthDate ? `${day(a.patientBirthDate)}${age !== null ? ` (${age} yosh)` : ""}` : age !== null ? `~${age} yosh` : "—"],
    ["Jinsi", gender(a?.patientGender)],
    ["Qabul", `${day(s.record.date)}, ${s.record.startTime}${a?.serviceName ? ` · ${a.serviceName}` : ""}`],
    ["Shifokor", `${s.record.doctorName} (${s.record.specialty})${a?.room ? `, ${a.room}-xona` : ""}`],
  ];
  const boxTop = y;
  const colW = contentW / 2;
  const rowH = 17;
  const boxH = Math.ceil(rows.length / 2) * rowH + 14;
  pdf.setDrawColor(...RULE);
  pdf.setLineWidth(0.8);
  pdf.roundedRect(M, boxTop, contentW, boxH, 4, 4, "S");
  rows.forEach(([label, value], i) => {
    const x = M + 12 + (i % 2) * colW;
    const at = boxTop + 20 + Math.floor(i / 2) * rowH;
    text(`${label}:`, x, at, { size: 9, color: MUTED });
    pdf.setFont("Roboto", "normal");
    pdf.setFontSize(9);
    const labelW = pdf.getTextWidth(pdfSafe(`${label}: `));
    const fitted = pdf.splitTextToSize(pdfSafe(value), colW - 24 - labelW)[0] ?? "";
    text(fitted, x + labelW, at, { size: 9.5, bold: true });
  });
  y = boxTop + boxH + 16;

  // -------------------------------------------------------------- allergies
  if (s.allergies.length) {
    ensure(24);
    const list = s.allergies.map((x) => (x.reaction ? `${x.allergen} (${x.reaction})` : x.allergen)).join("; ");
    text("Allergiya:", M, y, { size: 10, bold: true, color: ALERT });
    pdf.setFont("Roboto", "bold");
    const lw = pdf.getTextWidth("Allergiya: ");
    pdf.setFont("Roboto", "normal");
    pdf.setFontSize(10);
    const lines: string[] = pdf.splitTextToSize(pdfSafe(list), contentW - lw);
    lines.forEach((line, i) => {
      if (i > 0) ensure(14);
      text(line, M + lw, y, { size: 10, color: ALERT });
      y += 14;
    });
    y += 4;
  }

  // ------------------------------------------------------------ the record
  const icd = new Map(s.icd.map((x) => [x.code, x]));
  for (const field of RECORD_FIELDS) {
    const value = s.record[field]?.trim();
    const code = field === "preliminaryDiagnosis" || field === "finalDiagnosis" ? s.record[RECORD_CODE_FOR[field]] : null;
    if (!value && !code) continue;
    heading(RECORD_FIELD_LABELS[field]);
    if (code) {
      // The code and its name in both languages: the patient's next doctor may read either.
      const label = icd.get(code);
      ensure(16);
      text(`MKB-10: ${code}`, M, y, { size: 10.5, bold: true, color: BRAND });
      y += 15;
      if (label?.nameUz) paragraph(label.nameUz, { size: 9.5 });
      if (label?.nameRu && label.nameRu !== value) paragraph(label.nameRu, { size: 9.5, color: MUTED });
    }
    if (value) paragraph(value);
  }

  // ------------------------------------------------------------- referrals
  if (s.referrals.length) {
    heading("Yo'llanmalar");
    for (const r of s.referrals) {
      const line = `№${r.referralNumber} · ${REFERRAL_KIND_LABELS[r.kind]}: ${referralSubject(r)} — ${REFERRAL_STAGE_LABELS[r.stage].toLowerCase()}${
        r.booking ? ` (${day(r.booking.date)} ${r.booking.startTime}, ${r.booking.doctorName})` : ""
      }`;
      paragraph(line, { size: 10 });
      if (r.note) paragraph(`Ko'rsatma: ${r.note}`, { size: 9, color: MUTED, indent: 12 });
      if (r.order && r.order.results.length) {
        ensure(40);
        autoTable(pdf, {
          startY: y - 4,
          margin: { left: M + 12, right: M, bottom: FOOT + 6 },
          head: [["Tahlil", "Natija", "Birlik", "Me'yor"]],
          body: r.order.results.map((x) => [
            pdfSafe(x.testName),
            pdfSafe(`${x.result}${x.flag === "high" ? " ↑" : x.flag === "low" ? " ↓" : ""}`),
            pdfSafe(x.unit ?? ""),
            pdfSafe(x.referenceRange ?? ""),
          ]),
          styles: { font: "Roboto", fontSize: 8.5, cellPadding: 3.5, textColor: INK, lineColor: RULE, lineWidth: 0.5 },
          headStyles: { font: "Roboto", fontStyle: "bold", fillColor: [241, 245, 249], textColor: INK },
          didParseCell: (cell) => {
            const flag = cell.section === "body" && cell.column.index === 1 ? r.order!.results[cell.row.index]?.flag : null;
            if (flag === "high" || flag === "low") {
              cell.cell.styles.textColor = flag === "high" ? ALERT : BRAND;
              cell.cell.styles.fontStyle = "bold";
            }
          },
        });
        y = ((pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 14;
        if (r.order.verified < r.order.tests) {
          paragraph(`Yana ${r.order.tests - r.order.verified} ta tahlil natijasi hali tayyor emas.`, { size: 8.5, color: MUTED, indent: 12 });
        }
      }
      y += 2;
    }
  }

  // -------------------------------------------------------------- signature
  ensure(96);
  y += 18;
  text(`Shifokor: ${s.record.doctorName}`, M, y, { size: 10 });
  text(s.record.specialty, M, y + 13, { size: 8.5, color: MUTED });
  pdf.setDrawColor(...MUTED);
  pdf.setLineWidth(0.5);
  pdf.line(W - M - 170, y + 2, W - M, y + 2);
  text("imzo", W - M - 85, y + 13, { size: 7.5, color: MUTED, align: "center" });
  y += 32;

  const signer = s.record.signedByName ?? s.record.doctorName;
  const stamp = `Elektron tasdiqlangan · ${signer} · ${dateTime(s.record.signedAt)}${s.record.version > 1 ? ` · v${s.record.version}` : ""}`;
  pdf.setFont("Roboto", "bold");
  pdf.setFontSize(8.5);
  const stampW = pdf.getTextWidth(pdfSafe(stamp)) + 18;
  pdf.setDrawColor(4, 120, 87);
  pdf.setLineWidth(0.8);
  pdf.roundedRect(M, y - 11, stampW, 17, 3, 3, "S");
  text(stamp, M + 9, y + 1, { size: 8.5, bold: true, color: [4, 120, 87] });
  y += 18;
  if (s.record.version > 1 && s.record.amendReason) {
    paragraph(`Tuzatilgan nusxa (${dateTime(s.record.amendedAt)}). Sabab: ${s.record.amendReason}`, { size: 8.5, color: MUTED });
  }

  // ----------------------------------------------------------------- footer
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(...RULE);
    pdf.setLineWidth(0.5);
    pdf.line(M, H - 32, W - M, H - 32);
    text(
      `Xulosa elektron tibbiy karta asosida tayyorlandi · ${dateTime(s.generatedAt)} · ${s.generatedBy}`,
      M,
      H - 20,
      { size: 7.5, color: MUTED },
    );
    text(`${i} / ${pages}`, W - M, H - 20, { size: 7.5, color: MUTED, align: "right" });
  }
  return pdf;
}
