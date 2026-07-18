import { describe, it, expect } from "vitest";
const { isRealEmail } = require("../utils/email");

describe("isRealEmail", () => {
  // ── Valid emails ──
  it("accepts standard business emails", () => {
    expect(isRealEmail("info@company.com")).toBe(true);
    expect(isRealEmail("john@classicheatandair.com")).toBe(true);
    expect(isRealEmail("service@hvac-pros.com")).toBe(true);
  });

  it("accepts emails with dots and plus", () => {
    expect(isRealEmail("john.smith@company.com")).toBe(true);
    expect(isRealEmail("user+tag@domain.org")).toBe(true);
  });

  it("accepts emails with subdomains", () => {
    expect(isRealEmail("info@mail.company.com")).toBe(true);
  });

  // ── Invalid: locale too short ──
  it("rejects locale < 4 chars", () => {
    expect(isRealEmail("hi@company.com")).toBe(false);   // 2 chars
    expect(isRealEmail("abc@company.com")).toBe(false);  // 3 chars
    expect(isRealEmail("jo@x.com")).toBe(false);
  });

  it("accepts locale = 4 chars (boundary)", () => {
    expect(isRealEmail("john@company.com")).toBe(true);
  });

  // ── Invalid: SLD too short ──
  it("rejects SLD < 3 chars", () => {
    expect(isRealEmail("info@ab.com")).toBe(false);  // 2 chars
    expect(isRealEmail("info@x.org")).toBe(false);
  });

  it("accepts SLD = 3 chars (boundary)", () => {
    expect(isRealEmail("info@abc.com")).toBe(true);
  });

  // ── Invalid: TLD too long ──
  it("rejects TLD > 6 chars", () => {
    expect(isRealEmail("info@company.abcdefg")).toBe(false);  // 7 chars
  });

  it("accepts TLD = 6 chars (boundary)", () => {
    expect(isRealEmail("info@company.museum")).toBe(true);  // 6 chars
  });

  // ── Invalid: format ──
  it("rejects non-string inputs", () => {
    expect(isRealEmail(null)).toBe(false);
    expect(isRealEmail(undefined)).toBe(false);
    expect(isRealEmail(123)).toBe(false);
    expect(isRealEmail("")).toBe(false);
  });

  it("rejects emails without @", () => {
    expect(isRealEmail("infocompany.com")).toBe(false);
  });

  it("rejects emails without TLD", () => {
    expect(isRealEmail("info@company")).toBe(false);
  });

  // ── JS placeholders & junk ──
  it("rejects common JS placeholders", () => {
    expect(isRealEmail("{{email}}")).toBe(false);
    expect(isRealEmail("user@example")).toBe(false);
    expect(isRealEmail("name@domain")).toBe(false);
  });
});
