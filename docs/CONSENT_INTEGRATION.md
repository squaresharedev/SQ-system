# Integrating @squaresharedev/consent

Guide for per-repo agents (homepage, SQ-app, store, admin) wiring in the shared
consent package. **All consent logic lives in `@squaresharedev/consent` — never
copy or re-implement consent state, cookie handling, or gating in your repo.**
One consent choice, stored in one cookie scoped to `.squareshare.eu`, carries
across every subdomain.

Authoritative requirements: `SQ-system/docs/cookie-compliance.md`. Policy
content the homepage mounts: `SQ-system/docs/legal/cookie-policy.md` and
`SQ-system/docs/legal/privacy-cookie-section.md`.

---

## 1. Install

**Once the GitHub Packages token is fixed** (blocked as of 2026-07-20 — the
token lacks `read:packages`; Adrian is fixing it):

```sh
pnpm add @squaresharedev/consent
```

with the repo's `.npmrc` containing:

```ini
@squaresharedev:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

**Until then — junction fallback** (how SQ-app consumes the other
`@squaresharedev` packages today). From the consuming repo root (PowerShell):

```powershell
New-Item -ItemType Directory -Force node_modules\@squaresharedev | Out-Null
cmd /c mklink /J node_modules\@squaresharedev\consent C:\Squareshare\System\SQ-system\packages\consent
```

Also add `"@squaresharedev/consent": "^0.1.0"` to `package.json` dependencies
so the manifest is correct when the registry install becomes possible. The
junction target contains a built `dist/` on this machine; if it is missing or
types fail to resolve, run `pnpm build` inside `SQ-system/packages/consent`.

**Entry points:**

| Import | Contents |
|---|---|
| `@squaresharedev/consent` | Framework-agnostic core: state, cookie, gates, events |
| `@squaresharedev/consent/react` | `ConsentProvider`, `useConsent` (React banner binding) |
| `@squaresharedev/consent/styles.css` | Banner styles (requires `@squaresharedev/tokens/tokens.css` first) |

---

## 2. Mounting

### 2a. React path (store, admin — anything React that wants the prebuilt banner)

```tsx
// app root (client boundary)
import { ConsentProvider } from "@squaresharedev/consent/react";
import "@squaresharedev/tokens/tokens.css";   // in your CSS entry
import "@squaresharedev/consent/styles.css";  // AFTER tokens.css

<ConsentProvider
  policyVersion="1.0"                                     // = Cookie Policy version
  cookiePolicyHref="https://squareshare.eu/legal/cookie-policy"
  controllerName="Square Share"                           // pass legal entity once known
>
  <App />
</ConsentProvider>
```

The provider renders the banner automatically on first visit (and re-renders it
when `policyVersion` changes or the consent cookie expires). It renders nothing
during SSR and mounts after hydration — hydration-safe by construction.

### 2b. Core path (framework-agnostic — SQ-app / homepage if not using the React binding)

```ts
import {
  configureConsent, needsConsent, acceptAll, rejectAll, saveConsent,
  onOpenSettings, hasAnalyticsConsent, onConsentChange,
} from "@squaresharedev/consent";

configureConsent({ policyVersion: "1.0" }); // once, before any UI/gating

if (needsConsent()) showYourBanner();       // built per the spec in §3
onOpenSettings(() => showYourBanner("settings"));
// Your banner's buttons call acceptAll() / rejectAll() / saveConsent({...}).
```

### 2c. Footer link (every page, every repo — mandatory)

Withdrawal must be as easy as giving consent. Every footer includes:

```tsx
import { openConsentSettings } from "@squaresharedev/consent";
<button type="button" onClick={() => openConsentSettings()}>Cookie settings</button>
```

plus links to the Cookie Policy and Privacy Policy (see §7).

---

## 3. Banner replication spec (non-React surfaces build EXACTLY this)

The React binding (`packages/consent/src/react.tsx`) is the reference
implementation; `packages/consent/styles.css` styles these exact classes, so a
non-React banner that follows this spec and reuses the stylesheet is visually
identical.

### Layer 1 — choices

```
div.sq-consent                        (fixed bottom overlay region)
└─ div.sq-consent-panel               role="dialog" aria-modal="false"
                                      aria-labelledby="sq-consent-title"
                                      aria-describedby="sq-consent-desc"
   ├─ h2#sq-consent-title.sq-consent-title   tabindex="-1"  ← focused on open
   ├─ p#sq-consent-desc.sq-consent-text      1-2 sentence purpose + controller
   │  └─ a.sq-consent-link                   → Cookie Policy
   └─ div.sq-consent-actions
      ├─ button.sq-consent-action  "Accept all"      → core acceptAll()
      ├─ button.sq-consent-action  "Reject all"      → core rejectAll()
      └─ button.sq-consent-action  "Manage settings" → show layer 2
```

**Prominence rules (enforcement trigger #1 — non-negotiable):** all THREE
buttons wear the **same class** and therefore identical size, color, and
emphasis. Reject all is **one click on layer 1**. Never restyle Accept as
"primary" and Reject as quiet, never reorder Reject off the first layer, no
confirm-shaming, no contrast nudging, no cookie wall (the page behind stays
usable).

### Layer 2 — settings

```
   ├─ h2.sq-consent-title  (focused on layer change)
   ├─ p.sq-consent-text    (+ Cookie Policy link)
   ├─ ul.sq-consent-categories
   │  ├─ li.sq-consent-category               ← Strictly necessary FIRST
   │  │  ├─ div.sq-consent-category-info
   │  │  │  ├─ span.sq-consent-category-name (+ span.sq-consent-badge "Always on")
   │  │  │  └─ span.sq-consent-category-desc (plain-language description)
   │  │  └─ button.sq-consent-switch  role="switch" aria-checked="true" disabled
   │  │     └─ span.sq-consent-switch-knob aria-hidden="true"
   │  └─ li.sq-consent-category × 3           ← functional / analytics / personalization
   │     └─ button.sq-consent-switch  role="switch" aria-checked={state}
   └─ div.sq-consent-actions
      ├─ button.sq-consent-action  "Save settings"  → saveConsent(draft)
      └─ button.sq-consent-back    "Back"           (navigation, quiet is OK)
```

**Toggle rules:** first-ever prompt → all non-essential switches **OFF** (no
pre-ticked boxes). Re-opened via "Cookie settings" → switches show the user's
**stored** choices. Strictly Necessary is always-on and disabled. Unspecified
categories in `saveConsent()` default to **false**.

### Behavior rules

- **Dismissal is never consent.** Escape on layer 1: no-op (banner persists
  until an explicit button). Escape on layer 2: back to layer 1 if no valid
  choice exists yet, close otherwise. No "X" close button on layer 1.
- **Focus management:** on open and on every layer change, move focus to the
  layer title (`tabindex="-1"`). All controls keyboard-operable (native
  buttons); `:focus-visible` outlines come from the stylesheet.
- **SSR:** render nothing on the server; mount after hydration and check
  `needsConsent()`.

### Tokens used (via `@squaresharedev/tokens/tokens.css` — required companion)

Colors/typography: `--background`, `--foreground`, `--border`, `--muted`,
`--muted-foreground`, `--primary`, `--primary-foreground`, `--ring`.
Radii/shadows: `--radius` (buttons — sharp CTA brand rule), `--radius-sm/md/lg`,
`--radius-pill`, `--shadow-lg`. Spacing/sizing knobs: `--sq-consent-*`
(defaults declared at zero specificity in `consent/styles.css`; override in
your `:root` if needed). **No hardcoded colors anywhere.**

Default English strings (title, descriptions, button labels, category
descriptions) live in `packages/consent/src/react.tsx` (`defaultLabels`,
`DEFAULT_CATEGORY_LABELS`) — reuse them verbatim for consistency; override via
the `labels` prop / your own i18n layer only for translation.

---

## 4. Gating trackers (prior blocking + live withdrawal)

**Nothing non-essential may execute before an explicit choice.** Do not load
PostHog (or any client-side tracking script) unconditionally and gate events
later — gate the **initialization**:

```ts
import { hasAnalyticsConsent, onConsentChange } from "@squaresharedev/consent";

let posthogLoaded = false;

function startAnalyticsIfConsented() {
  if (posthogLoaded || !hasAnalyticsConsent()) return;
  posthog.init(POSTHOG_KEY, { api_host: "https://eu.i.posthog.com" /* EU Cloud */ });
  posthogLoaded = true;
}

startAnalyticsIfConsented(); // no-op pre-consent — nothing loads, nothing fires

onConsentChange((record, previous) => {
  // Grant → start now (same page, no reload needed).
  startAnalyticsIfConsented();

  // WITHDRAWAL → stop IMMEDIATELY (the SHEIN €150M failure was continuing
  // to read/write after "Reject"). Same-tick, not next page load.
  if (previous?.choices.analytics && !record.choices.analytics) {
    posthog.opt_out_capturing();          // stop sending
    posthog.reset();                      // drop the distinct ID
    // Belt-and-braces: also clear PostHog cookies/localStorage keys.
  }
});
```

Apply the same pattern to ANY client-side behavioral/personalization tech under
`hasPersonalizationConsent()`, and to functional storage under
`hasFunctionalConsent()`. The gates are deny-by-default: unset cookie, stale
policy version, malformed cookie, and SSR all return `false`.

---

## 5. SQ-app specifics

- **Replace the deny-stub:** SQ-app currently has a local `hasAnalyticsConsent()`
  stub that always returns false. Delete it and import the real function from
  `@squaresharedev/consent`. No other consent logic may remain in-repo.
- **Leave the server-side behavioral pipeline as-is.** The server-side event
  recording (likes/follows/saves/views tied to the authenticated session, no
  device identifier) is deliberately outside ePrivacy consent — it is governed
  by GDPR lawful basis (documented legitimate interest + Art. 21 objection),
  NOT by this cookie gate. Do not wire it to `hasConsent()`.
- **Personalization opt-out surface:** the user-facing opt-out for
  personalization lives under the **Personalization** category in the consent
  settings — read it via `hasPersonalizationConsent()` for any *client-side*
  personalization, and surface the Art. 21 objection for the server-side feed
  in account settings per the Privacy Policy.

---

## 6. Consent logging (proof)

Each repo persists every consent event to its own endpoint (server-side,
immutable, retained ~3-5 years). The cookie alone is not proof.

```ts
import { onConsentChange, getGlobalPrivacyControl } from "@squaresharedev/consent";

onConsentChange((record) => {
  void fetch("/api/consent-log", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...record,          // { choices, timestamp, policyVersion, method }
      gpc: getGlobalPrivacyControl(),
      // plus YOUR user/session identifier server-side (from the auth session;
      // the consent package never mints a device ID)
    }),
    keepalive: true,
  });
});
```

Record shape (from the package):

```ts
interface ConsentRecord {
  choices: { necessary: true; functional: boolean; analytics: boolean; personalization: boolean };
  timestamp: string;      // ISO-8601
  policyVersion: string;  // Cookie Policy version consented to
  method: "accept_all" | "reject_all" | "custom";
}
```

---

## 7. Policy links

- The Cookie Policy and Privacy Policy live on the **homepage domain**:
  `squareshare.eu/legal/cookie-policy` and the privacy policy page. The
  homepage agent mounts the content from `SQ-system/docs/legal/`.
- **Every repo's footer** links both policies AND renders the
  "Cookie settings" control (§2c). The banner's policy link points at the
  homepage URL (absolute, since it is cross-subdomain).
- `policyVersion` passed to the package must equal the version at the top of
  the mounted Cookie Policy. When the policy materially changes, bump both
  together — the bump re-prompts every user.

---

## 8. Per-repo verification checklist ("nothing is missing" audit)

Before shipping, the consuming agent must complete and report this audit:

- [ ] **Enumerate** every cookie, `localStorage`/`sessionStorage` key, script,
      pixel, SDK, and data-collection point in this repo (search for
      `document.cookie`, `localStorage`, `sessionStorage`, `posthog`, script
      tags, third-party SDK init calls; then load each page with DevTools →
      Application and record everything that appears).
- [ ] **Map** each item to a category: strictly necessary / functional /
      analytics / personalization — using the classification table in
      `docs/cookie-compliance.md`. Do not guess: anything unclear goes to
      Adrian.
- [ ] **Confirm** each item appears in `docs/legal/cookie-policy.md`'s table
      (name, provider, purpose, duration, party, personal data).
- [ ] **Report any tracker NOT in the report's map back to Adrian before
      shipping** — the policy table must be updated (and `policyVersion`
      bumped if it adds a processor/purpose) first.
- [ ] **Verify prior blocking**: with a fresh profile and no choice made,
      DevTools shows NO non-essential cookie/storage/network call.
- [ ] **Verify live withdrawal**: accept all → withdraw via footer link →
      confirm tracking requests stop in the same page session.
- [ ] **Verify the cross-subdomain choice**: consent given on one subdomain is
      honored on the others (one `sq_consent` cookie on `.squareshare.eu`).
- [ ] **Verify equal prominence**: Accept all / Reject all / Manage settings
      are visually identical on layer 1; toggles default off; Escape does not
      consent.
- [ ] Stripe: `stripe.js` loads **only on checkout/payment pages**, not
      site-wide (keeps `__stripe_mid` defensible as strictly necessary).
