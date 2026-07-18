import { describe, it, expect } from "vitest";
const { nameSimilarity, extractDomain, phoneDigits } = require("../utils/dedup");

describe("phoneDigits", () => {
  it("extracts last 10 digits", () => {
    expect(phoneDigits("+19724232121")).toBe("9724232121");
  });

  it("handles formatted phones", () => {
    expect(phoneDigits("+1-972-423-2121")).toBe("9724232121");
    expect(phoneDigits("(972) 423-2121")).toBe("9724232121");
  });

  it("returns null for short phones", () => {
    expect(phoneDigits("12345")).toBeNull();
  });

  it("returns null for null/undefined", () => {
    expect(phoneDigits(null)).toBeNull();
    expect(phoneDigits(undefined)).toBeNull();
  });
});

describe("extractDomain", () => {
  it("extracts domain from https URL", () => {
    expect(extractDomain("https://www.classicheatandair.com/")).toBe("classicheatandair.com");
  });

  it("extracts domain from http URL", () => {
    expect(extractDomain("http://example.com/page")).toBe("example.com");
  });

  it("handles URL without protocol", () => {
    expect(extractDomain("classicheatandair.com")).toBe("classicheatandair.com");
  });

  it("strips www prefix", () => {
    expect(extractDomain("https://www.example.com")).toBe("example.com");
  });

  it("returns null for null/empty", () => {
    expect(extractDomain(null)).toBeNull();
    expect(extractDomain("")).toBeNull();
  });
});

describe("nameSimilarity", () => {
  it("identical names = 1.0", () => {
    expect(nameSimilarity("Classic Heating Air", "Classic Heating Air")).toBe(1);
  });

  it("same name different suffix = high similarity", () => {
    const sim = nameSimilarity("Classic Heating & Air", "Classic Heating & Air LLC");
    expect(sim).toBeGreaterThanOrEqual(0.8);
  });

  it("same business slightly different name = high similarity", () => {
    const sim = nameSimilarity("Classic ABC Heating & Air", "Classic Heating and Air");
    expect(sim).toBeGreaterThanOrEqual(0.6);
  });

  it("totally different businesses = low similarity", () => {
    const sim = nameSimilarity("Classic Heating & Air", "Joe's Plumbing Services");
    expect(sim).toBeLessThan(0.3);
  });

  it("handles null", () => {
    expect(nameSimilarity(null, "test")).toBe(0);
    expect(nameSimilarity("test", null)).toBe(0);
  });

  it("strips common suffixes for comparison", () => {
    const sim = nameSimilarity("ABC Services LLC", "ABC Services Inc");
    expect(sim).toBe(1); // both reduce to "abc services"
  });
});
