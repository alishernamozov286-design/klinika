import { describe, expect, it } from "vitest";
import { isOpenStage, referralBookingProblem, referralStage, referralSubject } from "./referral";

describe("referral stage (B3.5) — derived, never stored", () => {
  const lab = (status: "pending" | "in_progress" | "completed" | "cancelled" | null) => ({
    kind: "lab" as const,
    status: "active" as const,
    order: status ? { status } : null,
    booking: null,
  });
  const booked = (status: "scheduled" | "arrived" | "in_progress" | "completed" | null, kind: "exam" | "consult" = "exam") => ({
    kind,
    status: "active" as const,
    order: null,
    booking: status ? { status } : null,
  });

  it("a lab referral follows its order", () => {
    expect(referralStage(lab("pending"))).toBe("in_lab");
    expect(referralStage(lab("in_progress"))).toBe("in_lab");
    expect(referralStage(lab("completed"))).toBe("done");
    expect(referralStage(lab("cancelled"))).toBe("cancelled");
    expect(referralStage(lab(null))).toBe("cancelled");
  });

  it("an examination or consultation follows its live booking", () => {
    expect(referralStage(booked(null))).toBe("awaiting_booking");
    expect(referralStage(booked("scheduled"))).toBe("scheduled");
    expect(referralStage(booked("in_progress", "consult"))).toBe("scheduled");
    expect(referralStage(booked("completed", "consult"))).toBe("done");
  });

  it("a cancelled referral is cancelled whatever stands behind it", () => {
    expect(referralStage({ ...booked("scheduled"), status: "cancelled" })).toBe("cancelled");
    expect(isOpenStage("cancelled")).toBe(false);
    expect(isOpenStage("done")).toBe(false);
    expect(isOpenStage("awaiting_booking")).toBe(true);
    expect(isOpenStage("in_lab")).toBe(true);
  });
});

describe("booking a referral", () => {
  const exam = {
    kind: "exam" as const,
    status: "active" as const,
    patientId: "p1",
    serviceId: "uzi-1",
    serviceName: "UZI qorin",
    targetDoctorId: null,
    targetSpecialty: null,
  };
  const consult = {
    kind: "consult" as const,
    status: "active" as const,
    patientId: "p1",
    serviceId: null,
    targetDoctorId: null,
    targetSpecialty: "Kardiolog",
  };
  const booking = { patientId: "p1", doctorId: "d1", doctorSpecialty: "Kardiolog", serviceId: "uzi-1" };

  it("accepts the matching patient and service", () => {
    expect(referralBookingProblem(exam, booking)).toBeNull();
  });

  it("refuses another patient, another service, a lab or a cancelled referral", () => {
    expect(referralBookingProblem(exam, { ...booking, patientId: "p2" })).toMatch(/boshqa bemorga/);
    expect(referralBookingProblem(exam, { ...booking, serviceId: null })).toMatch(/UZI qorin/);
    expect(referralBookingProblem({ ...exam, kind: "lab" }, booking)).toMatch(/Laboratoriya/);
    expect(referralBookingProblem({ ...exam, status: "cancelled" }, booking)).toMatch(/bekor/);
  });

  it("a consultation goes to the specialty asked for, ignoring case and spaces", () => {
    expect(referralBookingProblem(consult, { ...booking, doctorSpecialty: " kardiolog " })).toBeNull();
    expect(referralBookingProblem(consult, { ...booking, doctorSpecialty: "Nevrolog" })).toMatch(/Kardiolog/);
  });

  it("…or to the one doctor asked for", () => {
    const named = { ...consult, targetDoctorId: "d9", targetDoctorName: "Aliyev Vali" };
    expect(referralBookingProblem(named, { ...booking, doctorId: "d9" })).toBeNull();
    expect(referralBookingProblem(named, booking)).toMatch(/Aliyev Vali/);
  });
});

describe("referral subject line", () => {
  const base = { serviceName: null, targetSpecialty: null, targetDoctorName: null, order: null };
  it("names what the referral is for", () => {
    expect(referralSubject({ ...base, kind: "lab", order: { testNames: ["OAK", "Glyukoza"] } })).toBe("OAK, Glyukoza");
    expect(referralSubject({ ...base, kind: "lab", order: { testNames: ["A", "B", "C", "D", "E"] } })).toBe("A, B, C va yana 2 ta");
    expect(referralSubject({ ...base, kind: "exam", serviceName: "UZI buyrak" })).toBe("UZI buyrak");
    expect(referralSubject({ ...base, kind: "consult", targetSpecialty: "Kardiolog", targetDoctorName: "Aliyev Vali" })).toBe("Kardiolog · Aliyev Vali");
  });
});
