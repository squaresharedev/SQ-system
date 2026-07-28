# Agent Surface: the future Square Share MCP server

Status: **planning document, nothing here is built.** This file exists so that every
schema, token, and dashboard decision made from now on stays forward-compatible with a
public MCP server that external AI agents (Claude Code, Cursor, Lovable, a creator's own
agent) will use to provision and operate Square Share storefronts programmatically.
Treat it as canonical for agent-surface questions in any Square Share repo, the same way
`algorithm.md` (SQ-app repo) is canonical for the recommendation feed.

Grounding: audited on 2026-07-28 against `@squaresharedev/schemas`, `@squaresharedev/tokens`,
`@squaresharedev/grid`, `@squaresharedev/db` (this repo) and the SQ-store working tree
(`src/types/storefront.ts`, `src/lib/validation/storefront.ts`, `src/lib/storefront/actions.ts`,
`src/lib/products/actions.ts`, `src/types/supabase.ts`).

---

## 1. Intent

The MCP server is the machine equivalent of the seller dashboard: one authenticated surface
through which an agent can create a store, add products, upload assets, set stock, generate
a checkout session, and control the storefront's visual presentation. It is not a scraper
or a DOM driver; it speaks the same validated contracts the dashboard's server actions
already enforce (`storefrontConfigSchema`, `productWriteSchema`), against the same
`storefronts.config` jsonb and `products` rows. Everything a human seller can do in the UI
must eventually be reachable through it, minus the flows that legally require a human
(Stripe Connect onboarding, KYC, account deletion).

The design rule that follows: **any storefront property a human can edit in the dashboard
must be expressible as a validated, enumerable value an agent can set.** A property whose
only escape hatch is "type arbitrary CSS" is not agent-addressable and must be redesigned
before it ships. The codebase already lives by the strong form of this rule (the contract
comment at the top of SQ-store `src/types/storefront.ts`: no HTML, no URLs, no free-form
CSS anywhere in the config), so the remaining work is not a rewrite; it is closing the
gaps listed in section 3 and never opening new ones.

---

## 2. Proposed tool surface

Access column: **R** read-only, **W** write, **$** money-touching (see section 5).
Names are provisional; input shapes reference real schema exports.

### Provisioning

| Tool | Purpose | Input (one line) | Access |
|---|---|---|---|
| `store_create` | Create a storefront row (wraps SQ-store `createStorefront`, `lib/storefront/actions.ts:57`) | `{ name: storefrontNameSchema }` | W |
| `store_list` | List the seller's storefronts | `{}` | R |
| `store_get` | One storefront row + parsed config (`parseStoredStorefrontConfig`) | `{ storefrontId: storefrontIdSchema }` | R |
| `store_rename` | Update `storefronts.name` | `{ storefrontId, name }` | W |
| `store_delete` | Delete a storefront (wraps `deleteStorefront`, `actions.ts:374`) | `{ storefrontId }` | W, irreversible |
| `seller_get` | Profile + capability status (is_seller, Stripe connected, currency) | `{}` | R |

Deliberately absent: account creation, Stripe Connect linkage, payout config. Those are
human-only (section 5).

### Catalog

| Tool | Purpose | Input | Access |
|---|---|---|---|
| `product_create` | Create a product (wraps `createProduct`, `lib/products/actions.ts:155`) | `productWriteSchema` fields: title, description, priceCents, currency, status, imageKey?, digitalFileKey? | W $ |
| `product_update` | Patch a product (wraps `updateProduct`) | `{ productId } + partial productWriteSchema` | W $ (price/status) |
| `product_delete` | Delete a product | `{ productId }` | W, irreversible |
| `product_list` / `product_get` | Read catalog | `{ status? }` / `{ productId }` | R |
| `asset_upload_url` | Presigned R2 upload (wraps `/api/uploads/presign`); returns object key for `imageKey` / `digitalFileKey` | `{ kind: "image" \| "file", contentType, sizeBytes }` | W |
| `stock_set` | Stock settings (wraps `updateStockSettings`, `lib/stock/actions.ts:49`) | `{ productId, trackStock, stockQuantity?, lowStockThreshold? }` | W |

Note: there is **no variants system** in the current DB (`products` table has no variant
rows or option columns, `src/types/supabase.ts:117`). Variant tools are listed as a future
obligation only; when variants ship, they must ship with a wire schema on day one.

### Presentation (see section 3)

| Tool | Purpose | Input | Access |
|---|---|---|---|
| `theme_set` | Patch `config.theme` (background, accent, font, cornerRadius, titleStyle, titleDisplay, priceDisplay, priceTagPosition, priceTagStyle, showTitle, displayMode, gridGap, soldOutBadge, hideSoldOut) | partial of the theme object, validated by `storefrontConfigSchema.theme` | W |
| `header_set` | Patch `config.header` | `{ show, name, bio }` (headerSchema) | W |
| `block_add` | Add a product / text / shape block at a free position | one member of the block discriminated union (`productBlockSchema` etc., incl. `x/y/w/h`) | W |
| `block_update` | Patch one block by key | `{ blockKey } + partial block` | W |
| `block_remove` | Remove one block | `{ blockKey }` | W |
| `blocks_place` | Move/resize many blocks in one batch (non-overlap + canvas bounds re-checked) | `{ blocks: [{ blockKey, x, y, w, h }] }` | W |
| `storefront_publish` | Promote draft config to live (only if the draft model in section 6 is adopted; today `saveStorefront` writes live) | `{ storefrontId }` | W, outward-facing |
| `embed_configure` | Embed widget settings (wraps `updateEmbedSettings`, `actions.ts:314`) | `embedSettingsSchema` | W, outward-facing |

### Commerce

| Tool | Purpose | Input | Access |
|---|---|---|---|
| `checkout_session_create` | Mint a buyer checkout session for a product | `{ productId, quantity? }` | W $ |
| `order_list` | Read orders (`orders` table: amount_cents, platform_fee_cents, status, channel) | `{ range?, status? }` | R (PII: buyer_email) |
| `order_get` | One order | `{ orderId }` | R (PII) |

### Introspection

| Tool | Purpose | Input | Access |
|---|---|---|---|
| `schema_describe` | JSON Schema for any wire contract, derived from the Zod source (see 3.3) | `{ contract: "storefront_config" \| "product" \| "embed" \| ... }` | R |
| `tokens_list` | The design token catalog: scales, members, and what each applies to | `{ scale?: "font" \| "radius" \| "size" \| ... }` | R |
| `capabilities` | What this seller/token can do right now (role, Stripe status, limits like `MAX_BLOCKS`) | `{}` | R |

---

## 3. The presentation surface (the hard constraint)

**HARD RULE: agents never write raw CSS, inline styles, or free-form style strings.**
Every visual property is a bounded, Zod-validated value. Opacity is a bounded integer
scale, not a float. Fonts are a named enum (`STOREFRONT_FONTS`), not a font-family string.
Layout sizes are the closed `BLOCK_SIZES` set, not pixel values. Colour must become a
token or palette reference; today it is a regex-gated hex code, which is the largest open
design decision (see 3.2 and section 6).

### 3.0 Source-of-truth drift (STATUS: resolved package-side at v0.2.0)

The single biggest blocker found in this audit: **SQ-store did not import
`@squaresharedev/schemas` at all**; it kept local copies in `src/types/storefront.ts` and
`src/lib/validation/storefront.ts`, which had moved far past the package (numeric
`cornerRadius`/`gridGap` replacing the `radius`/`density` enums, `titleStyle`+`titleDisplay`
replacing `cardStyle`, a background `image` variant replacing `pattern`, 9 price tag
positions, 22 `SHAPE_KINDS` with `borderWidth`/`borderColor`/`opacity`, and finally the
**free-placement canvas model**: every block stores cell coordinates `x/y/w/h` on a
`theme.columns` by `theme.rows` board, replacing the auto-flow `size` enum + `order` int
entirely; non-overlap and in-bounds are schema-enforced via `placementsOverlap` and a
config-level `superRefine`).

Resolution (schemas v0.2.0, published): `packages/schemas/src/storefront.ts` and
`storefront-validation.ts` are re-lifted from the SQ-store canvas-model working tree,
byte-compatible, with two documented package deviations (`OBJECT_KEY_PATTERN` inlined;
legacy gradient presets as the optional `legacyGradients` parameter of
`parseStoredStorefrontConfig`).

SQ-store adoption is STAGED but not switched: the repo now carries the `.npmrc` scope
mapping and a guarded `GH_PACKAGES_TOKEN` auth step in `deploy.yml`, but installing the
package needs a CLASSIC PAT with `read:packages` (the local fine-grained `github_pat_`
token 403s against GitHub Packages; see the SQ-system README). Remaining steps, in order,
once that PAT exists locally and as a Store repo secret:
1. `pnpm add @squaresharedev/schemas@^0.2.0` in SQ-store.
2. Replace `src/types/storefront.ts` with `export * from "@squaresharedev/schemas/storefront";`
   (the subpath export is zod-free, safe for client bundles).
3. Replace `src/lib/validation/storefront.ts` with a shim that re-exports
   `@squaresharedev/schemas/storefront-validation` and locally overrides
   `parseStoredStorefrontConfig(raw)` to bake in the app's `LEGACY_BACKGROUND_GRADIENTS`.
4. `pnpm typecheck` must pass with zero app-code edits beyond the two shims.
Until that lands, the app files and the package must be kept mirrored in lockstep.

Still stale, deliberately: `@squaresharedev/grid`'s FLOW mode implements the old auto-flow
`GRID_SIZES` grid, which the canvas designer no longer uses. The grid package is UI, not a
wire contract, so it does not gate the MCP; re-lift it when the canvas designer stabilizes.

An MCP server can only exist against **one** schema package; that is now this one.

### 3.1 Property audit

Legend for "bounded": **enum** (closed member set), **int-range** (Zod `int().min().max()`,
machine-discoverable bounds), **regex** (pattern-gated scalar), **free** (only a length cap).
"Must become" is what agent-addressability requires; "already fine" means the introspection
tool can describe it as-is. All rows cite SQ-store's current working tree unless noted.

Theme (`config.theme`, `themeObjectSchema`, `src/lib/validation/storefront.ts:103`):

| Property | Current representation | Bounded? | Must become |
|---|---|---|---|
| `background.kind` | union tag: solid / gradient / image | enum | already fine |
| `background.solid.color`, `gradient.from/to` | hex `#rrggbb`, regex `HEX_COLOR_PATTERN` | regex | palette/token reference (debt A) |
| `background.gradient.angle` | int 0..360 | int-range | already fine (declare step in introspection) |
| `background.image.key` | R2 object key, regex + ownership check | regex | already fine (must pair with `asset_upload_url`) |
| `background.image.x/y`, `.scale` | int 0..100, int 100..300 | int-range | already fine |
| `accent` | hex, regex-gated | regex | palette/token reference (debt A) |
| `font` | `STOREFRONT_FONTS` 5-member enum (sans/serif/mono/display/hand) | enum | already fine |
| `cornerRadius` | int 0..100 (px, CSS-clamped) | int-range | already fine; consider declaring named stops (sharp/soft/round/pill) as aliases |
| `titleStyle` | `TITLE_STYLES` (bar/overlay/shadow) | enum | already fine |
| `titleDisplay`, `priceDisplay` | 2-member enums | enum | already fine |
| `priceTagPosition` | 9-member enum | enum | already fine |
| `priceTagStyle` | plain/pill | enum | already fine |
| `showTitle`, `soldOutBadge`, `hideSoldOut` | booleans | enum | already fine |
| `displayMode` | grid/carousel | enum | already fine |
| `gridGap` | int 0..32 px | int-range | already fine |

Blocks (`config.blocks[]`, discriminated union on `type`; free placement on the
`theme.columns` x `theme.rows` canvas):

| Property | Current representation | Bounded? | Must become |
|---|---|---|---|
| `theme.columns` / `theme.rows` | int 3..12 / int 2..60 (`CANVAS_COLUMNS_*`, `CANVAS_ROWS_*`) | int-range | already fine |
| `x`, `y`, `w`, `h` (all block types) | ints bounded by canvas maxima; in-bounds + non-overlap enforced config-level (`superRefine`, rejected not repaired) | int-range | already fine; agents must place, not append (use `readingOrder` to reason linearly) |
| product `productId` | uuid, ownership re-checked server-side | regex | already fine |
| product `soldOut` | boolean? | enum | already fine |
| text `text` | free text, cap 300, control chars rejected, rendered as React text node only | free (content) | acceptable: this is content, not styling; cap + pattern are the bound |
| text `variant` / `align` | 3-member enums | enum | already fine |
| text `bold/italic/underline` | booleans, applied as tokenized classes | enum | already fine (this IS the text-weight surface: weight is a named toggle, never a numeric font-weight) |
| shape `kind` | 22-member `SHAPE_KINDS` enum, resolves via code-defined `shape-specs.ts` | enum | already fine |
| shape `color`, `borderColor` | hex, regex-gated | regex | palette/token reference (debt A) |
| shape `borderWidth` | int 0..`SHAPE_BORDER_WIDTH_MAX`(24) | int-range | already fine |
| shape `opacity` | int 0..100 (UI steps by 5) | int-range | already fine; declare the step; never a float |

Non-theme config and row fields:

| Property | Current representation | Bounded? | Must become |
|---|---|---|---|
| `header.show` | boolean | enum | already fine |
| `header.name` / `header.bio` | free text, caps 60/160, control-char patterns | free (content) | acceptable as content |
| `embed.enabled` | boolean | enum | already fine |
| `embed.domains` | up to 10 hostnames, `HOSTNAME_PATTERN` regex | regex | already fine mechanically; consider pre-registered-domain flow (debt C) |
| `storefronts.name` (row column) | free text 1..80 | free (content) | acceptable as content |

Product / seller fields an agent will also touch: `title` (free, 1..200), `description`
(free, ≤5000), `priceCents` (int 1..100,000,000), `currency` (`CURRENCIES` enum EUR/USD),
`status` (draft/active enum), `imageKey`/`digitalFileKey` (regex + server-side MIME/size
verification), stock ints. All bounded or content-class. `profiles.display_name` (free,
1..50, unique) is content.

### 3.2 Retrofit debts (every free-form leak, exhaustively)

No raw CSS strings, arbitrary URLs, or HTML are stored anywhere in storefront config; the
contract comment at SQ-store `src/types/storefront.ts:1` forbids them and the audit
confirms it holds. The debts are narrower:

**Debt A: arbitrary hex colours.** Six fields accept any of 16.7M `#rrggbb` values:
`theme.accent`, `theme.background.solid.color`, `theme.background.gradient.from`,
`theme.background.gradient.to`, `ShapeBlock.color`, `ShapeBlock.borderColor`
(all via `hexColorSchema`, SQ-store `src/lib/validation/storefront.ts:56`). Regex-gated,
so safe, but not a token reference: an agent cannot enumerate legal values, and cannot
change a store's palette coherently without touching N scattered fields.
Proposed target: a per-store palette object in the config
(`palette: { accent: hex, surface: hex, ink: hex, extra1..extraN: hex }`), where raw hex
enters in exactly one place, and every colour field elsewhere becomes an enum reference
to a palette slot. Preserves the "no cookie cutter" brand promise (sellers keep arbitrary
colours) while making every colour property enumerable. Decision deferred to section 6.

**Debt B: fine-grained numeric sliders.** `cornerRadius` (0..100), `gridGap` (0..32),
`opacity` (0..100), `gradient.angle` (0..360), `borderWidth` (0..24), background image
`x/y/scale`. These are already Zod-bounded integers, which meets the letter of
agent-addressability (bounds are machine-discoverable), but introspection must publish
min/max/step/unit for each, and none may ever widen to floats or CSS lengths.

**Debt C: free-text entry points that are really references.** `embed.domains` is typed
as text but semantically references the seller's own sites; a future pre-registration flow
would make it enumerable. `background.image.key` and product asset keys are only valid as
outputs of the presign flow; the MCP must never accept arbitrary keys it did not mint.

**Debt D: the drift itself (3.0).** Until SQ-store consumes `@squaresharedev/schemas`,
any MCP validation layer would validate against the wrong contract. This is the retrofit
debt that blocks all others.

**Content-class strings (not debts):** `TextBlock.text`, `header.name/bio`,
`storefronts.name`, product `title/description`, `display_name`, tax fields. These are
seller prose, not presentation. They stay free-form by design, bounded by length caps and
the control-character patterns (`SINGLE_LINE_TEXT_PATTERN` / `MULTILINE_TEXT_PATTERN`),
and are only ever rendered as React text nodes.

### 3.3 Schema introspection tool (STATUS: data layer implemented at v0.2.0)

Agents must discover legal values at runtime, not guess. Zod v4 (already the dependency,
`zod@^4` peer of `@squaresharedev/schemas`) ships `z.toJSONSchema()`, so the contract
source IS the introspection payload. Implemented in
`packages/schemas/src/agent-meta.ts`:

- `describeContract(name)`: for any `AgentContractName` (`storefront_config`,
  `storefront_name`, `embed_settings`, `artifact`, `artifact_placement_batch`,
  `collection`) returns `{ contract, jsonSchema, fields?, limits?, enums? }`, where
  `jsonSchema` is `z.toJSONSchema(schema, { io: "output", unrepresentable: "any" })` over
  the exact Zod object the write path parses. Refinement-level rules JSON Schema cannot
  express (non-overlap, canvas bounds, block uniqueness) still apply at the boundary.
- `STOREFRONT_FIELD_META`: unit/step/min/max/labels for every bounded numeric field
  (`theme.cornerRadius` px step 2, `theme.gridGap` px step 2, `blocks[].opacity` % step 5,
  gradient angle deg step 5, image zoom % step 5, canvas cells, placement coords). This
  lifts the knowledge that previously lived only in dashboard `Slider` props
  (`CardsSection.tsx`, `LayoutSection.tsx`, `ShapeBlockEditor.tsx`, `BackgroundEditor.tsx`)
  into the schemas package as data; keep it in lockstep with the Zod bounds.
- `STOREFRONT_ENUMS`: the full closed-set catalog (fonts, titleStyles, priceTagPositions,
  shapeKinds, ...), referencing the canonical const arrays.
- `STOREFRONT_LIMITS`: `{ maxBlocks: 120, storefrontNameMax: 80, headerNameMax: 60,
  headerBioMax: 160, textBlockMax: 300, embedMaxDomains: 10 }`.

The MCP server's `schema_describe` / `tokens_list` tools become thin wrappers over these
exports, stamping the package version from their own dependency manifest. Introspection
and enforcement can never disagree because they are the same object. Still future work:
the rendered-font mapping (`tokens.css` @theme: display = Space Grotesk, sans = Geist,
...) and, once Debt A lands, the per-store palette slots.

---

## 4. Forward-compatibility rules

Binding rules for any agent or human doing work in any Square Share repo before MCP
launch. Violations are review blockers, not style nits.

1. **New config fields are enum, token-referenced, or bounded-int with declared
   min/max/step.** Never a float, never a CSS length string, never a free string unless it
   is seller prose (content class), which must carry a length cap and the control-character
   pattern.
2. **Never store raw CSS, HTML, URLs, or class strings in `storefronts.config`.** Stored
   keys resolve through code-defined maps (`config-maps.ts`, `shape-specs.ts` pattern).
   This is the existing contract; keep it.
3. **Every storefront mutation must be expressible without DOM access.** If a dashboard
   interaction (drag, slider, picker) produces a config delta, that delta must round-trip
   through `storefrontConfigSchema` as plain data. No feature may exist only as a UI
   gesture.
4. **Every write path needs a non-UI equivalent.** New dashboard capabilities land as a
   server action (or route) with a Zod-validated input that a machine could call, then the
   UI calls it. Never validate only in React state.
5. **Schema changes land in `@squaresharedev/schemas` first**, then the app consumes the
   package. Until the shim swap in 3.0 lands, any edit to SQ-store's
   `src/types/storefront.ts` or `src/lib/validation/storefront.ts` MUST be mirrored into
   the package in the same working session; after the swap, edit the package only.
6. **Migrations over breaks:** follow the `parseStoredStorefrontConfig` pattern (upgrade
   old shapes on parse, optional fields for new features) so stored configs and future
   agent-written configs never become unreadable.
7. **New enums must be closed and exported as `const` arrays** (the `BLOCK_SIZES` /
   `SHAPE_KINDS` pattern) so introspection can enumerate them without reflection tricks.
8. **Asset references are minted keys, never URLs.** Any new field that points at media
   stores an ownership-checked object key produced by the presign flow.
9. **Keep server-side validation the boundary.** Client checks are UX only; every new
   action revalidates with the shared schema and re-checks ownership (the
   `productId` ownership re-check in `saveStorefront` is the model).
10. **Rate-limit every new write path** with the existing `rl_take()` Postgres limiter so
    agent traffic cannot outrun humans by accident.

---

## 5. Safety and human-in-the-loop

Classification of the tool surface. "HITL" means the MCP host must obtain explicit human
confirmation before execution; these tools are never autonomous.

| Class | Tools / operations | Policy |
|---|---|---|
| Never exposed to agents | Account creation/deletion, Stripe Connect onboarding, payout method changes, tax identity (`saveTaxInfo`), legal acceptance, team role changes | Human-only. Stripe Connect uses Stripe's HOSTED onboarding and Express dashboard by design (see the security invariants in SQ-store `src/lib/payments/mock.ts`): financial data collection never happens in Square Share UI, so it can never happen through an API we mint. KYC is legally a natural-person flow. |
| Money-touching, HITL | `checkout_session_create`; `product_update` when it changes `priceCents` or `currency` on an `active` product; `product_create` with `status: "active"` | Explicit confirmation with the concrete amount shown. Price errors are real-money errors once Stripe Connect is live (`orders.platform_fee_cents` is computed from them). |
| Irreversible, HITL | `store_delete`, `product_delete` (breaks `orders.product_id` provenance even with FK null-out), removing a `digitalFileKey` | Explicit confirmation naming the object. |
| Outward-facing, HITL | `storefront_publish` (or the first `theme_set`/`block_*` on a LIVE store while no draft model exists), `embed_configure` with `enabled: true`, product `draft -> active` | Publishing changes what buyers see; a human approves the transition, not each pixel. |
| Autonomous-safe | All reads; catalog/presentation writes to draft state; `stock_set`; `asset_upload_url` | No confirmation needed. This is why the draft model in section 6 matters: without it, every presentation write is outward-facing. |

Additional notes:

- **PII:** `orders.buyer_email` flows through `order_*` reads. Agent tokens should be able
  to opt out of (or be denied) PII scopes; default deny for third-party agents.
- **Tenancy:** every query behind the MCP must filter by the active account id explicitly,
  matching the team-access RLS model (`team_role` enum owner/editor/viewer,
  `team_role_can()` in `src/types/supabase.ts`). An agent token acts as a role, never as
  a bare connection.
- **Rate limiting:** reuse `rl_take(p_action, p_max, p_window_seconds)`; agent surfaces
  get their own action keys and tighter windows.

---

## 6. Open questions (do not resolve without human review)

1. **Which repo owns the MCP server.**
   Recommendation: a standalone Hono Worker in SQ-system (the SQ-app API Worker pattern),
   consuming `@squaresharedev/schemas` + `@squaresharedev/db` (its generic cookie-adapter
   factory already targets Hono Workers).
   Tradeoff: forces the schema unification (3.0) first and duplicates some server-action
   logic that lives in SQ-store today; the alternative (mounting MCP inside SQ-store's
   Next app) reuses `lib/*/actions.ts` directly but couples the public agent surface to
   dashboard deploys and to Next/OpenNext runtime quirks.

2. **Auth model: per-seller scoped tokens vs OAuth.**
   Recommendation: start with per-seller scoped tokens (server-minted, role-bearing,
   scope-limited: e.g. `presentation`, `catalog`, `commerce`, `orders:read-pii`), because
   the first consumers are the seller's own agents; add OAuth (authorization-code, per-app
   client) when third-party platforms integrate.
   Tradeoff: tokens are simple and shippable but put revocation/rotation UX on us; OAuth
   is the right long-term shape for Lovable-class integrators but is premature before any
   integrator exists.

3. **Do presentation tools mutate live or write to a draft?**
   Recommendation: draft state (`storefronts.config_draft` jsonb + `storefront_publish`),
   because agents iterate in many small writes and each live write is buyer-visible;
   drafts also collapse the HITL story to one confirmation at publish.
   Tradeoff: schema addition plus dashboard work (the designer must read/write the draft
   and show publish state); mutating live requires zero migration but makes every
   presentation call outward-facing and confirmation-heavy.

4. **Emit UCP manifests per hosted store?**
   Recommendation: defer until `checkout_session_create` is real, then emit; a manifest
   without a working programmatic checkout is an empty promise, and no UCP/agentic-commerce
   artifact exists in any repo today.
   Tradeoff: early manifests would make stores discoverable to shopping agents sooner, but
   they add a second public contract to keep in lockstep with the schemas package.

5. **Colour model: arbitrary hex vs palette-slot references (Debt A).**
   Recommendation: per-store palette with slot references; raw hex enters only at the
   palette. Keeps seller freedom, makes colour enumerable, and gives agents "restyle the
   store" as one coherent operation.
   Tradeoff: touches every colour field plus a `parseStoredStorefrontConfig` migration;
   staying on raw hex is zero work and still validated, but colour then stays permanently
   outside the token rule and agents must guess-and-check aesthetics per field.

6. **Who does the schema unification, and when.**
   Not optional (it gates everything), but sequencing is a human call: re-lift SQ-store's
   current types into `@squaresharedev/schemas`, publish, and switch SQ-store to the
   package. Until then this repo's published schemas are stale (3.0) and must not be
   consumed by new code as-is.

---

## Assumptions made in this document

- SQ-store's uncommitted working tree (the free-placement canvas model, including the new
  `shape-specs.ts`) is the current product truth; `@squaresharedev/schemas` v0.2.0 is
  re-lifted from it and the two must stay in lockstep from here on.
- `@squaresharedev/db` was expected to define table shapes; it does not (it exports only
  Supabase client factories and `AUTH_COOKIE_OPTIONS`). Table shapes in this document come
  from SQ-store's generated `src/types/supabase.ts` (tables: `storefronts`, `products`,
  `orders`, `profiles`, `notifications`, `team_members`). Writable-vs-derived split used:
  `storefronts.name/config` writable, `owner_id`/timestamps derived; `products.*` writable
  except `owner_id`/timestamps; `orders` entirely derived (agent-read-only);
  `profiles` partially writable (display_name, notify_*, tax_*).
- Payments are currently a mock layer (`src/lib/payments/mock.ts`) returning Stripe-shaped
  types; the Stripe Connect claims in section 5 assume the documented drop-in wiring
  happens as its comments describe.
- "UCP" is treated as the external agentic-commerce manifest standard; no reference to it
  exists in any Square Share repo, so question 6.4 cites no internal artifact.
- Product "variants" do not exist in the schema today; the catalog tool table names them
  only as a future obligation.
- The carousel (`DISPLAY_MODES`, `CarouselStrip`) shares the same block model as the grid,
  so no separate presentation tools are proposed for it.
