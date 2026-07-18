import { describe, it, expect } from "vitest";
const { slugify } = require("../utils/slugify");

describe("slugify", () => {
  it("lowercases text", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("replaces spaces with hyphens", () => {
    expect(slugify("one two three")).toBe("one-two-three");
  });

  it("collapses multiple spaces/hyphens", () => {
    expect(slugify("one   two---three")).toBe("one-two-three");
  });

  it("strips accents (NFD normalize)", () => {
    expect(slugify("Café Résumé")).toBe("cafe-resume");
    expect(slugify("Données françaises")).toBe("donnees-francaises");
  });

  it("strips special characters", () => {
    expect(slugify("O'Malley & Sons, LLC.")).toBe("omalley-sons-llc");
  });

  it("handles real business names", () => {
    expect(slugify("Classic ABC Heating & Air")).toBe("classic-abc-heating-air");
    expect(slugify("Mission Critical Comfort Solutions, LLC")).toBe("mission-critical-comfort-solutions-llc");
    expect(slugify("One Hour Heating And Air Conditioning")).toBe("one-hour-heating-and-air-conditioning");
  });

  it("trims leading/trailing whitespace", () => {
    expect(slugify("  hello  ")).toBe("hello");
  });

  it("returns empty string for null/undefined/empty", () => {
    expect(slugify(null)).toBe("");
    expect(slugify(undefined)).toBe("");
    expect(slugify("")).toBe("");
    expect(slugify(123)).toBe("");
  });
});
