import { describe, it, expect } from "vitest";
const { computeScore } = require("../scoring/score");

describe("computeScore", () => {
  it("returns 0 for an empty lead", () => {
    const { score, score_detail } = computeScore({});
    expect(score).toBe(0);
    expect(score_detail.website).toBe(0);
    expect(score_detail.socials).toBe(0);
    expect(score_detail.reputation).toBe(0);
    expect(score_detail.contact).toBe(0);
  });

  it("scores website signals correctly", () => {
    const { score_detail } = computeScore({
      https: true,           // +5
      mobile_friendly: true, // +8
      copyright_year: 2024,  // +5
      meta_desc_present: true, // +4
      favicon_present: true, // +3
    });
    expect(score_detail.website).toBe(25); // max
  });

  it("ignores outdated copyright year", () => {
    const { score_detail } = computeScore({ copyright_year: 2019 });
    expect(score_detail.website).toBe(0);
  });

  it("accepts copyright year 2022 (boundary)", () => {
    const { score_detail } = computeScore({ copyright_year: 2022 });
    expect(score_detail.website).toBe(5);
  });

  it("scores socials — 4pts each, max 25", () => {
    const { score_detail } = computeScore({
      facebook: "https://fb.com/x",
      instagram: "https://ig.com/x",
      linkedin: "https://li.com/x",
    });
    expect(score_detail.socials).toBe(12); // 3 * 4

    // All 6 socials = 24, not 25 (6*4=24, cap is 25)
    const { score_detail: all } = computeScore({
      facebook: "x", instagram: "x", linkedin: "x",
      twitter: "x", tiktok: "x", youtube: "x",
    });
    expect(all.socials).toBe(24);
  });

  it("caps socials at 25", () => {
    // Can't actually exceed with 6 * 4 = 24, but test the cap logic
    const { score_detail } = computeScore({
      facebook: "x", instagram: "x", linkedin: "x",
      twitter: "x", tiktok: "x", youtube: "x",
    });
    expect(score_detail.socials).toBeLessThanOrEqual(25);
  });

  it("scores reputation correctly", () => {
    // rating 5/5 = 15pts, 20+ reviews = 10pts
    const { score_detail } = computeScore({ rating: 5, reviews_count: 20 });
    expect(score_detail.reputation).toBe(25);

    // rating 4/5 = 12pts, 10 reviews = 5pts
    const { score_detail: mid } = computeScore({ rating: 4, reviews_count: 10 });
    expect(mid.reputation).toBe(17); // 12 + 5
  });

  it("handles reviews_count > 20 (capped)", () => {
    const { score_detail } = computeScore({ rating: 5, reviews_count: 500 });
    expect(score_detail.reputation).toBe(25);
  });

  it("scores contact info", () => {
    const { score_detail } = computeScore({
      email: "info@test.com",   // +10
      phone: "+15551234567",    // +10
      address: "123 Main St",   // +5
    });
    expect(score_detail.contact).toBe(25); // max
  });

  it("doesn't award email points when the email is known invalid", () => {
    const { score_detail } = computeScore({
      email: "605a7baede844d278b89dc95ae0a9123@sentry-next.wixpress.com",
      email_status: "invalid",
      phone: "+15551234567",
      address: "123 Main St",
    });
    expect(score_detail.contact).toBe(15); // phone + address only, no email
  });

  it("computes total correctly", () => {
    const { score } = computeScore({
      https: true, mobile_friendly: true, copyright_year: 2024,
      meta_desc_present: true, favicon_present: true,
      facebook: "x", instagram: "x",
      rating: 4.5, reviews_count: 15,
      email: "info@test.com", phone: "+1555", address: "123 St",
    });
    // website: 25, socials: 8, reputation: 13.5+7.5=21, contact: 25
    expect(score).toBeGreaterThan(70);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("never exceeds 100", () => {
    const { score } = computeScore({
      https: true, mobile_friendly: true, copyright_year: 2026,
      meta_desc_present: true, favicon_present: true,
      facebook: "x", instagram: "x", linkedin: "x",
      twitter: "x", tiktok: "x", youtube: "x",
      rating: 5, reviews_count: 100,
      email: "x@x.com", phone: "+1", address: "x",
    });
    expect(score).toBeLessThanOrEqual(100);
  });
});
