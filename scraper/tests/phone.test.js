import { describe, it, expect } from "vitest";
const { normalizePhone } = require("../utils/phone");

describe("normalizePhone", () => {
  it("keeps valid phone numbers", () => {
    expect(normalizePhone("+1-972-423-2121")).toBeTruthy();
    expect(normalizePhone("(555) 123-4567")).toBeTruthy();
    expect(normalizePhone("+33 6 12 34 56 78")).toBeTruthy();
  });

  it("rejects too-short numbers (< 7 digits)", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
  });

  it("accepts exactly 7 digits", () => {
    expect(normalizePhone("1234567")).toBeTruthy();
  });

  it("handles null/undefined/empty", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });

  it("handles non-string input", () => {
    expect(normalizePhone(123)).toBeNull();
  });

  it("strips non-phone characters but keeps structure", () => {
    const result = normalizePhone("+1-972-423-2121");
    expect(result).toBeTruthy();
    // Should contain the digits
    expect(result.replace(/\D/g, "")).toBe("19724232121");
  });
});
