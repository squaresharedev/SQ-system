// @squaresharedev/consent — the ONE consent brain for every SquareShare
// surface (homepage, SQ-app, store, admin). Framework-agnostic core: consent
// state in a single cookie scoped to .squareshare.eu, category gates, change
// events for live withdrawal, and the settings-open hook. The React banner
// binding lives in "@squaresharedev/consent/react"; other frameworks rebuild
// the banner from docs/CONSENT_INTEGRATION.md's replication spec on top of
// this core. Consent logic must never be duplicated outside this package.

export {
  CONSENT_CATEGORIES,
  NON_ESSENTIAL_CATEGORIES,
  CONSENT_COOKIE_NAME,
  CONSENT_PARENT_DOMAIN,
  CONSENT_COOKIE_MAX_AGE_DAYS,
  DEFAULT_POLICY_VERSION,
  type ConsentCategory,
  type NonEssentialCategory,
  type ConsentChoices,
  type ConsentMethod,
  type ConsentRecord,
  type ConsentChangeCallback,
  type OpenSettingsCallback,
} from "./types.js";

export {
  configureConsent,
  getConsentRecord,
  needsConsent,
  hasConsent,
  hasFunctionalConsent,
  hasAnalyticsConsent,
  hasPersonalizationConsent,
  acceptAll,
  rejectAll,
  saveConsent,
  onConsentChange,
  openConsentSettings,
  onOpenSettings,
  getGlobalPrivacyControl,
  __resetConsentCacheForTests,
} from "./store.js";

export { readConsentCookie, resolveCookieDomain } from "./cookie.js";
