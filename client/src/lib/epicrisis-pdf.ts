/**
 * Epikriz (B6.7, TZ §8.1.5) as a PDF: the discharge summary the patient takes
 * home and the next doctor reads. Same house style as the examination summary
 * (lib/visit-summary-pdf): letterhead with the logo, the patient block, the
 * allergies in red, the sections, the doctor's signature line and the
 * electronic-confirmation stamp (who saved this version, when). Roboto is
 * embedded so Cyrillic and Uzbek render as text. The dialog previews this very
 * file, prints it and saves it.
 */
import type { jsPDF as JsPdf } from "jspdf";
import type { EpicrisisDocument } from "@shared/schema";
import { EPICRISIS_FIELD_LABELS } from "@shared/epicrisis";
import { pdfSafe } from "./export";

type Rgb = [number, number, number];
const BRAND: Rgb = [15, 118, 178];
const INK: Rgb = [15, 23, 42];
const MUTED: Rgb = [100, 116, 139];
const RULE: Rgb = [226, 232, 240];
const ALERT: Rgb = [190, 18, 60];
const SIGNED: Rgb = [4, 120, 87];

const pad = (n: number) => String(n).padStart(2, "0");
const day = (v: string | null | undefined) => {
  if (!v) return "—";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};
const dateTime = (v: string | null | undefined) => {
  if (!v) return "—";
  const d = new Date(v);
  return `${day(v)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const gender = (g: string | null | undefined) => (g === "erkak" ? "Erkak" : g === "ayol" ? "Ayol" : "—");

export function epicrisisFilename(d: EpicrisisDocument): string {
  return `epikriz-${d.admission.number}-${d.admission.patientName.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.pdf`;
}

export async function buildEpicrisisPdf(d: EpicrisisDocument): Promise<JsPdf> {
  const [{ jsPDF }, font] = await Promise.all([import("jspdf"), import("./pdf-font")]);
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  pdf.addFileToVFS("Roboto-Regular.ttf", font.ROBOTO_REGULAR_BASE64);
  pdf.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  pdf.addFileToVFS("Roboto-Bold.ttf", font.ROBOTO_BOLD_BASE64);
  pdf.addFont("Roboto-Bold.ttf", "Roboto", "bold");
  const a = d.admission;
  const e = d.epicrisis;
  pdf.setProperties({ title: pdfSafe(`Epikriz — ${a.patientName}`), subject: "Epikriz", author: pdfSafe(a.doctorName), creator: pdfSafe(d.clinic.labName) });

  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 42;
  const FOOT = 44;
  const contentW = W - M * 2;
  let y = M;

  const text = (value: string, x: number, at: number, o: { size?: number; bold?: boolean; color?: Rgb; align?: "left" | "right" | "center" } = {}) => {
    pdf.setFont("Roboto", o.bold ? "bold" : "normal");
    pdf.setFontSize(o.size ?? 10);
    pdf.setTextColor(...(o.color ?? INK));
    pdf.text(pdfSafe(value), x, at, { align: o.align ?? "left" });
  };
  const ensure = (needed: number) => {
    if (y + needed > H - FOOT) {
      pdf.addPage();
      y = M;
    }
  };
  const paragraph = (value: string, o: { size?: number; color?: Rgb; bold?: boolean; indent?: number } = {}) => {
    const size = o.size ?? 10.5;
    const lh = size * 1.42;
    for (const block of value.split(/\n/)) {
      pdf.setFont("Roboto", o.bold ? "bold" : "normal");
      pdf.setFontSize(size);
      const lines: string[] = block.trim() ? pdf.splitTextToSize(pdfSafe(block), contentW - (o.indent ?? 0)) : [""];
      for (const line of lines) {
        ensure(lh);
        text(line, M + (o.indent ?? 0), y, { size, bold: o.bold, color: o.color });
        y += lh;
      }
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

  // ------------------------------------------------------------ letterhead
  pdf.setFillColor(...BRAND);
  pdf.rect(0, 0, W, 5, "F");
  let nameX = M;
  if (d.logo) {
    try {
      const { width, height } = pdf.getImageProperties(d.logo);
      const fit = Math.min(120 / width, 40 / height);
      pdf.addImage(d.logo, d.logo.startsWith("data:image/png") ? "PNG" : "JPEG", M, y + 20 - (height * fit) / 2, width * fit, height * fit);
      nameX = M + width * fit + 12;
    } catch {
      // A logo that cannot be drawn leaves the name alone rather than the document unmade.
    }
  }
  text(d.clinic.labName, nameX, y + 16, { size: 19, bold: true });
  text(d.clinic.tagline, nameX, y + 32, { size: 9.5, color: MUTED });
  [d.clinic.address, d.clinic.phone ? `Tel: ${d.clinic.phone}` : null, d.clinic.licenseNumber ? `Litsenziya: ${d.clinic.licenseNumber}` : null]
    .filter((v): v is string => Boolean(v))
    .forEach((line, i) => text(line, W - M, y + 12 + i * 12, { size: 8.5, color: MUTED, align: "right" }));
  y += 46;
  pdf.setDrawColor(...INK);
  pdf.setLineWidth(1.2);
  pdf.line(M, y, W - M, y);
  y += 28;
  text("EPIKRIZ", M, y, { size: 15, bold: true });
  text(`Statsionar karta №${a.number}`, W - M, y, { size: 10, align: "right" });
  y += 13;
  text("Statsionar bemorning kasallik tarixidan ko'chirma", M, y, { size: 9, color: MUTED });
  y += 18;

  // ------------------------------------------------------------ the patient and the stay
  const rows: [string, string][] = [
    ["Bemor", a.patientName],
    ["Bemor ID", `#${a.patientNumber}`],
    ["Tug'ilgan sana", d.patient.birthDate ? `${day(d.patient.birthDate)}${d.patient.age !== null ? ` (${d.patient.age} yosh)` : ""}` : d.patient.age !== null ? `~${d.patient.age} yosh` : "—"],
    ["Jinsi", gender(d.patient.gender)],
    ["Bo'lim", a.departmentName],
    ["Palata", [...new Set(a.stays.map((s) => s.wardName))].join(" → ") || "—"],
    ["Yotqizilgan", dateTime(a.admittedAt)],
    ["Chiqarilgan", a.dischargedAt ? dateTime(a.dischargedAt) : "hali statsionarda"],
    ["Yotoq-kun", String(d.days)],
    ["Davolovchi shifokor", a.doctorName],
  ];
  const top = y;
  const colW = contentW / 2;
  const rowH = 17;
  const boxH = Math.ceil(rows.length / 2) * rowH + 14;
  pdf.setDrawColor(...RULE);
  pdf.setLineWidth(0.8);
  pdf.roundedRect(M, top, contentW, boxH, 4, 4, "S");
  rows.forEach(([label, value], i) => {
    const x = M + 12 + (i % 2) * colW;
    const at = top + 20 + Math.floor(i / 2) * rowH;
    text(`${label}:`, x, at, { size: 9, color: MUTED });
    pdf.setFont("Roboto", "normal");
    pdf.setFontSize(9);
    const lw = pdf.getTextWidth(pdfSafe(`${label}: `));
    text(pdf.splitTextToSize(pdfSafe(value), colW - 24 - lw)[0] ?? "", x + lw, at, { size: 9.5, bold: true });
  });
  y = top + boxH + 16;

  if (d.allergies.length) {
    ensure(24);
    const list = d.allergies.map((x) => (x.reaction ? `${x.allergen} (${x.reaction})` : x.allergen)).join("; ");
    paragraph(`Allergiya: ${list}`, { size: 10, bold: true, color: ALERT });
    y += 4;
  }

  // ------------------------------------------------------------ the sections
  heading(EPICRISIS_FIELD_LABELS.finalDiagnosis);
  if (e.finalDiagnosisCode) {
    ensure(16);
    text(`MKB-10: ${e.finalDiagnosisCode}`, M, y, { size: 10.5, bold: true, color: BRAND });
    y += 15;
    if (d.icd?.nameUz) paragraph(d.icd.nameUz, { size: 9.5 });
    if (d.icd?.nameRu && d.icd.nameRu !== e.finalDiagnosis) paragraph(d.icd.nameRu, { size: 9.5, color: MUTED });
  }
  if (e.finalDiagnosis) paragraph(e.finalDiagnosis, { bold: true });
  for (const f of ["epicrisis", "treatmentSummary", "recommendations"] as const) {
    const value = e[f]?.trim();
    if (!value) continue;
    heading(EPICRISIS_FIELD_LABELS[f]);
    paragraph(value);
  }

  // ------------------------------------------------------------ signature
  ensure(96);
  y += 18;
  text(`Davolovchi shifokor: ${a.doctorName}`, M, y, { size: 10 });
  if (a.doctorSpecialty) text(a.doctorSpecialty, M, y + 13, { size: 8.5, color: MUTED });
  pdf.setDrawColor(...MUTED);
  pdf.setLineWidth(0.5);
  pdf.line(W - M - 150, y + 2, W - M, y + 2);
  text("imzo", W - M - 75, y + 13, { size: 7.5, color: MUTED, align: "center" });
  y += 32;
  const stamp = `Elektron tasdiqlangan · ${e.savedByName ?? a.doctorName} · ${dateTime(e.savedAt)}${e.version > 1 ? ` · v${e.version}` : ""}`;
  pdf.setFont("Roboto", "bold");
  pdf.setFontSize(8.5);
  const stampW = pdf.getTextWidth(pdfSafe(stamp)) + 18;
  pdf.setDrawColor(...SIGNED);
  pdf.setLineWidth(0.8);
  pdf.roundedRect(M, y - 11, stampW, 17, 3, 3, "S");
  text(stamp, M + 9, y + 1, { size: 8.5, bold: true, color: SIGNED });
  y += 18;
  if (e.reason) paragraph(`Tuzatilgan nusxa. Sabab: ${e.reason}`, { size: 8.5, color: MUTED });
  if (!a.dischargedAt) paragraph("Qoralama — bemor hali chiqarilmagan.", { size: 8.5, color: ALERT });

  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(...RULE);
    pdf.setLineWidth(0.5);
    pdf.line(M, H - 32, W - M, H - 32);
    text(`Epikriz statsionar kasallik tarixi asosida tayyorlandi · ${dateTime(d.generatedAt)} · ${d.generatedBy}`, M, H - 20, { size: 7.5, color: MUTED });
    text(`${i} / ${pages}`, W - M, H - 20, { size: 7.5, color: MUTED, align: "right" });
  }
  return pdf;
}
