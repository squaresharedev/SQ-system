# Bulletproof Cookie Compliance for Square Share (squareshare.eu): EU + USA Report

## TL;DR
- **EU law is your binding constraint; build one strict opt-in banner and apply it globally.** Under the ePrivacy Directive Art. 5(3) + GDPR, you must block all non-essential storage/tracking (PostHog, any client-side behavioral tags) until the user gives prior, granular, freely-given consent, with a "Reject all" button as prominent as "Accept all" on the first layer. Strictly necessary items (Supabase auth/SSO, Stripe checkout/fraud session, Cloudflare security, the consent cookie itself) are exempt from consent but must still be disclosed.
- **You almost certainly fall under zero US state-law thresholds today, and since you run no ads/no data sale, your CCPA "sale/share" exposure is minimal** — but honoring the Global Privacy Control (GPC) browser signal and publishing a privacy policy are cheap insurance. Serving the stricter EU behavior worldwide is the recommended, simplest posture.
- **Your future recommendation feed is the main legal design decision.** Purely server-side event logging (no device read/write) is governed by GDPR lawful basis only, not ePrivacy consent; personalization generally cannot rely on "contract necessity" and should run on documented legitimate interest with an easy opt-out — or consent if it becomes extensive.

## Key Findings

### 1. The governing law and the "bright line"
Cookies and "similar technologies" are governed by **Article 5(3) of the ePrivacy Directive (2002/58/EC, as amended 2009/136/EC)**, transposed into each member state's national law (e.g., Article 82 of the French Data Protection Act). The GDPR governs the downstream processing of any personal data collected. The ePrivacy Directive is *lex specialis*: where it requires consent, you **cannot** substitute GDPR "legitimate interest" for the act of storing/reading on the device. This was reaffirmed by the EDPB Cookie Banner Taskforce (Jan 2023) and is the single most important rule.

The consent standard comes from GDPR Art. 4(11) and Art. 7 and EDPB Guidelines 05/2020: consent must be **freely given, specific, informed, unambiguous**, by clear affirmative action, **granular per purpose**, obtained **before** setting non-essential trackers, with **no pre-ticked boxes** and **no dark patterns**.

### 2. EDPB Cookie Banner Taskforce (adopted 17/18 January 2023) — the enforcement baseline
The Taskforce was coordinated by the **CNIL and the Austrian DPA**, bringing together 18 EEA authorities to coordinate the response to **700+ complaints filed by noyb between May 2021 and August 2022**. Its conclusions:
- Per para. 8 of the report, **"the vast majority of authorities considered the absence of refuse/reject/not consent option on any layer to be outside the requirements for valid consent."** Best practice: a "Reject all" button on the first layer, one click, equal prominence.
- **No pre-ticked boxes**, including on the second layer.
- **Legitimate interest cannot be used** to place non-essential cookies — only consent.
- **Deceptive button contrasts / dark patterns** are assessed case-by-case but manifestly misleading designs invalidate consent.
- **Misclassifying non-essential cookies as "strictly necessary"** is prohibited.
- Consent withdrawal must be **as easy as giving it** (e.g., a persistent hovering icon or standardized link).

### 3. What is "strictly necessary" (consent-exempt) vs. what needs opt-in consent
Under Art. 5(3), a tracker is exempt only if it is (Criterion A) solely for carrying out transmission, or (Criterion B) strictly necessary to provide a service *explicitly requested* by the user (WP29 Opinion 04/2012 remains the reference).
- **Exempt (no consent, but must be disclosed):** authentication/session cookies, shopping-cart cookies, CSRF/security tokens, load balancing, and the **consent-preference cookie itself** (otherwise the banner would reappear every page load).
- **Requires prior opt-in consent:** analytics (PostHog by default), personalization/behavioral tracking, A/B testing, social plug-ins, any advertising (N/A here).

### 4. The France/analytics-exemption nuance (does not rescue PostHog by default)
The EDPB has recognized since WP29 (2012), and reaffirmed in 2023, that **first-party, aggregate-only audience measurement** *can* be exempted by some member states. **France's CNIL** operates the template exemption (Article 82; Deliberation No. 2020-092): analytics may be consent-exempt only if strictly first-party, producing anonymous statistics only, no cross-site tracking, no data reuse by the vendor, limited retention (≤13 months recommended), etc. As of **1 January 2026**, CNIL replaced its evaluation program with a **self-assessment tool** (updated guidance published July 2025). Similar narrow exemptions exist in Italy, Spain, and the Netherlands. **Critically: the UK ICO does NOT exempt analytics** (consent required under PECR), and **Germany (TDDDG, formerly TTDSG) does not offer a general analytics exemption** — consent is required. Because your primary market is the whole EU (not just France) and PostHog's default configuration uses cookies/localStorage and a distinct ID, **you should treat PostHog as consent-required across the EU** and rely on the exemption only if you run PostHog in cookieless/aggregate mode (see §Implementation).

### 5. Enforcement actions (what actually triggers fines)
- **CNIL v. Google (€100M, Dec 2020)** and **Amazon (€35M, Dec 2020):** advertising cookies dropped **before consent**, inadequate information, defective opt-out. CNIL asserted jurisdiction directly under ePrivacy (the GDPR one-stop-shop does **not** apply to cookies).
- **CNIL v. Google/Facebook (€150M/€60M, 2021/2022):** no reject button as easy as accept (5 clicks to refuse).
- **CNIL v. Google €325M and SHEIN €150M (1 September 2025):** the largest cookie fines to date. Per CNIL's official decisions, Google's €325M splits as **€200 million against Google LLC and €125 million against Google Ireland Limited**, with an order to comply **within six months or pay €100,000 per day of delay**. Google's breach related to **Gmail inbox ads styled as emails without consent — affecting 74 million Gmail accounts, of which 53 million users had ad emails displayed** (CNIL relied on the CJEU *StWL v eprimo* ruling of 25 November 2021 that inbox ads styled as emails constitute direct marketing), plus a biased account-creation consent flow (six clicks to refuse vs. two to accept). SHEIN's failures (decision SAN-2025-005) are a textbook checklist of what to avoid: advertising cookies placed **on arrival before any banner interaction**; banners lacking information about **advertising purposes** and **third-party identities** (including at the second layer); and — most damning — per the decision, **"when a user…clicked on the 'Refuse all' button…or when they decided to withdraw their consent…new cookies were still placed and others, already present, continued to be read."** The aggravating scale factor was **an average of 12 million people in France visiting shein.com each month**.
- **CNIL v. American Express (€1.5M, Nov 2025)** and continued 2025-2026 enforcement show the **simplified procedure** now reaches SMEs; risk applies to **any site accessible from France regardless of company size or location**. (Note: the Google + SHEIN decisions of 1 Sept 2025 alone account for the widely cited ~€475M combined figure.) Article 82 penalties can reach **2% of worldwide turnover or €10M**, whichever is higher.

The recurring triggers: (1) firing non-essential trackers before consent, (2) no equal-prominence reject, (3) inadequate/vague information, (4) reject/withdraw that does not technically stop the tracking.

### 6. USA: CCPA/CPRA and the state patchwork
- **The US model is opt-out, not opt-in.** California's CCPA (as amended by CPRA) gives consumers the right to opt out of the **"sale"** or **"sharing"** (the latter defined as disclosure for **cross-context behavioral advertising**) of personal information. Cookie-based behavioral **advertising** is the main trigger — which **Square Share does not do**.
- **Because you run no ad networks and sell no data, your "Do Not Sell or Share" exposure is minimal.** If you never sell/share, the "Do Not Sell or Share My Personal Information" / "Your Privacy Choices" link is not strictly triggered — but a privacy policy disclosing this (and stating you do not sell/share) is required, and adding the link/GPC honoring is low-cost defensive practice.
- **Global Privacy Control (GPC):** California, Colorado, Connecticut, Texas, Oregon and others require covered businesses to honor the GPC browser signal as a valid opt-out of sale/sharing. Since you don't sell/share, there is little to "stop," but detecting GPC and recording it is best practice and future-proofs you if you ever add advertising.
- **State-law thresholds — you almost certainly fall under none today.** Most state laws (Virginia VCDPA, Colorado CPA, Connecticut CTDPA, Utah, and the 2026 additions Indiana/Kentucky/Rhode Island) apply only above thresholds: commonly **100,000 consumers/year** (or 25,000 + 50% revenue from data sales); California adds a **$25M revenue** pathway. **Rhode Island (35,000) and the Connecticut 2026 amendment (35,000)** are lower. **Texas and Nebraska have no numeric threshold** — they apply to any non-"small business" (per the federal SBA definition) doing business in-state or targeting residents. As a small EU startup, you are very likely exempt from all of these, with Texas the one to monitor as you grow. Colorado's CPA also requires honoring a **Universal Opt-Out Mechanism** (GPC designated).
- **Recommendation: serve the stricter EU behavior globally.** A GDPR-grade opt-in banner over-satisfies US opt-out obligations. You do not need a separate US banner behavior; a single privacy policy with a short US/California-specific section suffices.

### 7. Your stack: server-side behavioral tracking, ePrivacy, and lawful basis (the key design question)
This is the area with the most nuance, sourced to primary EDPB/CJEU material via EDPB Guidelines 2/2023 (Technical Scope of Art. 5(3), final v2.0 adopted 7 October 2024) and CJEU case law:

- **The ePrivacy trigger is about the *device*, not the server.** Art. 5(3) applies when an entity **stores** information on, or **gains access to** information already stored in, the terminal equipment. Per EDPB Guidelines 2/2023 para. 32, "gaining access" **"usually entails the accessing entity to proactively send specific instructions to the terminal equipment in order to receive back the targeted information"** (as cookies/JS/SDKs do). Per **para. 44**, using information that **"does not leave the device"** is out of scope, but **"when this information or any derivation of this information is accessed, Article 5(3) ePD would apply."**
- **Consequence for Square Share's planned behavioral events (impressions, clicks, dwell, likes, follows, saves, purchases):** If these are recorded **purely server-side** — from your application logic / HTTP requests that the authenticated browser sends anyway, **without setting or reading any cookie/localStorage identifier for the tracking purpose and without a client-side tag** — then **Art. 5(3) consent is NOT triggered**; the activity is governed **only by GDPR lawful basis**. This is a defensible and deliberate architecture choice. **The moment you use a client-side script, tracking pixel, localStorage read, or a device-stored tracking ID to capture these events, Art. 5(3) consent applies.** (Caveat: the EDPB's "instructing the sending" reading, paras. 34/42, is broad; keep the pipeline strictly server-side and tie events to the existing authenticated session rather than any new device identifier.)
- **Lawful basis for the recommendation feed (GDPR Art. 6):**
  - **Contract necessity, Art. 6(1)(b): generally NOT available.** Per **CJEU C-252/21 Meta v Bundeskartellamt (4 July 2023), para. 102**, personalized content **"does not appear to be necessary in order to offer that user the services"** where an equivalent non-personalized version is possible. A recommendation feed is an enhancement, not the core contracted service, so you cannot claim it is "necessary for the contract."
  - **Legitimate interest, Art. 6(1)(f): the recommended basis.** First-party, on-platform, reasonably-expected personalization of a marketplace feed is a strong candidate under a documented Legitimate Interest Assessment (three-part test in EDPB Guidelines 1/2024, draft Oct 2024). Commercial interests can qualify as legitimate (CJEU C-621/22 KNLTB, 4 Oct 2024). You must: articulate the interest precisely, show necessity/data minimization, run the balancing test weighing reasonable expectations, provide transparency, and offer an **easy right to object (Art. 21)**.
  - **Consent, Art. 6(1)(a): required if the profiling becomes extensive/granular, combines off-platform data, uses special-category data, or exceeds reasonable expectations** (the Meta scenario — where the CJEU held users "cannot reasonably expect" personalized advertising processing without consent). Keep the feed first-party and in-context to stay in legitimate-interest territory.
  - **DSA overlay:** EDPB Guidelines 3/2025 (DSA-GDPR interplay, draft Sept 2025) confirm the DSA creates **no new lawful basis**; recommender options must not nudge, and while a non-profiling option is active you must not keep profiling. A Swedish DPA decision (EDPBI:SE:OSS:D:2025:1738) fined a controller that cited "legitimate interest" for profiling in a cookie banner but could not specify the interest or show a balancing test — **document your LIA.**

### 8. EU-US data transfers and your processors (2026 status)
Your processors — **Supabase, Cloudflare, Stripe, PostHog** — may transfer personal data to the US. Transfers can rely on the **EU-US Data Privacy Framework (DPF)** if the recipient is self-certified, or on **Standard Contractual Clauses (SCCs)**.
- **DPF status as of mid-2026: valid but under real legal threat.** The EU General Court **upheld** the DPF in *Latombe v Commission* (T-553/23, **3 September 2025**); Latombe has **appealed to the CJEU (C-703/25 P, filed 31 Oct 2025, pending)**. Separately, after the **US Supreme Court's *Trump v. Slaughter* ruling (29 June 2026)** on FTC independence, **noyb/Max Schrems announced a new DPF challenge** arguing the adequacy decision's premise (independent FTC oversight) is undermined. **The DPF remains in force today**, but you should not treat it as your sole pillar — ensure your processors also offer **SCCs** as a fallback.
- **Cloudflare is DPF-certified** and offers SCCs plus an EU Data Localization Suite. **Use PostHog Cloud EU (Frankfurt)** to keep analytics data in the EU and largely sidestep the transfer question. Confirm current DPF certification / SCCs for Supabase and Stripe in your data processing agreements, and name all four processors + transfer mechanisms in your privacy policy.

### 9. Recent/2024-2026 legal changes to note
- **ePrivacy Regulation is dead.** The Commission **formally withdrew** the 2017 proposal on **11 February 2025** ("no agreement expected"). The **2002 Directive and national transpositions remain in force.**
- **Digital Omnibus (proposed 19 November 2025):** would move cookie rules **out of ePrivacy and into the GDPR** (new Art. 88a), add a **closed list of consent-exempt low-risk purposes** (including **first-party aggregated audience measurement** and **security/fraud prevention**). The Commission's original draft included a **one-click reject** and a **six-month bar on re-asking** after a refusal, plus browser-level machine-readable consent signals (Art. 88b). **However, per the Council's June 2026 compromise text, the single-click-rejection and six-month-moratorium articles were removed after member states could not agree on them** — a reminder that the package is still in flux. **It is only a proposal**, realistically not in force before late 2027. **Plan on today's rules.**
- **EU "Cookie Pledge":** the Commission's 2023 voluntary initiative **collapsed in April 2024** ("dead in all but name"); not something to rely on.
- **UK (secondary market context):** the Data (Use and Access) Act 2025 introduced a statutory "statistical purposes" analytics exception (opt-out based) commencing **5 February 2026**, with final ICO guidance 29 April 2026 — relevant only if you target UK users.

## Details: Classification Table for the Square Share Stack

| # | Technology / item | Storage location | Classification | Consent needed (EU)? | Notes |
|---|---|---|---|---|---|
| a | **Supabase auth session cookie** | Device cookie | Strictly necessary | **No** (exempt) | Authentication for a service the user explicitly requested (login). Disclose in cookie policy. |
| a | **Cross-subdomain SSO cookie (.squareshare.eu)** | Device cookie | Strictly necessary | **No** (exempt) | Single sign-on across subdomains = requested service. Same-controller cross-subdomain use is permissible. Disclose. |
| b | **Stripe `__stripe_sid`** (session, ~30 min) | Device cookie | Strictly necessary | **No** (exempt) | Fraud prevention during an active checkout the user initiated. Clean exemption. |
| b | **Stripe `__stripe_mid`** (persistent, ~1 year) | Device cookie | Strictly necessary *(contested)* | **Debated** — treat as necessary only on checkout pages | 1-year cross-session fraud identifier; its persistence makes "strictly necessary" debatable. Mitigate: load stripe.js **only on payment/checkout pages**, not site-wide. Disclose as fraud-prevention. |
| c | **Cloudflare `__cf_bm`, `cf_clearance`, `__cflb`, `__cfruid`** | Device cookie | Strictly necessary (security/bot/load-balancing) | **No** (exempt) | Cloudflare's own docs classify these as strictly necessary; ~30 min for `__cf_bm`. Disclose; Cloudflare encourages disclosure. |
| d | **PostHog analytics cookies/localStorage + distinct ID** | Device cookie + localStorage | Analytics — non-essential | **Yes** (default) | Requires prior opt-in in the EU. Alternatively run PostHog **cookieless (memory / server-hash) mode** to avoid device storage (see below). |
| e | **localStorage UI preferences (theme/density/notifications)** | Device localStorage | Functional/preference | **Nuanced** | If genuinely storing a *user-requested* setting (like a language choice), arguably exempt; but EDPB treats most functional storage as needing consent. Safest: if set only after a logged-in user changes a setting they requested, treat as necessary/functional; do **not** use it for tracking. Disclose either way. |
| f | **First-party behavioral events (impressions/clicks/dwell/likes/follows/saves/purchases)** | **Server-side DB** | GDPR-only processing (if purely server-side) | **No ePrivacy consent** if no device read/write; needs a **GDPR lawful basis** | Keep strictly server-side, tied to the auth session, no new device identifier. Lawful basis = **legitimate interest** (documented LIA) with easy opt-out; **consent** if it becomes extensive/granular. Not "contract necessity" (Meta C-252/21). |
| g | **Consent cookie itself** | Device cookie | Strictly necessary | **No** (exempt) | Stores the user's choice so the banner doesn't reappear each page. Store consent record server-side too, for proof. |

## Details: Requirement Checklists

### Cookie banner — MUST-HAVE
- [ ] **First layer** with clear title, purpose, controller identity, and **three equally prominent options**: "Accept all", "Reject all", "Manage/Settings" — Reject as easy (one click, same visual weight) as Accept.
- [ ] **No non-essential storage/scripts fire before consent** (prior blocking) — verify PostHog and any client tags are gated. This is the #1 enforcement trigger (the exact failure in SHEIN and American Express).
- [ ] **Second (settings) layer** with **granular per-category toggles**, all **off by default** (no pre-ticked boxes).
- [ ] Categories: **Strictly Necessary** (always on, non-toggleable), **Functional/Preferences**, **Analytics**, **Personalization/Behavioral**. **No "Marketing/Advertising" category needed** (you run no ads).
- [ ] **Withdraw consent as easily as giving it** — persistent "Cookie settings" link in the footer of every page (and ideally a hovering icon). Verify that withdrawal actually stops the tracking (SHEIN was fined precisely because it did not).
- [ ] **No dark patterns** — no colour/contrast nudging, no "confirm-shaming", no cookie wall.
- [ ] Link to the **Cookie Policy** from the banner and every page footer.
- [ ] **Consent logging** (proof): store per-consent-event record with **user/device identifier, precise timestamp, choices per category, policy/banner version, collection method**. Store server-side (immutable), not only in the cookie. Retain ~3-5 years.
- [ ] **Re-prompt cadence:** re-collect consent at **~6-12 months** (CNIL recommends 6 months for the choice; 13 months is the outer bound and also the max for the consent cookie). Re-prompt immediately if you **add a new processor/purpose**.

### Cookie banner — NICE-TO-HAVE
- [ ] Geo-detection to vary UX — **but recommended approach is to apply EU rules globally** (simpler, over-compliant, avoids misclassification risk).
- [ ] GPC signal detection + honoring (defensive, for US/future).
- [ ] Multilingual banner (French especially, given CNIL enforcement).

### Cookie policy page — MUST contain
- [ ] **Identity + contact of the data controller** (Square Share legal entity) and DPO/contact if applicable.
- [ ] What cookies/trackers are, and that localStorage/similar tech is covered.
- [ ] **A categorized table**: for each cookie/tracker (or at minimum each category + named third parties) — **name, provider, purpose (specific, not "improve experience"), duration/retention, first- vs third-party, personal data involved**.
- [ ] **Named third parties/processors**: Supabase, Cloudflare, Stripe, PostHog — with links to their policies.
- [ ] **Legal basis** per category (consent for analytics/personalization; strictly necessary for the rest).
- [ ] **International transfers**: state that data may go to the US and the mechanism (**DPF and/or SCCs**), naming it per processor.
- [ ] **How to withdraw/change consent** (link to settings) and that withdrawal is as easy as giving.
- [ ] **User rights** (GDPR Arts. 15-22, including the Art. 21 right to object to legitimate-interest personalization) and how to exercise them.
- [ ] Relationship to the **Privacy Policy** (Art. 13 transparency) — cookie policy can be a section or standalone but must be linked from the banner, footer, and privacy policy.
- [ ] Last-updated date and versioning.

### Privacy policy — cookie-relevant MUST-haves (GDPR Art. 13)
- [ ] Controller identity/contact; purposes and legal bases of processing; recipients/processors; international transfers + safeguards; retention; data-subject rights; right to lodge a complaint with a DPA; existence of any profiling/personalization and its logic and consequences.
- [ ] A short **US/California section**: statement that you **do not sell or share** personal information for cross-context behavioral advertising; how to exercise US rights; that you honor GPC.

## Recommendations (staged, concrete)

**Stage 1 — Launch baseline (do before EU launch):**
1. Build/adopt a consent banner meeting every MUST-HAVE above. **A self-built CMP is legally acceptable** — because you run **no Google Ads / no AdSense/AdMob**, the Google **certified-CMP + IAB TCF** requirement does **not** apply to you, and no law mandates a specific vendor. If you'd rather not build consent-logging and re-prompt cadence yourself, a lightweight CMP (e.g., open-source c15t, which integrates with PostHog) is a reasonable buy-vs-build choice.
2. **Gate PostHog behind consent.** Best option: run **PostHog Cloud EU** and set `cookieless_mode: 'on_reject'` (or `loadMode: 'after-consent'`) so no PostHog cookies/localStorage/network calls happen before consent; on rejection, fall back to privacy-preserving cookieless counting (a daily-rotating server-side hash that PostHog does not treat as personal data). This lets you keep basic measurement even for non-consenting users. Note cookieless mode disables `identify()`, session replay, and surveys.
3. Load **stripe.js only on checkout/payment pages** to keep `__stripe_mid` defensible as strictly necessary.
4. Publish the cookie policy + privacy policy with all MUST-haves; name all four processors and transfer mechanisms; link from every footer.
5. Implement **server-side consent logging** with versioning.

**Stage 2 — Recommendation feed (before you ship personalization):**
6. Architect behavioral tracking to be **purely server-side**, tied to the authenticated session, with **no new device identifier** — keeping it out of ePrivacy Art. 5(3).
7. Choose and **document a lawful basis**: legitimate interest with a written **LIA**, transparency in the privacy policy, and an **easy opt-out toggle** for personalization. Provide a non-personalized browsing mode.
8. If personalization will use anything cross-context, off-platform, or granular/sensitive → switch that element to **explicit consent**.

**Stage 3 — Scale / US growth (monitor thresholds):**
9. Add **GPC honoring** and a "Your Privacy Choices"/"Do Not Sell or Share" link if you ever introduce advertising or data sharing.
10. Track US state thresholds — the ones that could catch you first are **Texas/Nebraska** (no numeric threshold) and low-threshold states (Rhode Island/Connecticut, 35,000). Re-assess when you approach ~35,000 US consumers in any single state.
11. Keep **SCCs** in place with every US processor as a DPF fallback; watch the CJEU *Latombe* appeal and the noyb DPF challenge.

**Benchmarks that change the plan:**
- **You add advertising / ad networks / data sharing** → add a Marketing category, "Do Not Sell or Share" link, mandatory GPC honoring, and (if using Google ad products) a Google-certified/IAB-TCF CMP.
- **You exceed ~35,000-100,000 consumers in a US state** → that state's law likely applies; implement its opt-out/DPIA duties.
- **Digital Omnibus is adopted (est. 2027+)** → you may be able to drop the banner for first-party aggregate analytics and security/fraud, and (if the browser-signal provisions survive negotiation) adopt browser-signal consent; revisit then.
- **DPF is invalidated by the CJEU** → rely on SCCs + transfer impact assessments; prioritize EU-hosted processors.

## Caveats
- **This is not legal advice.** ePrivacy is a *Directive* transposed differently in each member state; because your primary market is the whole EU, you must meet the **strictest applicable** national rule (assume consent is required for analytics — the France analytics-exemption is narrow and country-specific, and Germany/UK do not grant it). Engage a qualified EU privacy practitioner before launch, and get local advice for France given CNIL's enforcement intensity.
- **The `__stripe_mid` classification is genuinely contested.** Treating it as strictly necessary is defensible for fraud prevention but not risk-free; the mitigation (checkout-only loading) materially reduces exposure.
- **EDPB draft guidelines cited (1/2024 legitimate interest; 3/2025 DSA-GDPR) are not yet final** and could shift; the "instructing the sending" reading in Guidelines 2/2023 is broad and was contested in consultation — keep the behavioral pipeline strictly server-side to stay clearly outside Art. 5(3).
- **Regulatory landscape is in flux (2025-2026):** ePrivacy Regulation withdrawn, Digital Omnibus proposed (with key cookie-simplification articles removed in the Council's June 2026 compromise), DPF under challenge, US states adding laws yearly. Re-review this posture at least every 6-12 months.