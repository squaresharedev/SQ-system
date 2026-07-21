// The consent domain model, per docs/cookie-compliance.md (the authoritative
// EU+USA report). Four categories — Strictly Necessary (always on, locked),
// Functional/Preferences, Analytics, Personalization/Behavioral. Deliberately
// NO advertising/marketing category: Square Share runs no ads and sells/shares
// no data; adding ads later means adding a category AND re-prompting.

export const CONSENT_CATEGORIES = [
  "necessary",
  "functional",
  "analytics",
  "personalization",
] as const;
export type ConsentCategory = (typeof CONSENT_CATEGORIES)[number];

/** The toggleable categories (everything except strictly necessary). */
export const NON_ESSENTIAL_CATEGORIES = [
  "functional",
  "analytics",
  "personalization",
] as const;
export type NonEssentialCategory = (typeof NON_ESSENTIAL_CATEGORIES)[number];

/** Per-category choices. `necessary` is structurally always true — it cannot
 *  be declined (and the type makes storing a refusal impossible). */
export type ConsentChoices = {
  necessary: true;
  functional: boolean;
  analytics: boolean;
  personalization: boolean;
};

/** How the record was collected — part of the consent-proof record the
 *  report requires hosts to persist server-side. */
export type ConsentMethod = "accept_all" | "reject_all" | "custom";

/**
 * The consent record: what lives in the consent cookie AND what hosts log
 * server-side as proof (report: user/device id + timestamp + choices +
 * policy/banner version + method; hosts add their own user/device id when
 * persisting — this package never mints a device identifier).
 */
export interface ConsentRecord {
  choices: ConsentChoices;
  /** ISO-8601 instant the choice was made. */
  timestamp: string;
  /** The Cookie Policy / banner version the user consented to. A stored
   *  record with a DIFFERENT version than the current one is treated as
   *  no consent (the banner re-prompts). */
  policyVersion: string;
  method: ConsentMethod;
}

/** Fired synchronously on every consent change — including WITHDRAWAL.
 *  `previous` is null for a first-ever choice. Hosts MUST use this to stop
 *  tracking immediately when a category flips to false (live withdrawal —
 *  the exact failure SHEIN was fined €150M for), not on next page load. */
export type ConsentChangeCallback = (
  record: ConsentRecord,
  previous: ConsentRecord | null,
) => void;

/** Fired when something calls openConsentSettings() — the mounted banner UI
 *  (React binding or a host-built one) listens and opens its settings layer. */
export type OpenSettingsCallback = () => void;

// ── Constants (exported — nothing configurable is hardcoded at call sites) ──

/** Name of the consent cookie. The consent cookie itself is strictly
 *  necessary / consent-exempt (it stores the choice so the banner doesn't
 *  reappear) but MUST be disclosed in the Cookie Policy. */
export const CONSENT_COOKIE_NAME = "sq_consent";

/** Parent domain the consent choice is scoped to — the same scope as the
 *  SSO session cookie, so one choice carries across every subdomain. */
export const CONSENT_PARENT_DOMAIN = ".squareshare.eu";

/** Consent cookie lifetime: 12 months. Within CNIL's 13-month outer bound;
 *  expiry doubles as the re-prompt cadence (report: re-collect at ~6-12
 *  months, and immediately on any new processor/purpose via a policyVersion
 *  bump). */
export const CONSENT_COOKIE_MAX_AGE_DAYS = 365;

/** Default policy/banner version. Hosts pass the CURRENT version via
 *  configureConsent() whenever the Cookie Policy materially changes —
 *  bumping it invalidates stored consent and re-prompts everyone. */
export const DEFAULT_POLICY_VERSION = "1.0";
