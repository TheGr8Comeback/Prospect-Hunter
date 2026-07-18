import { describe, it, expect } from "vitest";

// Extract isParkedSite for testing — replicate the logic
const PARKED_PATTERNS = [
  /this\s+domain\s+is\s+for\s+sale/i,
  /buy\s+this\s+domain/i,
  /domain\s+is\s+parked/i,
  /parked\s+by/i,
  /domain\s+parking/i,
  /godaddy\.com\/forsale/i,
  /sedoparking\.com/i,
  /hugedomains\.com/i,
  /is\s+available\s+for\s+purchase/i,
  /website\s+is\s+coming\s+soon/i,
  /under\s+construction/i,
  /future\s+home\s+of\s+something/i,
];

function isParkedSite(html, statusCode) {
  if (statusCode >= 400) return true;
  if (!html || html.length < 500) return true;
  const lower = html.toLowerCase();
  for (const pattern of PARKED_PATTERNS) {
    if (pattern.test(lower)) return true;
  }
  return false;
}

describe("isParkedSite", () => {
  const realHtml = "<html><head><title>Classic Heating</title></head><body>" + "x".repeat(600) + "</body></html>";

  it("detects 404/500 as parked", () => {
    expect(isParkedSite(realHtml, 404)).toBe(true);
    expect(isParkedSite(realHtml, 500)).toBe(true);
  });

  it("detects empty/tiny pages as parked", () => {
    expect(isParkedSite("", 200)).toBe(true);
    expect(isParkedSite("<html></html>", 200)).toBe(true);
    expect(isParkedSite(null, 200)).toBe(true);
  });

  it("detects GoDaddy parked domains", () => {
    const html = "<html><body>" + "x".repeat(600) + "This domain is for sale on godaddy.com/forsale</body></html>";
    expect(isParkedSite(html, 200)).toBe(true);
  });

  it("detects 'domain is parked' text", () => {
    const html = "<html><body>" + "x".repeat(600) + "This domain is parked free of charge</body></html>";
    expect(isParkedSite(html, 200)).toBe(true);
  });

  it("detects 'buy this domain' text", () => {
    const html = "<html><body>" + "x".repeat(600) + "Buy this domain now for $2000</body></html>";
    expect(isParkedSite(html, 200)).toBe(true);
  });

  it("detects 'under construction' text", () => {
    const html = "<html><body>" + "x".repeat(600) + "This website is under construction</body></html>";
    expect(isParkedSite(html, 200)).toBe(true);
  });

  it("detects 'coming soon' text", () => {
    const html = "<html><body>" + "x".repeat(600) + "Our website is coming soon!</body></html>";
    expect(isParkedSite(html, 200)).toBe(true);
  });

  it("detects sedoparking", () => {
    const html = "<html><body>" + "x".repeat(600) + "sedoparking.com tracking</body></html>";
    expect(isParkedSite(html, 200)).toBe(true);
  });

  it("does NOT flag real business sites", () => {
    expect(isParkedSite(realHtml, 200)).toBe(false);
  });

  it("does NOT flag large legitimate pages", () => {
    const bigHtml = "<html><head><title>HVAC Company</title></head><body>" +
      "<h1>Welcome</h1><p>We provide heating and cooling services.</p>" +
      "content".repeat(200) + "</body></html>";
    expect(isParkedSite(bigHtml, 200)).toBe(false);
  });
});
