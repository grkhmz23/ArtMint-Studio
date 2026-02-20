import { describe, it, expect } from "vitest";
import { getClientIp } from "../lib/rate-limit";

describe("rate-limit: getClientIp", () => {
  it("prefers x-real-ip over x-forwarded-for", () => {
    const req = new Request("http://localhost/api/test", {
      headers: { "x-real-ip": "10.0.0.1", "x-forwarded-for": "1.2.3.4" },
    });
    expect(getClientIp(req)).toBe("10.0.0.1");
  });

  it("falls back to x-forwarded-for when no x-real-ip", () => {
    const req = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("returns single IP from x-forwarded-for", () => {
    const req = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "10.0.0.1" },
    });
    expect(getClientIp(req)).toBe("10.0.0.1");
  });

  it('returns "unknown" when no IP headers present', () => {
    const req = new Request("http://localhost/api/test");
    expect(getClientIp(req)).toBe("unknown");
  });

  it("trims whitespace from x-real-ip", () => {
    const req = new Request("http://localhost/api/test", {
      headers: { "x-real-ip": "  9.8.7.6  " },
    });
    expect(getClientIp(req)).toBe("9.8.7.6");
  });
});
