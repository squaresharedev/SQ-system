import { afterEach, describe, expect, it, vi } from "vitest";
import type { CookieOptions } from "@supabase/ssr";

// AUTH_COOKIE_OPTIONS is computed from process.env at module load, so each
// case needs a fresh module instance under a stubbed environment.
async function loadOptions(env: {
  NODE_ENV?: string;
  NEXT_PUBLIC_COOKIE_DOMAIN?: string;
}): Promise<CookieOptions> {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", env.NODE_ENV as never);
  vi.stubEnv("NEXT_PUBLIC_COOKIE_DOMAIN", env.NEXT_PUBLIC_COOKIE_DOMAIN as never);
  const mod = await import("../src/cookie-options.js");
  return mod.AUTH_COOKIE_OPTIONS;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("AUTH_COOKIE_OPTIONS", () => {
  it("is a Secure, HttpOnly, Lax parent-domain cookie in production", async () => {
    const options = await loadOptions({ NODE_ENV: "production" });
    expect(options).toMatchObject({
      domain: ".squareshare.eu",
      path: "/",
      sameSite: "lax",
      secure: true,
      httpOnly: true,
    });
  });

  it("is host-only and non-Secure in local dev so http://localhost works", async () => {
    const options = await loadOptions({ NODE_ENV: "development" });
    expect(options.domain).toBeUndefined();
    expect(options.secure).toBe(false);
    // The protections that do not depend on transport still hold.
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
  });

  // ── Regression: the MEDIUM audit finding ──────────────────────────────
  // `secure` was `isProd` alone, while the domain override was independent —
  // so this exact combination shipped a parent-domain session cookie with no
  // Secure attribute, readable off any plaintext request to any subdomain.
  it("forces Secure when a cookie Domain is set without a production NODE_ENV", async () => {
    const options = await loadOptions({
      NODE_ENV: "development",
      NEXT_PUBLIC_COOKIE_DOMAIN: ".preview.squareshare.eu",
    });
    expect(options.domain).toBe(".preview.squareshare.eu");
    expect(options.secure).toBe(true);
  });

  it("honours the domain override in production too", async () => {
    const options = await loadOptions({
      NODE_ENV: "production",
      NEXT_PUBLIC_COOKIE_DOMAIN: ".squareshare.test",
    });
    expect(options.domain).toBe(".squareshare.test");
    expect(options.secure).toBe(true);
  });

  // The invariant itself, stated once: a cookie that travels across
  // subdomains must never travel in the clear.
  it.each([
    { NODE_ENV: "production" },
    { NODE_ENV: "development" },
    { NODE_ENV: "test" },
    { NODE_ENV: "development", NEXT_PUBLIC_COOKIE_DOMAIN: ".squareshare.eu" },
    { NODE_ENV: "production", NEXT_PUBLIC_COOKIE_DOMAIN: ".squareshare.eu" },
    { NODE_ENV: undefined, NEXT_PUBLIC_COOKIE_DOMAIN: ".squareshare.eu" },
  ])("Domain implies Secure (%o)", async (env) => {
    const options = await loadOptions(env);
    if (options.domain) expect(options.secure).toBe(true);
  });

  it("never drops HttpOnly, whatever the environment", async () => {
    for (const env of [
      { NODE_ENV: "production" },
      { NODE_ENV: "development" },
      { NODE_ENV: undefined },
    ]) {
      const options = await loadOptions(env);
      expect(options.httpOnly).toBe(true);
      expect(options.sameSite).toBe("lax");
      expect(options.path).toBe("/");
    }
  });
});
