import { describe, it, expect, beforeEach } from "vitest";
const { wait, reset, getStats, extractDomain } = require("../utils/rate-limiter");

beforeEach(() => {
  reset();
});

describe("extractDomain", () => {
  it("extracts hostname from full URL", () => {
    expect(extractDomain("https://www.bbb.org/us/tx/plano")).toBe("www.bbb.org");
  });

  it("returns domain as-is when no protocol", () => {
    expect(extractDomain("bbb.org")).toBe("bbb.org");
  });

  it("handles http protocol", () => {
    expect(extractDomain("http://yelp.com/biz/foo")).toBe("yelp.com");
  });

  it("returns input for invalid URL", () => {
    expect(extractDomain("not a url")).toBe("not a url");
  });
});

describe("wait", () => {
  it("first call returns immediately", async () => {
    const start = Date.now();
    await wait("example.com");
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it("second call to same domain waits", async () => {
    await wait("example.com"); // first call, immediate
    const start = Date.now();
    await wait("example.com"); // should wait ~1000ms (DEFAULT_DELAY)
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(800); // allow some tolerance
    expect(elapsed).toBeLessThan(1500);
  });

  it("different domains do not wait on each other", async () => {
    await wait("domain-a.com");
    const start = Date.now();
    await wait("domain-b.com"); // different domain, should be immediate
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it("uses domain-specific delay for known domains", async () => {
    await wait("www.bbb.org");
    const start = Date.now();
    await wait("www.bbb.org"); // should wait ~2500ms
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(2200);
    expect(elapsed).toBeLessThan(3000);
  });

  it("extracts domain from full URL", async () => {
    await wait("https://www.yelp.com/biz/something");
    const start = Date.now();
    await wait("https://www.yelp.com/biz/other"); // same domain
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(2700); // yelp = 3000ms
  });
});

describe("getStats", () => {
  it("returns empty stats when no calls made", () => {
    expect(getStats()).toEqual({});
  });

  it("tracks domains after calls", async () => {
    await wait("example.com");
    const stats = getStats();
    expect(stats["example.com"]).toBeDefined();
    expect(stats["example.com"].delay).toBe(1000);
    expect(stats["example.com"].lastCall).toBeDefined();
  });
});

describe("reset", () => {
  it("clears all tracking", async () => {
    await wait("example.com");
    reset();
    expect(getStats()).toEqual({});

    // After reset, should not wait
    const start = Date.now();
    await wait("example.com");
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);
  });
});
