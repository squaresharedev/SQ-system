<!--
  PORTABLE CONTENT for the homepage agent — mount at squareshare.eu/legal/cookie-policy.
  Source of truth for requirements: SQ-system/docs/cookie-compliance.md
  ("Cookie policy page — MUST contain" checklist).

  MAINTENANCE RULE: if a per-repo audit (see docs/CONSENT_INTEGRATION.md,
  "Per-repo verification checklist") finds any cookie/localStorage/tracker not
  listed in the table below, THIS TABLE MUST BE UPDATED — and if the tracker
  introduces a new processor or purpose, bump the consent policyVersion so
  everyone is re-prompted.

  ══════════ PLACEHOLDERS — every unverifiable real-world fact ══════════
  Resolve ALL of these before publishing. Do not invent values.
  1.  [PLACEHOLDER: legal entity name + legal form]  (the data controller)
  2.  [PLACEHOLDER: registered address]
  3.  [PLACEHOLDER: privacy contact email]
  4.  [PLACEHOLDER: DPO name/contact — or delete the DPO sentence if none appointed]
  5.  [PLACEHOLDER: effective date / last-updated date]
  6.  [PLACEHOLDER: Supabase auth/SSO cookie exact name(s) and lifetime as configured]
  7.  [PLACEHOLDER: Cloudflare cookie lifetimes other than __cf_bm (cf_clearance, __cflb, __cfruid)]
  8.  [PLACEHOLDER: PostHog cookie/localStorage key names + configured retention; confirm EU Cloud (Frankfurt) hosting]
  9.  [PLACEHOLDER: retention period for server-side behavioral events]
  10. [PLACEHOLDER: DPF self-certification status for Supabase, Stripe, PostHog — Cloudflare is DPF-certified per the compliance report; confirm the others in the DPAs]
  11. [PLACEHOLDER: Privacy Policy URL — assumed /legal/privacy-policy below]
  12. [PLACEHOLDER: consent-log retention period — report recommends 3-5 years]
  ═══════════════════════════════════════════════════════════════════════
-->

# Cookie Policy

**Version:** 1.0 · **Last updated:** [PLACEHOLDER: effective date / last-updated date]

This Cookie Policy explains how Square Share uses cookies and similar technologies across `squareshare.eu` and its subdomains (including the app, store, and admin surfaces). It supplements our [Privacy Policy]([PLACEHOLDER: Privacy Policy URL — assumed /legal/privacy-policy below]).

## 1. Who we are

The data controller is **[PLACEHOLDER: legal entity name + legal form]**, [PLACEHOLDER: registered address] ("Square Share", "we").
Contact: **[PLACEHOLDER: privacy contact email]**.
Data Protection Officer: [PLACEHOLDER: DPO name/contact — or delete the DPO sentence if none appointed].

## 2. What cookies and similar technologies are

**Cookies** are small text files a website stores on your device so it can recognize your browser — for example to keep you signed in. This policy covers cookies **and similar technologies**: browser `localStorage` and `sessionStorage`, pixels, and SDK identifiers. Where we say "cookies" below, we mean all of these.

Cookies can be **first-party** (set by us) or **third-party** (set by a service provider we use). They can be **session** cookies (deleted when you close the browser) or **persistent** (kept until they expire or you delete them).

## 3. How consent works on Square Share

When you first visit, a consent banner offers three equally prominent choices: **Accept all**, **Reject all**, and **Manage settings**. Nothing non-essential runs before you make an explicit choice. Your choice is stored in a single consent cookie scoped to `.squareshare.eu`, so it applies across all Square Share subdomains. The consent cookie itself is strictly necessary (it remembers your choice so we don't ask on every page) and stores: your per-category choices, the time of the choice, the policy version you saw, and how you chose.

You can change or withdraw your choice at any time — see [section 8](#8-withdrawing-or-changing-your-consent). Withdrawing is as easy as giving consent, and takes effect immediately.

We use four categories. **We have no advertising/marketing category: Square Share runs no advertising and does not sell personal data.**

| Category | Consent needed? | What it covers |
|---|---|---|
| Strictly necessary | No (always active, cannot be switched off) | Sign-in and session, cross-subdomain single sign-on, checkout fraud prevention, security and bot protection, and the consent cookie itself |
| Functional / preferences | Yes (off by default) | Remembering UI preferences you set, like theme or layout density |
| Analytics | Yes (off by default) | Understanding how Square Share is used so we can improve it |
| Personalization / behavioral | Yes (off by default) | Using device-side tracking to tailor what you see |

## 4. The cookies and similar technologies we use

<!-- Populated from the compliance report's classification table (rows a-g). -->

### Strictly necessary (no consent required — always disclosed)

| Name | Provider | Purpose | Duration | Party | Personal data involved |
|---|---|---|---|---|---|
| [PLACEHOLDER: Supabase auth/SSO cookie exact name(s) and lifetime as configured] (authentication cookie) | Supabase (first-party domain) | Keeps you signed in; carries your session across `.squareshare.eu` subdomains (single sign-on) | [PLACEHOLDER: lifetime as configured] | First-party | Session/user identifier |
| `sq_consent` | Square Share | Stores your cookie-consent choices, the policy version and timestamp, so the banner doesn't reappear | 12 months | First-party | Your consent choices (no tracking identifier) |
| `__stripe_sid` | Stripe | Fraud prevention during an active checkout you initiated | ~30 minutes | Third-party (Stripe) | Session identifier |
| `__stripe_mid` | Stripe | Fraud prevention across checkout sessions. Loaded **only on checkout/payment pages**, not site-wide | ~1 year | Third-party (Stripe) | Device identifier (fraud prevention only) |
| `__cf_bm` | Cloudflare | Bot detection and mitigation protecting the site | ~30 minutes | Third-party (Cloudflare) | Bot-scoring identifier |
| `cf_clearance`, `__cflb`, `__cfruid` | Cloudflare | Security challenges and load balancing | [PLACEHOLDER: Cloudflare cookie lifetimes other than __cf_bm] | Third-party (Cloudflare) | Security/routing identifiers |

### Functional / preferences (consent required)

| Name | Provider | Purpose | Duration | Party | Personal data involved |
|---|---|---|---|---|---|
| `localStorage` UI preferences (theme, layout density, notification settings) | Square Share | Remembers display settings you choose so the interface looks the way you left it | Until you delete them | First-party | Your preference values only — never used for tracking |

*Note: where a preference is stored only because you, as a signed-in user, explicitly changed a setting you requested, it may qualify as strictly necessary; we conservatively surface these under the Functional toggle.*

### Analytics (consent required)

| Name | Provider | Purpose | Duration | Party | Personal data involved |
|---|---|---|---|---|---|
| PostHog cookies + `localStorage` entries ([PLACEHOLDER: PostHog cookie/localStorage key names + configured retention]) | PostHog ([PLACEHOLDER: confirm EU Cloud (Frankfurt) hosting]) | Product analytics: which pages and features are used, so we can improve Square Share. Specific events, not vague "experience improvement": page views, feature usage, error rates | [PLACEHOLDER: configured retention] | Third-party (PostHog), first-party data | Pseudonymous distinct ID, usage events |

PostHog does not load and sets nothing on your device until you consent to Analytics. If you reject, no analytics identifier is stored on your device.

### Personalization / behavioral (consent required)

No device-side personalization trackers are currently in use. If we introduce any, this table and the consent banner will be updated first, and you will be re-prompted.

### Server-side activity records (not cookies — no device storage)

Separately from cookies, when you use Square Share while signed in, our servers record product interactions you perform (for example likes, follows, saves, purchases, and items viewed) **purely server-side**, tied to your account session — no cookie, script, or device identifier is used for this. Because nothing is stored on or read from your device for this purpose, it is not governed by cookie consent but by data-protection law directly: we rely on our **legitimate interest** in operating and improving a relevant marketplace, and you have the **right to object at any time** (Article 21 GDPR) — see the Privacy Policy's personalization section for the opt-out. Retention: [PLACEHOLDER: retention period for server-side behavioral events].

## 5. Service providers (processors)

| Processor | Role | Privacy policy |
|---|---|---|
| Supabase | Authentication and database hosting | <https://supabase.com/privacy> |
| Cloudflare | Security, bot protection, content delivery | <https://www.cloudflare.com/privacypolicy/> |
| Stripe | Payment processing and fraud prevention | <https://stripe.com/privacy> |
| PostHog | Product analytics (only with your consent) | <https://posthog.com/privacy> |

## 6. Legal bases

- **Strictly necessary** cookies: exempt from consent under Article 5(3) of the ePrivacy Directive (they are required to deliver services you explicitly request); any related personal-data processing rests on **contract performance** (Art. 6(1)(b) GDPR) or our **legitimate interest** in security (Art. 6(1)(f)).
- **Functional, Analytics, Personalization** cookies/storage: your **consent** (Art. 6(1)(a) GDPR and ePrivacy Art. 5(3)). We never use "legitimate interest" to place non-essential trackers.
- **Server-side behavioral records** (section 4, last part): **legitimate interest** (Art. 6(1)(f)), with your unconditional **right to object** under Art. 21 GDPR.

## 7. International transfers

Some providers may process personal data in the United States. Where that happens, transfers rely on the **EU-U.S. Data Privacy Framework (DPF)** for self-certified recipients and/or **Standard Contractual Clauses (SCCs)** as a fallback:

| Processor | Transfer mechanism |
|---|---|
| Cloudflare | DPF-certified; SCCs also in place |
| Supabase | [PLACEHOLDER: DPF self-certification status for Supabase — confirm in DPA] / SCCs |
| Stripe | [PLACEHOLDER: DPF self-certification status for Stripe — confirm in DPA] / SCCs |
| PostHog | EU-hosted ([PLACEHOLDER: confirm EU Cloud (Frankfurt) hosting]); [PLACEHOLDER: DPF status if any US processing] / SCCs |

## 8. Withdrawing or changing your consent

You can change or withdraw your consent at any time, as easily as you gave it:

- Click **"Cookie settings"** in the footer of any Square Share page — the same settings panel from the original banner opens.
- Withdrawal takes effect **immediately**: the affected trackers stop and no new ones are set.
- You can also delete cookies in your browser settings; the banner will then ask again on your next visit.

We re-ask for consent periodically (the consent cookie expires after 12 months) and whenever this policy materially changes (for example, a new provider or purpose).

## 9. Your rights

Under the GDPR you have the right of **access** (Art. 15), **rectification** (Art. 16), **erasure** (Art. 17), **restriction** (Art. 18), **data portability** (Art. 20), the right to **object** — including to legitimate-interest processing such as the server-side personalization records (Art. 21) — and rights regarding **automated decision-making** (Art. 22). Where processing rests on consent, you may withdraw it at any time without affecting prior processing.

To exercise any right, contact **[PLACEHOLDER: privacy contact email]**. You also have the right to lodge a complaint with your local **data protection authority** (in the EU/EEA, the supervisory authority of your member state).

## 10. Relationship to the Privacy Policy

This Cookie Policy is part of our transparency obligations and should be read together with the [Privacy Policy]([PLACEHOLDER: Privacy Policy URL]), which describes all of our processing, retention, and your rights in full. Consent records (your choices, timestamp, policy version, method) are also logged server-side as proof of consent and retained for [PLACEHOLDER: consent-log retention period — report recommends 3-5 years].

## 11. Residents of the United States (including California)

Square Share **does not sell personal information and does not share it for cross-context behavioral advertising** — we run no advertising. Consequently there is nothing to opt out of under the CCPA/CPRA "Do Not Sell or Share" right; we state this here for transparency. We **honor the Global Privacy Control (GPC)** browser signal. To exercise US privacy rights (access, deletion, correction), contact **[PLACEHOLDER: privacy contact email]**.

## 12. Changes to this policy

We update this policy when our cookie use changes. Material changes (new providers, new purposes) trigger a version bump and the consent banner will ask for your choice again. Each version is dated at the top.
