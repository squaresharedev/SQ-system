import {
  CONSENT_COOKIE_MAX_AGE_DAYS,
  CONSENT_COOKIE_NAME,
  CONSENT_PARENT_DOMAIN,
  NON_ESSENTIAL_CATEGORIES,
  type ConsentRecord,
} from "./types.js";

// The single consent cookie: Domain=.squareshare.eu in production (same
// scope as the SSO session, so one choice covers every subdomain), host-only
// on localhost/previews. NOT HttpOnly by necessity — the consent UI runs in
// the browser and must read/write it. SameSite=Lax; Secure on https.
//
// Every read validates the payload shape: a garbage or truncated cookie
// parses to null, which the store treats as "no consent" (deny by default).

const isBrowser = () => typeof document !== "undefined";

/** Derive the cookie Domain attribute from the current hostname: the shared
 *  parent domain on squareshare.eu and its subdomains, host-only elsewhere
 *  (localhost, *.pages.dev previews, etc.). Overridable via configureConsent. */
export function resolveCookieDomain(hostname: string): string | undefined {
  const parent = CONSENT_PARENT_DOMAIN.slice(1); // "squareshare.eu"
  if (hostname === parent || hostname.endsWith(CONSENT_PARENT_DOMAIN)) {
    return CONSENT_PARENT_DOMAIN;
  }
  return undefined;
}

function isValidRecord(value: unknown): value is ConsentRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Partial<ConsentRecord>;
  if (typeof record.timestamp !== "string") return false;
  if (typeof record.policyVersion !== "string") return false;
  if (
    record.method !== "accept_all" &&
    record.method !== "reject_all" &&
    record.method !== "custom"
  ) {
    return false;
  }
  const choices = record.choices as Record<string, unknown> | undefined;
  if (typeof choices !== "object" || choices === null) return false;
  if (choices.necessary !== true) return false;
  for (const category of NON_ESSENTIAL_CATEGORIES) {
    if (typeof choices[category] !== "boolean") return false;
  }
  return true;
}

/** Read + validate the consent cookie. Null when absent, malformed, or SSR. */
export function readConsentCookie(): ConsentRecord | null {
  if (!isBrowser()) return null;
  const prefix = `${CONSENT_COOKIE_NAME}=`;
  for (const part of document.cookie.split("; ")) {
    if (!part.startsWith(prefix)) continue;
    try {
      const parsed: unknown = JSON.parse(
        decodeURIComponent(part.slice(prefix.length)),
      );
      return isValidRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Write the consent record. `domainOverride`: undefined = auto-resolve from
 *  location.hostname; null = force host-only; string = use as given. */
export function writeConsentCookie(
  record: ConsentRecord,
  domainOverride?: string | null,
): void {
  if (!isBrowser()) return;
  const domain =
    domainOverride === undefined
      ? resolveCookieDomain(location.hostname)
      : domainOverride ?? undefined;
  const maxAge = CONSENT_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
  const attributes = [
    `${CONSENT_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(record))}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "SameSite=Lax",
  ];
  if (domain) attributes.push(`Domain=${domain}`);
  if (location.protocol === "https:") attributes.push("Secure");
  document.cookie = attributes.join("; ");
}
