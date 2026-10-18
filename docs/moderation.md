# Content moderation

How content is checked before anyone can see it, how a report gets filed and
reaches a human, and how a decision takes content off the platform. Four repos
are involved and they share one database, so this is the map.

Two mechanisms, in the order content meets them:

1. **The automatic check.** Nothing a user writes or uploads is public until
   that exact version has passed. It runs on every save; see
   [The automatic check](#the-automatic-check).
2. **Reports and staff decisions.** What reaches the public can still be
   reported, paused, removed and appealed. Everything from
   [The shape of it](#the-shape-of-it) down describes that, and predates the
   check.

## The shape of it

```
 SQ-store /s/../p/..  ──┐                        ┌──> products.moderation_status
 (anonymous buyer)      │                        │
                        ├──> public.reports ──> SQ-admin /moderation ──┼──> storefronts.moderation_status
 SQ-app  POST /reports ─┘         │              (staff decide)        │
 (signed-in visitor)              │                                    └──> artifacts.moderation_status
                                  │                                              │
                                  └──> content_report_scores ──> reportPenalty()  │
                                       (rollup view)              (feed ranking)  │
                                                                                  v
                                                             notifications(type='policy')
                                                             ──> the seller's dashboard
```

Everything above sits on the **one shared Supabase project**
(`vnyfndqpdllwhvhinjoi`). SQ-store, SQ-app and SQ-admin all talk to it; there is
no service-to-service API between them, and the database is the contract.

## The four repos

| Repo | Its part |
|---|---|
| **SQ-system** (here) | `@squaresharedev/moderation`: the report vocabulary and Zod schema, moderation state plus the one `isContentVisible` predicate, removal grounds with their seller-facing copy, the fix-field vocabulary, decision references and appeal bounds (`decisions.ts`), the automatic check's vocabulary (`auto.ts`), and `reportPenalty()`. |
| **SQ-store** | The report dialog and `POST /api/report` on hosted product pages (product, storefront or seller); the removal gate on all three public reads; the seller's paused/removed banner, the flagged sections of the product form, the "I've made the changes" button (`lib/moderation/review-request.ts`), the in-app appeal (`lib/moderation/appeals.ts`) and the statement-of-reasons PDF (`app/api/moderation/decisions/[id]/statement`); the ping that tells the admin panel to look now (`lib/moderation/admin-ping.ts`). **The automatic check itself** (`lib/moderation/auto`), its sweep (`/api/cron/moderation`) and the endpoint other apps may call (`/api/moderation/check`); the migration that installs the wall. |
| **SQ-app** | The marketplace's authenticated `POST /api/reports`; the removal gate on public artifact reads; the ranking hook. Image uploads through its own Worker (`worker/routes/uploads.ts`), and the client for the dashboard's check (`worker/lib/moderation.ts`). |
| **SQ-admin** | The staff queue at `/moderation` (appeals, what the automatic check is holding, paused items whose seller asked for another look, then reports), the pause / remove / restore / dismiss decisions with the product's full facts and photos, the parts-to-change checklist, the answer to an appeal (uphold or overturn), the audit trail, push alerts to staff, and the seller's notice (dashboard notification and email, with a link to the statement). |

## The automatic check

Built 2026-10-10. The rule: **a row is public only while every part of its
current content is on the approved list**, and the database enforces it.

```
 any app, any route (a server action, the marketplace API, a raw REST call)
                |
   moderation_gate   BEFORE INSERT OR UPDATE on products, storefronts, artifacts
                     content changed -> is every part already approved?
                     yes -> 'ok'        no -> 'pending'  (hidden)
                |
   the checker       SQ-store lib/moderation/auto: asks the classifier about the
                     parts nobody has judged, records the answers
                |
   moderation_settle from the approved list and nothing else:
                     all clean -> 'ok'
                     a violation -> paused, automated decision (artifact: removed)
                     otherwise -> 'review', held for a person
```

**Why the database and not the apps.** A seller holds a publishable key and an
RLS-permitted write on their own rows, so anything an app checks in a server
action can be skipped with one REST call. A trigger cannot. It also means an
app that has never heard of moderation is safe: content nobody approved is not
`ok`, and `isContentVisible` admits `ok` and nothing else.

**Parts, not rows.** A row's content is split into its text (every string in
the moderated columns, as `path=value` lines), each image and each PDF. Each
part has one verdict in `moderation_checks`, keyed by what it is: the object
key, or a fingerprint of the text. So the same photo is judged once however
many listings use it, a re-save of unchanged content costs nothing, and a
layout, price or stock edit is not a content change at all.

**Three verdicts.** `clean` is the only one that publishes. `violation`
pauses. `unsure` holds for a person, and so does anything the classifier
refuses, garbles or cannot read. A check that gets no answer (no key, the
provider down) records nothing, so the row stays `pending` and is asked about
again. There is no path on which a failure approves.

**What the classifier cannot see goes to a person.** It is shown the first
frame of an animation and cannot open an AVIF or an SVG, so the upload routes
(the only place holding the bytes) record those as `unsure` up front.

**A person's approval sticks.** When staff put a held or taken-down row back to
`ok`, `moderation_remember_approval` records every part of it as approved by
a person. The classifier never overwrites that, so the same photo or the same
words are not held twice. It is exact, though: reworded text is new text.

**An automated pause is an ordinary pause** with `automated = true` on its
decision: same banner, same parts to fix, same statement of reasons (which says
a machine decided), same appeal to a person. The one difference is the way
back. There is nobody to send it to, so an edit by the seller re-checks it on
the spot; a pause a person imposed still waits for that person.

**Public text that is not on a moderated row** takes a simpler rule with no
pending state: checked before it is stored, refused if not clean, and writable
by the service role only. That is the trader name, bio and shipping terms
(which print on every page a seller has, `guard_seller_text`) and a
marketplace collection's name (`guard_collection_name`). Each app's server
checks the value, lets the session's own write go first so RLS decides whether
the caller may touch the row, then writes the guarded columns with the service
role, pinned to the same user id.

**The handle and the profile picture** cannot take that rule, because sign-up
writes both from metadata the person signing up controls, and GoTrue can be
called directly. They reach the public through one door, the profile directory
behind `public_profiles`, so the door is where they are checked:
`sync_profile_directory` lists a profile only when its handle is on the
approved list (`handle:<lowercased>`) and carries its picture only when that
exact URL is (`avatar:<avatar_url>`). Who wrote the value does not matter.
An app that checks a handle or stores a picture records the approval as a side
effect; an app that does not check gets a value that is stored and never
public. A picture the platform did not store (a sign-in provider's) is never
approved, so a public profile shows none until one is uploaded.

**The marketplace** reads artifacts straight through RLS, so its takedown gate
is in the policy itself: `artifacts_public_read` requires
`moderation_status = 'ok'`. And every image reaches the bucket through the
Worker, never a presigned browser PUT: an approval is recorded against an
object key, so a key has to mean "the bytes the server stored, once". A
presigned URL can be used again to overwrite an object after it was approved.
Artifacts cannot be paused, so their words are checked before they are stored
(a refusal leaves a live artifact as it was) and a refused image means the
artifact is never created.

**Three ways the checker runs**, one mechanism:

- **Before a save** (`precheck`): the dashboard has the new content judged
  first, so a clean edit to a live listing passes the gate inline and is never
  hidden.
- **After a save** (`checkTarget`): settles the row, reading the content from
  the database rather than being told what it is.
- **The sweep** (`POST /api/cron/moderation`, every five minutes from
  `.github/workflows/moderation-sweep.yml`): everything no save settled. A row
  written around the app, a check that timed out, and content from before the
  wall, which is audited while it stays live. `?dry=1` reports what each
  waiting row would become without settling it.

**For another app** (SQ-app today): nothing is required to be safe. To get an
answer while the user is still on the screen, call
`POST /api/moderation/check` on the dashboard with the scheduler's secret:
`{ target: { type, id } }` settles a row, `{ text }` judges words that are
checked before they are stored, and `{ handle }` and `{ avatar: { key, url } }`
judge a handle and a stored profile picture and record the approval the public
directory asks for.

**What the policy decides.** The default is `clean`: ordinary goods (furniture,
perfume, clothing, art, food that is not alcohol, objects around alcohol and
tobacco such as glassware and humidors) must never be held, and `unsure` needs
a nameable suspicion (weapon-like goods, a "dupe" of a designer product, coded
wording, disease-cure claims, text that addresses the checker, a file field
holding another website's address). Goods restricted to adults are prohibited
even where lawful: alcohol, tobacco, nicotine and vapes, CBD and other
cannabinoids, kratom, paraphernalia, sex products, gambling, fireworks and
anything marked 18+. They are a `violation` with the ground `other`, so no
vocabulary, schema or table changed for them; the seller is told through the
"other" reason, which names them. Two further rules are code, not prompt, so
they cannot flip from one run to the next: a line naming a file on the
platform's own storage is not sent to the model, and a file field holding
another website's address is held without asking it. The model names its ground
in capitals (the policy does), so the ground is lower-cased before it is looked
up; an unknown ground becomes `other`. An image has no listing around it, so it
breaks a rule only when it presents something prohibited as its subject (a
bottle of spirits as a product shot, a pistol, drugs) or shows something that
may not be shown at all (explicit sexual content, gore, hate symbols); a man
smoking in a portrait, fireworks over a city or wine on a laid table are
ordinary photographs.

**Measuring it.** Three opt-in evals in SQ-store run the real model:
`auto-moderation.live.test.ts` over labelled text (`tests/moderation/cases.ts`,
plus `holdout.ts` and `edge.ts`, written after tuning, the latter by an author
who never saw the prompt) and `auto-moderation-media.live.test.ts` over real
photos fetched from Wikimedia Commons and PDFs built from text
(`tests/moderation/media.ts`). Both are scored by `tests/moderation/score.ts`:
zero leaks, at most 2% of ordinary content held, and at most 5% of answers
giving a wrong reason (a ground the case does not allow) or sending the seller
to the wrong field. Run them after any change to the prompt, the model or the
answer handling.

**Changing the policy** is an edit to `POLICY_PROMPT` in SQ-store's
`lib/moderation/auto/policy.ts` (written from section 10 of the terms), then
`select moderation_recheck_all()`: the classifier's answers are forgotten, a
person's stand, and every live row is audited again without being hidden.
Profile text, handles, pictures and collection names are NOT re-judged by it:
they have no row for the sweep to find, so their approvals are kept.

**Deploy order is the reverse of every other migration here.** The code is
inert without the wall; the wall hides every save until a deployed checker
settles it. So: set `ANTHROPIC_API_KEY` and `CRON_SECRET` on the dashboard
Worker, deploy, THEN apply `20261012_auto_moderation.sql`, then run a dry
sweep. That is why it sits in `UNPROBED_MIGRATIONS` in SQ-store's deploy gate.

**Do not put a public hostname on the shared bucket.** SQ-app is written to
serve images from `cdn.squareshare.eu` as a custom domain on
`squareshare-products` (not connected as of 2026-10-10). Connected, every
object in the bucket is public by key the moment it is stored: an upload nobody
has checked, and every seller's paid download file. The marketplace needs its
own bucket that only approved images are copied into, or a route that signs or
proxies what is approved.

**What it does not cover**, so nobody assumes otherwise: whatever is behind an
external link, paid download files (never displayed), custom font files, and
known child abuse imagery, which needs hash matching and a reporting procedure
rather than a classifier. And a classifier's `clean` can be wrong: reports
and the queue below are what catch that.

## Pause or remove

Staff choose one of two takedowns, and both hide the content identically
(`isContentVisible` admits only `ok`):

- **Pause** (products and storefronts only). Staff name the PARTS to change
  (`FIX_FIELDS`: the photos, the title, the purchase link; at least one) and
  write a note. The seller is told in the dashboard and by email; on their
  product's edit page the banner lists the parts as chips that jump to them,
  and each flagged section and field is outlined and says so. A storefront's
  parts are listed on the storefront list and in a strip inside its editor.
  Saving a paused product asks "send it back for review?" on the spot. The
  button sets `moderation_review_requested_at` (service_role only, via
  SQ-store's server action, after it has checked their own session). Staff
  get a push alert and the item heads the queue; they approve (back to `ok`,
  the seller is thanked), pause again with a new note, or remove it.
- **Remove**. Final unless an appeal changes it. The seller is told why.

## Decisions, statements and appeals

Every pause or removal of a product or storefront writes one immutable
`moderation_decisions` row (action, ground, note, parts, and the notices
behind it as a count and categories, never who or their words), and the
content row points at it through `moderation_decision_id`. That row is what
two things are built from:

- **The statement of reasons** (DSA Art. 17), a PDF the seller downloads from
  the banner or the email: what was decided, its reach and duration, the
  ground, the facts, whether automated means were used (they were, for a
  decision the automatic check made, and it says so), the contractual (and
  for `illegal`, legal) basis, every route to challenge it, and where any
  appeal stands. In the seller's language, laid out by SQ-store's own small
  PDF writer (`lib/pdf/document.ts`) with an embedded Inter subset so Czech,
  Polish and Slovak print correctly. Readable by the store's owner and team
  only; everyone else gets a 404. Quoted everywhere by its reference,
  `MD-` plus the first ten hex digits of the id.
- **The appeal** (DSA Art. 20). One `moderation_appeals` row per decision,
  filed from the banner through SQ-store's server action (the table is
  read-only to sellers). Staff get a push alert and appeals head the queue.
  They uphold it (a written answer is required) or overturn it (the content
  goes live and the seller is told the appeal succeeded). A new decision,
  such as softening a removal to a pause, answers any open appeal against the
  old one and can itself be appealed.

## What buyers can report

The report dialog on a hosted product page always offers the product. It adds
the whole storefront once the seller has more than one live product, and the
seller once they run more than one live storefront (the page is told only
booleans, never the counts). A seller report travels as the storefront's id
and is filed on the server against the account behind it, as the shared
table's `profile` target, so the page never handles an account id.

Artifacts are remove-only: the marketplace has no surface where a seller could
fix something and ask again, and its CHECK does not admit `paused`.

## How staff hear about it

The admin panel's notification scan (pg_cron, once a minute) watches `reports`
and `moderation_review_requested_at` with a watermark per source, so each row
is announced once. SQ-store also pings `POST /api/moderation/notify` (same
`NOTIFY_SCAN_SECRET`, held there as `ADMIN_NOTIFY_SECRET`) the moment a report
or review request is written, which runs the moderation half of that scan
immediately. The ping carries no data. Both events are switches in the admin's
Settings, under Notifications.

## Rules that hold everywhere

**One vocabulary.** `REPORT_REASONS` and `REMOVAL_GROUNDS` exist in the package
here, are mirrored by hand in each app, and are mirrored again as SQL `CHECK`
constraints. A value added to one and not the others fails at the wall. The
apps do not consume the package yet (it is written, not published: publishing
needs a classic PAT, see the README), so today the mirrors are the mechanism.

**A report is an allegation; a removal is a decision.** Reporters pick a
`ReportReason`. Staff pick a `RemovalGround`, which is the platform's own
finding and is what the seller is told. They are separate lists on purpose:
collapsing them would mean telling a seller "removed: scam" on the strength of
a stranger's opinion.

**A report never hides content.** Reports filter nothing. They buy a ranking
demotion through `reportPenalty()` while a human gets to it, and nothing more.
What hides content is a decision (a person's, or the automatic check's on a
clear violation) or the wall itself, while content is unchecked or held.

**The gate fails closed and lives in one predicate.** Every public read calls
`isContentVisible()`; only the literal `"ok"` is visible, and a `null` from a
failed read is not. That is what let `pending` and `review` be added without
touching a single read. In SQ-store that is three call sites (the hosted product
page, the embed payload, the share card); in SQ-app it is the public profile
read. A takedown that covers one surface and not another is not a takedown.

**A seller must be told what happened and why.** Not a courtesy: EU Digital
Services Act Art. 17 gives the provider of removed content a right to a
statement of reasons. It is assembled from the ground plus the staff note, in
one function, so the seller reads the same sentence in the notification and in
the dashboard banner.

**A seller cannot undo it.** `moderation_status` is not `status`. The database
refuses any write to `moderation_*` that is not `service_role`, via the
`moderation_gate` trigger (which replaced `guard_moderation_columns`, and
also discards whatever moderation state a seller sends on INSERT). A column-level `REVOKE` would not have
worked: PostgreSQL will not let one cut into an existing table-level grant.

**Reporters are never named.** `reporter_id` is reduced to a boolean at the
admin read boundary and `reporter_hash` is a salted digest bound to the target,
so it cannot be walked to assemble "everything this visitor reported". The
optional `reporter_email` is staff-only and never reaches the reported party.

## Migrations

Two, applied to production on 2026-09-18 via the Supabase MCP, in this order
(the admin view reads the store's columns):

1. `SQ-store/supabase/migrations/20260918_content_moderation.sql`, prod
   version `20260918154030`: the `moderation_*` columns on products,
   storefronts and artifacts, the guard trigger, and
   `notifications.type += 'policy'`.
2. `SQ-admin/supabase/migrations/0007_content_reports.sql`, prod version
   `20260918154058`: widens the shared `reports` table (target types, reason
   vocabulary, staff resolution columns, dedupe indexes) and adds
   `content_report_scores`.

3. `SQ-store/supabase/migrations/20260923_moderation_pause.sql`: `paused` in
   the products/storefronts status CHECK, `moderation_review_requested_at`,
   and that column added to the guard trigger.
4. `SQ-store/supabase/migrations/20260926_moderation_decisions_and_appeals.sql`:
   `moderation_decisions`, `moderation_appeals` (both read-only to the store's
   owner and team, written by service_role only), `moderation_fields` and
   `moderation_decision_id` on products and storefronts, and both added to
   the guard trigger.

5. `SQ-store/supabase/migrations/20261012_auto_moderation.sql`: the wall.
   `pending` and `review` in the status CHECKs, `moderation_rev` and
   `moderation_checked_at`, `moderation_decisions.automated`,
   `moderation_checks`, the `moderation_gate` and
   `moderation_remember_approval` triggers, the checker's functions and
   `guard_seller_text`. **In production since 2026-10-11**, applied AFTER its
   code deployed (see The automatic check), and verified from the database:
   objects present, no client role can execute the functions or touch
   `moderation_checks`, and a seller's edit lands in `pending` while a
   self-approval is refused.
6. `SQ-store/supabase/migrations/20261013_marketplace_moderation.sql`: the
   marketplace's half. `artifacts_public_read` requires `ok`;
   `sync_profile_directory` asks the approved list for the handle and the
   picture; `guard_collection_name`. **In production since 2026-10-11**, applied
   BEFORE SQ-app's matching code because SQ-app is not deployed anywhere and
   the marketplace holds no data, while the policy it replaces let any
   signed-in user publish an unchecked artifact through the REST API. The
   consequence to know: an SQ-app build older than this one cannot create or
   rename a collection (its write is refused), so deploy SQ-app from this
   repo's current state, not an older one. Applying it empties the public
   directory: each profile is listed again the next time its owner saves it in
   an app, which is when its handle is checked.

3 and 4 are in production as of 2026-09-26 (verified against the live
schema), applied through the SQL editor, so `list_migrations` has no row for
them.

The first two are recorded in `list_migrations`; DB types in SQ-store
(`src/types/supabase.ts`) regenerated from the live schema afterward. SQ-app's
`worker/lib/database.types.ts` is a hand-curated subset (it already diverges
from the live schema in unrelated ways, e.g. it still lists a
never-applied `interaction_events` table), so only the moderation-relevant
tables were corrected there rather than replacing the file.

Deploy order matters for **SQ-app**: it now sends the new reason words, so its
deploy must land with or after migration 2 (already true in production), or
its inserts fail the CHECK.

## Verifying locally

SQ-store's e2e stack (`node tests/e2e/stack/server.mjs`) builds the whole
schema from `tests/db/prod-migrations.sql`, which replays every migration
above. It runs the automatic check with a stand-in classifier
(`MODERATION_TEST_PROVIDER=1`: clean unless the content carries
`[[violation]]` or `[[unsure]]`), which only ever answers against a local
database. `tests/integration/37-auto-moderation.test.ts` proves the wall
against a real Postgres through the roles PostgREST uses;
`92-auto-moderation.spec.ts` walks it from the seller's side. `tests/e2e/66-content-reports.spec.ts` drives the buyer half;
`71-moderation-pause.spec.ts` and `75-moderation-fix-and-appeal.spec.ts` the
seller's (every surface going dark, the flagged form, the statement download,
appeals, the wider report options); `72-admin-moderation.cross-app.spec.ts`
the admin panel's screens end to end, appeals included (opt-in, needs the
panel running; recipe in its header).

The **admin panel** can be pointed at that same stack instead of the live
project, which is how its moderation screens were driven before the migrations
existed in production. Put the stack's printed gateway URL and minted keys into
an untracked `SQ-admin/.env.e2e` and run `next dev -p 3200` with them exported;
sign in as a user you have inserted into `admin_users`.

## Deliberately not built yet

- **Image review without credentials.** The admin panel signs product photos
  and held uploads itself (`lib/storage/r2.ts`), but only once it holds an R2
  read token (`R2_*` env). Until then the detail page says the file cannot be
  shown, and staff cannot judge a held image.
- **A faster sweep.** GitHub runs it every five minutes at best. A row no save
  settled waits that long; pg_cron (as the admin scan uses) would make it one.
- **Staff approval of reworded text.** A person's approval covers the exact
  words. A seller who then fixes a typo has new text, which the classifier
  judges again and may hold again.
- **SVG without a person.** Rasterising on upload would let the classifier see
  it; today every SVG waits for staff.
- **Hash matching for known abuse imagery**, and the reporting procedure that
  goes with it. Not something a classifier does.
- **Appeals for marketplace artifacts.** Products and storefronts have the
  in-app appeal; an artifact's seller has no page to file one from, so their
  notice still points at the support address.
- **Repeat-offender escalation.** Counts are recorded; the step up to a user
  ban is manual, using the existing tooling on `/users`.
- **Trusted flaggers, transparency reporting, statement-of-reasons submission
  to the EU database.** Real obligations at scale, not at this one.
