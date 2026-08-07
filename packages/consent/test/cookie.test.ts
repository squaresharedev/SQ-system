import { describe, expect, it } from "vitest";
import { resolveCookieDomain } from "../src/cookie.js";
import { CONSENT_PARENT_DOMAIN } from "../src/types.js";

// The consent cookie is scoped to the same parent domain as the SSO session,
// so the hostname check that decides that scope is security-relevant: getting
// it wrong hands an attacker-controlled lookalike domain a cookie meant for
// squareshare.eu. These lock the current (correct) behaviour in place.
describe("resolveCookieDomain", () => {
  it("uses the shared parent domain on the apex and its subdomains", () => {
    expect(resolveCookieDomain("squareshare.eu")).toBe(CONSENT_PARENT_DOMAIN);
    expect(resolveCookieDomain("store.squareshare.eu")).toBe(CONSENT_PARENT_DOMAIN);
    expect(resolveCookieDomain("dashboard.squareshare.eu")).toBe(CONSENT_PARENT_DOMAIN);
    expect(resolveCookieDomain("a.b.squareshare.eu")).toBe(CONSENT_PARENT_DOMAIN);
  });

  // Suffix confusion: "evilsquareshare.eu" ENDS WITH "squareshare.eu". Only
  // the leading dot in the comparison keeps it out.
  it.each([
    "evilsquareshare.eu",
    "notsquareshare.eu",
    "squareshare.eu.evil.example",
    "squareshare.example",
  ])("stays host-only on the lookalike %s", (hostname) => {
    expect(resolveCookieDomain(hostname)).toBeUndefined();
  });

  it("stays host-only in dev and on preview hosts", () => {
    expect(resolveCookieDomain("localhost")).toBeUndefined();
    expect(resolveCookieDomain("127.0.0.1")).toBeUndefined();
    expect(resolveCookieDomain("sq-store.pages.dev")).toBeUndefined();
  });
});
