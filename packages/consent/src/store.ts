import {
  DEFAULT_POLICY_VERSION,
  NON_ESSENTIAL_CATEGORIES,
  type ConsentCategory,
  type ConsentChangeCallback,
  type ConsentChoices,
  type ConsentMethod,
  type ConsentRecord,
  type OpenSettingsCallback,
} from "./types.js";
import { readConsentCookie, writeConsentCookie } from "./cookie.js";

// The consent brain — framework-agnostic, zero dependencies, SSR-safe.
// One module-level store per page: state lives in the consent cookie
// (Domain=.squareshare.eu) with an in-memory mirror; every mutation writes
// the cookie, updates the mirror, and fires change listeners SYNCHRONOUSLY
// so hosts can stop tracking the instant consent is withdrawn.
//
// Deny-by-default everywhere: no record, a stale policyVersion, a malformed
// cookie, or a server render all mean "no consent" for every non-essential
// category. Nothing non-essential may run before an explicit choice.

interface ConsentConfig {
  /** The CURRENT Cookie Policy / banner version. Stored records with any
   *  other version are treated as no consent (re-prompt). */
  policyVersion: string;
  /** Cookie Domain override: undefined = auto (.squareshare.eu on the
   *  production apex/subdomains, host-only elsewhere); null = force
   *  host-only; string = exact value. */
  cookieDomain?: string | null;
}

const config: ConsentConfig = { policyVersion: DEFAULT_POLICY_VERSION };

/** Set the current policy version (and optionally the cookie domain) once,
 *  before the banner mounts. Bump policyVersion whenever the Cookie Policy
 *  materially changes (new processor/purpose) — this re-prompts everyone. */
export function configureConsent(options: Partial<ConsentConfig>): void {
  if (options.policyVersion !== undefined) {
    config.policyVersion = options.policyVersion;
  }
  if ("cookieDomain" in options) {
    config.cookieDomain = options.cookieDomain;
  }
}

// In-memory mirror of the cookie. `undefined` = not read yet this page.
let cached: ConsentRecord | null | undefined;

const changeListeners = new Set<ConsentChangeCallback>();
const openSettingsListeners = new Set<OpenSettingsCallback>();

function currentRecord(): ConsentRecord | null {
  if (cached === undefined) cached = readConsentCookie();
  return cached;
}

/** The stored record, or null when absent/invalid/stale-version/SSR.
 *  A null here means the banner must be shown and every non-essential
 *  category is OFF. */
export function getConsentRecord(): ConsentRecord | null {
  const record = currentRecord();
  if (record === null) return null;
  return record.policyVersion === config.policyVersion ? record : null;
}

/** True when an explicit, current-version choice has not been made yet —
 *  i.e. the banner must be shown. Always false during SSR (the banner
 *  mounts client-side; the server must not guess). */
export function needsConsent(): boolean {
  if (typeof document === "undefined") return false;
  return getConsentRecord() === null;
}

/** Whether the given category is consented. `necessary` is always true;
 *  everything else is false until an explicit, current-version choice. */
export function hasConsent(category: ConsentCategory): boolean {
  if (category === "necessary") return true;
  const record = getConsentRecord();
  return record !== null && record.choices[category] === true;
}

export function hasFunctionalConsent(): boolean {
  return hasConsent("functional");
}

export function hasAnalyticsConsent(): boolean {
  return hasConsent("analytics");
}

export function hasPersonalizationConsent(): boolean {
  return hasConsent("personalization");
}

function commit(
  choices: Omit<ConsentChoices, "necessary">,
  method: ConsentMethod,
): ConsentRecord {
  const previous = getConsentRecord();
  const record: ConsentRecord = {
    choices: { necessary: true, ...choices },
    timestamp: new Date().toISOString(),
    policyVersion: config.policyVersion,
    method,
  };
  writeConsentCookie(record, config.cookieDomain);
  cached = record;
  // Synchronous notification: a withdrawal must stop tracking NOW, in this
  // task, not on the next page load (the SHEIN failure). Listener errors
  // must not prevent other listeners from stopping their trackers.
  for (const listener of changeListeners) {
    try {
      listener(record, previous);
    } catch (error) {
      console.error("[consent] onConsentChange listener failed:", error);
    }
  }
  return record;
}

/** One-click "Accept all": every category on. */
export function acceptAll(): ConsentRecord {
  return commit(
    { functional: true, analytics: true, personalization: true },
    "accept_all",
  );
}

/** One-click "Reject all": every non-essential category off. Must be exactly
 *  as reachable and prominent as acceptAll in any UI. */
export function rejectAll(): ConsentRecord {
  return commit(
    { functional: false, analytics: false, personalization: false },
    "reject_all",
  );
}

/** Save a granular choice from the settings layer. Unspecified categories
 *  default to FALSE (never to the previous value silently — the settings UI
 *  passes the full, explicit set it displayed). */
export function saveConsent(
  choices: Partial<Record<(typeof NON_ESSENTIAL_CATEGORIES)[number], boolean>>,
): ConsentRecord {
  return commit(
    {
      functional: choices.functional === true,
      analytics: choices.analytics === true,
      personalization: choices.personalization === true,
    },
    "custom",
  );
}

/** Subscribe to consent changes (grants AND withdrawals). Returns an
 *  unsubscribe function. Fired synchronously with (record, previous). */
export function onConsentChange(callback: ConsentChangeCallback): () => void {
  changeListeners.add(callback);
  return () => changeListeners.delete(callback);
}

/** Ask the mounted banner UI to open its settings layer — wire this to the
 *  persistent footer "Cookie settings" link so withdrawing consent is as
 *  easy as giving it. Safe to call anywhere; no-ops if no UI is mounted. */
export function openConsentSettings(): void {
  for (const listener of openSettingsListeners) {
    try {
      listener();
    } catch (error) {
      console.error("[consent] openConsentSettings listener failed:", error);
    }
  }
}

/** For banner implementations: be notified when openConsentSettings() is
 *  called. Returns an unsubscribe function. */
export function onOpenSettings(callback: OpenSettingsCallback): () => void {
  openSettingsListeners.add(callback);
  return () => openSettingsListeners.delete(callback);
}

/** Whether the browser is sending the Global Privacy Control signal.
 *  Square Share does not sell or share personal information, so there is
 *  nothing to opt the user out of — but hosts may record the signal in
 *  their consent logs (defensive, per the compliance report). */
export function getGlobalPrivacyControl(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    (navigator as Navigator & { globalPrivacyControl?: boolean })
      .globalPrivacyControl === true
  );
}

/** Test-only: drop the in-memory mirror so the next read hits the cookie. */
export function __resetConsentCacheForTests(): void {
  cached = undefined;
}
