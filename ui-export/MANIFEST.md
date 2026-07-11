# ui-export MANIFEST

Extracted 2026-07-11 from SQ-app @ commit `6f30559` for the Cloudflare Workers /
Hono / Supabase-auth / R2 rebuild. Every file here was copied **byte-for-byte**
from `frontend/src/` — nothing was refactored, renamed internally, or reformatted.
The single exception is `styles/tokens.css`, which is `frontend/src/index.css`
verbatim with a 12-line provenance header prepended (permitted partial extraction).

- **KEEP** = use as-is in the rebuild (after the import rewiring noted per file).
- **REFERENCE** = behavioral spec only. Do NOT ship this code; the shared grid
  package must replicate its interaction behavior exactly.

---

## npm dependencies required by the KEEP files

Versions quoted verbatim from `frontend/package.json` (the currently installed set):

| Package | Version | Why |
|---|---|---|
| `react` | `"^19.2.4"` | all components |
| `react-dom` | `"^19.2.4"` | rendering peer |
| `lucide-react` | `"^0.577.0"` | every icon in the UI |
| `clsx` | `"^2.1.1"` | `cn()` in lib/utils.ts |
| `tailwind-merge` | `"^3.5.0"` | `cn()` in lib/utils.ts |
| `tailwindcss` | `"^4.2.1"` (devDep) | all styling; tokens.css uses v4 CSS-first `@theme` |
| `@tailwindcss/vite` | `"^4.2.1"` (devDep) | Tailwind v4 Vite plugin (build-time) |
| `typescript` | `"~5.9.3"` (devDep) | all files are .ts/.tsx |

**Conditional:** `react-router-dom` `"^7.13.1"` — six KEEP files import `Link` /
`useNavigate` (see per-file entries). If the rebuild keeps react-router, install it
and these imports resolve as-is; if it uses a different router, those imports are
rewiring points instead.

**NOT needed by KEEP files** (used only by REFERENCE code): `@dnd-kit/core`
`"^6.3.1"`, `@tanstack/react-query` `"^5.90.21"`. (`@dnd-kit/sortable` and
`@dnd-kit/utilities` are installed in SQ-app but imported nowhere — do not carry
them over.)

**Being replaced wholesale, do NOT install:** `firebase` (only `components/AuthPage.tsx`
references it; see its entry).

---

## Global rewiring notes (apply to every file)

1. **`@/` path alias.** All internal imports use Vite's `@/` → `frontend/src/`
   alias. In the rebuild, remap: `@/lib/*` → `ui-export/lib/*`, `@/types` →
   `ui-export/types`, `@/components/*` and `@/pages/*` → `ui-export/components/*`
   (pages were flattened into `components/`). Every such import resolves inside
   this folder unless a file's entry lists it under "imports it loses."
2. **`@/services/api` is NOT included** (Express/Firebase-era service layer).
   Files that import it list exactly which symbols they use and the DTO shapes
   those symbols returned, so the rebuild's typed API client (Hono RPC / shared
   schemas package) can satisfy the same contract. Old DTO shapes for reference:
   - `ArtifactDTO`: `{ id, userId, collectionId: string|null, title, description, imageUrl, gridX, gridY, spanW, spanH, imgOffsetX, imgOffsetY, sortOrder, createdAt, updatedAt }`
   - `CollectionDTO`: `{ id, name, isPublic, sortOrder, createdAt, updatedAt }`
   - `UserDTO`: `{ id, username, email, profilePicUrl: string|null, isPublic, createdAt }`
   - `SearchResult`: `{ users: {id, username, profilePicUrl, isPublic}[], collections: {id, name, ownerUsername}[] }`
   - `PublicProfile`: `{ id, username, profilePicUrl, isPublic, collections: {id, name, artifacts: PublicProfileArtifact[]}[] }`
   - `PublicProfileArtifact`: `{ id, title, description, imageUrl, gridX, gridY, spanW, spanH, imgOffsetX, imgOffsetY }`
3. **CSS class contract.** `tokens.css` defines `.spinner`, `.btn-upload-loader`,
   `.animate-progress-bar`, `--grid-columns` / `--grid-gap` / `--grid-cell-size`
   custom properties, and the safe-area vars. GridLoader, Toast, AuthPage,
   SettingsPage, ArtifactModal, and the grid code depend on these classes/vars
   existing — ship tokens.css before anything else.
4. **The crop/offset system contract** (must survive the rebuild intact):
   an artifact's framing is `imgOffsetX` / `imgOffsetY` (0–100 percentages,
   default 50/50) rendered as
   `transform-origin: {x}% {y}%; transform: scale(1.5)` on an
   `object-fit: cover` image. ArtifactCard (edit), ArtifactDetailModal (view),
   and PublicCollectionPage (reference, view) all use this exact formula.

---

## ui-export/components/ — KEEP

### components/ArtifactCard.tsx — KEEP
- Was `frontend/src/components/ArtifactCard.tsx`.
- The visual container for one grid artifact: image fill, hover gradient metadata
  overlay, delete/like/report controls, resize handle, and the **double-click
  pan mode** that edits `imgOffsetX/Y` by dragging (Escape or outside-click commits).
- **Imports it loses:**
  - `./Resizer` — now lives in `reference/Resizer.tsx`. The shared grid package
    must provide the replacement resize control; until then this import dangles by design.
  - (`@/types` `GridItem` and `@/lib/*` resolve in-export.)
- Hardcoded: `scale(1.5)` pan-zoom factor; offset default `50`; 250 ms
  single-vs-double-click timer; 640 px image variant width; pan clamps offsets to 0–100.

### components/ArtifactModal.tsx — KEEP
- Was `frontend/src/components/ArtifactModal.tsx`.
- "Add Artifact" form: file upload → canvas downscale/compress → ImageCropper →
  title/description → submit with upload progress + moderation-error display.
- **Imports it loses:** none — `./ImageCropper`, `@/lib/utils` resolve in-export.
  `onSubmit` hands back `(title, description, imageUrl-as-dataURL, colSpan, rowSpan)`;
  the caller owns the actual upload (was GridCanvas → api.ts; will be the new
  R2 upload path).
- Hardcoded: 2000 px max dimension client-side downscale, JPEG quality 0.85
  (comment cites a 5 MB server body limit — revisit for Workers' limits);
  fallback image `https://placehold.co/480x480/000/fff?text=...`; expands from
  `max-w-md` to `max-w-2xl` while cropping.

### components/ArtifactDetailModal.tsx — KEEP
- Was `frontend/src/components/ArtifactDetailModal.tsx`.
- Detail/lightbox modal: eager large image with offset framing, inline
  title/description editing when `isOwner`.
- **Imports it loses:** none. Receives a plain `{ id, title, description,
  imageUrl, imgOffsetX, imgOffsetY }` object (own local interface, deliberately
  decoupled) — will receive the typed row from the shared schemas package.
- Hardcoded: `scale(1.5)` + offset transform (crop system contract); 1280 px
  image width; desktop popup vs. mobile fullscreen at `max-md`.

### components/SmartImage.tsx — KEEP
- Was `frontend/src/components/SmartImage.tsx`.
- Drop-in `<img>` replacement: transformed URL + 2× srcset, lazy load, skeleton
  pulse, cross-fade on decode.
- **Imports it loses:** none (`@/lib/image`, `@/lib/utils` in-export).
- Hardcoded: default width hint 480. Note: currently imported by **no other
  keeper** (ArtifactCard inlines its own img) — kept because it's the intended
  generic image primitive for the rebuild.

### components/Toast.tsx — KEEP
- Was `frontend/src/components/Toast.tsx`.
- ToastProvider/useToast context + toast stack: default/success/error variants and
  a `progressToast` (spinner + indeterminate bar) that resolves to success/error.
- **Imports it loses:** none.
- Hardcoded: 3000 ms auto-dismiss; z-index 9999; depends on `.btn-upload-loader`
  and `.animate-progress-bar` from tokens.css.

### components/GridLoader.tsx — KEEP
- Was `frontend/src/components/GridLoader.tsx`.
- Minimal circular spinner (kept under the legacy GridLoader name).
- **Imports it loses:** none. Depends on `.spinner` class from tokens.css.

### components/ErrorBoundary.tsx — KEEP
- Was `frontend/src/components/ErrorBoundary.tsx`.
- Class-component error boundary with recoverable fallback (Try again / Go home).
- **Imports it loses:** none. `window.location.assign("/")` assumes `/` is home.
  `componentDidCatch` logs to console — wire to the rebuild's error reporter.

### components/ImageCropper.tsx — KEEP
- Was `frontend/src/components/ImageCropper.tsx`.
- The grid-aligned cropper: resize mode (drag edges/corners, snaps to grid cells)
  and pan mode (double-click toggle; drag image inside locked frame), pinch-to-zoom,
  wheel-zoom (native non-passive listener), zoom slider, offscreen-canvas crop that
  inverts the CSS transform math. Output: `(dataURL JPEG, colSpan, rowSpan)`.
- **Imports it loses:** none (react + lucide + cn only). Fully portable.
- Hardcoded: `MAX_CROP_COLS = 6`; zoom 1–4 (`ZOOM_STEP` 0.01, wheel factor 0.002);
  12 px edge hit-test zone; JPEG quality 0.92; 240 px placeholder height pre-load.

### components/CollectionGridPreview.tsx — KEEP *(uncertainty flagged)*
- Was `frontend/src/components/CollectionGridPreview.tsx`.
- Static 16:9 mini-map of a collection: renders artifacts at their
  `gridX/gridY/spanW/spanH` coordinates in a 12-col CSS grid, 2 px gaps.
- **Imports it loses:** none — defines its own `GridPreviewArtifact` input shape
  `{ id, imageUrl, gridX, gridY, spanW, spanH }`; will receive typed rows from
  the shared schemas package.
- **Uncertainty:** it statically renders the coordinate system, so if the shared
  grid package ships its own read-only/preview renderer this file becomes
  REFERENCE. Kept because it is pure presentation with zero interaction code.
- Hardcoded: `PREVIEW_COLS = 12`, `PREVIEW_GAP = 2`, min rows = 16:9 of 12 cols;
  240 px image variant.

### components/MobileCollectionSheet.tsx — KEEP *(uncertainty flagged)*
- Was `frontend/src/components/MobileCollectionSheet.tsx`.
- Mobile bottom sheet listing collections + inline create; safe-area padding,
  Escape-to-close, skeleton loading rows.
- **Imports it loses:** `@/services/api` — `collectionApi.list()`,
  `collectionApi.create(name)` and the `CollectionDTO` type. Needs the rebuild's
  collections client returning `{ id, name, isPublic }` rows; alternatively lift
  the fetching out and pass collections as props.
- **Uncertainty:** data fetching is inline rather than prop-driven — flagged, not
  refactored (rule: no refactors). The sheet/markup/interaction design is the keeper.
- Hardcoded: `max-h-[70dvh]`, `env(safe-area-inset-bottom)` padding.

### components/Sidebar.tsx — KEEP *(uncertainty flagged)*
- Was `frontend/src/components/Sidebar.tsx`.
- Desktop hover-expanding sidebar (60 px → 240 px): brand, Profile/Settings nav,
  collection pills with inline rename + per-pill dropdown (add artifact / rename /
  duplicate / share / delete), user chip, logout.
- **Imports it loses:** `@/services/api` — `collectionApi.list/create/update/remove`.
  Same replacement as MobileCollectionSheet. (`@/components/Toast` resolves in-export.)
- Hardcoded: `COLLAPSED_W = 60`, `EXPANDED_W = 240`; brand mark `SS` /
  "SquareShare"; share URL pattern `${window.location.origin}/${username}/${encodeURIComponent(collectionName)}`
  — must match the rebuild's public-route scheme; "Duplicate" and "Delete" menu
  items are visual stubs (close the menu, no action); `hidden md:flex` (desktop only).

### components/AuthPage.tsx — KEEP *(uncertainty flagged)*
- Was `frontend/src/pages/AuthPage.tsx`.
- Login/Sign-up screen: pill mode toggle, email/username + password, show-password
  eye, confirm-password + debounced username-availability indicator on signup,
  error panel, Google button with inline SVG logo, legal links.
- **Imports it loses (the big one):**
  - `firebase/auth` (signIn/createUser/GoogleAuthProvider/signInWithPopup/linkWithCredential/EmailAuthProvider) and `@/lib/firebase` (`auth`) — the whole auth flow is rewritten
    against **Supabase auth** (`signInWithPassword` / `signUp` / `signInWithOAuth`).
    All `auth/...` error-code string matching in `handleSubmit`/`handleGoogleSignIn`
    is Firebase-specific and must be remapped to Supabase error semantics.
  - `@/services/api` — `userApi.checkUsername`, `userApi.setUsername`,
    `authApi.resolveUsername` (username → email for login), `setAuthToken`.
  - `react-router-dom` — `Link` to `/community-guidelines`, `/privacy-policy`
    (conditional dep, see top).
  - (`@/types` `AuthFormState` resolves in-export.)
- **Keep the markup/design; treat every handler body as rewrite-target.**
- Hardcoded: username rule `^[a-zA-Z0-9_]{3,30}$`; min password 8 (one error
  string says 6 — pre-existing inconsistency, left as-is); 400 ms availability
  debounce; brand copy "Your minimalist artifact archive."

### components/NotFoundPage.tsx — KEEP
- Was `frontend/src/pages/NotFoundPage.tsx`.
- 404 screen with optional custom message, Go back / Go home.
- **Imports it loses:** `react-router-dom` (`useNavigate`) — conditional dep.
  (`@/lib/seo` resolves in-export.)

### components/ProfilePage.tsx — KEEP *(uncertainty flagged)*
- Was `frontend/src/pages/ProfilePage.tsx`. Two exports:
  1. `ProfilePage` — search bar with debounced @user/collection results dropdown,
     profile header (avatar upload+crop, inline name edit), pinned-first
     collection card grid using CollectionGridPreview.
  2. **`ProfilePicCropModal`** — part of the kept crop system: circular profile-pic
     crop with pan (pointer capture) + wheel/slider zoom, SVG circle-cutout
     overlay, canvas export that inverts the object-fit:cover + translate/scale
     math. Also imported by SettingsPage.
- **Imports it loses:**
  - `@/services/api` — `userApi.me/updateProfilePic/publicProfile`,
    `collectionApi.list`, `artifactApi.list(colId)` (per-collection preview data),
    `searchApi.query`, plus `CollectionDTO`/`ArtifactDTO`/`SearchResult` types.
  - `react-router-dom` (`useNavigate` to `/${username}` and
    `/${username}/${collectionName}`) — conditional dep.
- **Uncertainty:** heavy inline data-fetching/refresh logic (first-activation
  loader, silent background refresh) is entangled with the presentation; kept
  whole rather than split.
- Hardcoded: localStorage key `ss-pinned-collections`; 2 MB profile-pic limit;
  300 ms search / 1000 ms loader-delay timers; `ProfilePicCropModal`:
  `CROP_SIZE = 280`, zoom 1–4, 512 px WebP output at quality 0.9.

### components/PublicProfilePage.tsx — KEEP
- Was `frontend/src/pages/PublicProfilePage.tsx`.
- Public profile view: back button, avatar/username header, private-account state,
  public collection card grid, Follow button (local-only stub + toast), copy-link
  button. Sets OG/SEO meta via `useDocumentMeta`.
- **Imports it loses:**
  - `@/services/api` — `userApi.publicProfile(username)` returning `PublicProfile`.
  - `react-router-dom` (`useNavigate`) — conditional dep.
  - (Toast, GridLoader, CollectionGridPreview, NotFoundPage, lib/seo all resolve
    in-export; note NotFoundPage import path is `@/pages/NotFoundPage` → remap to
    `components/NotFoundPage`.)
- Hardcoded: Follow button is a UI stub ("Backend not wired yet" — still true).

### components/SettingsPage.tsx — KEEP
- Was `frontend/src/pages/SettingsPage.tsx`.
- Full settings surface: 9 tabs (Profile, Achievements, Appearance, Notifications,
  Security, Help, Advanced, Community Guidelines, Privacy Policy) plus reusable
  FieldGroup/TextInput/Toggle/SaveButton primitives worth harvesting.
- **Imports it loses:**
  - `@/services/api` — `userApi.me/checkUsername/setUsername/updateUsername/updateProfilePic/updatePrivacy`.
  - (`./ProfilePage` → `ProfilePicCropModal` resolves in-export; Toast resolves in-export.)
- Hardcoded / content notes:
  - localStorage keys: `allgrid-theme`, `allgrid-density`, `ss-notif-email`,
    `ss-notif-digest`, `ss-notif-achievements`.
  - Appearance tab toggles `light`/`dark` classes on `<html>` — but tokens.css has
    **no dark theme tokens**; dark mode is currently cosmetic-only.
  - Grid density writes `--grid-gap` (8/12/20 px) and Advanced tab writes
    `--grid-columns` / `--grid-cell-size` directly on `documentElement` — this is
    the runtime contract with the grid CSS vars.
  - Random-username heuristic: `user_` prefix + total length 13 ⇒ first-time
    `setUsername` vs `updateUsername`.
  - `mailto:support@allgrid.app`; Achievements/password-change/export are stubs.
  - Guidelines/Privacy tab copy mentions Firebase Auth, Supabase Storage, Gemini
    moderation — **copy needs updating for the new stack** (do it in the rebuild,
    not here).

### components/CommunityGuidelinesPage.tsx — KEEP
- Was `frontend/src/pages/CommunityGuidelinesPage.tsx`.
- Standalone legal page (same copy as the Settings tab).
- **Imports it loses:** `react-router-dom` (`Link to="/"`) — conditional dep.
- Content note: mentions Google Gemini moderation — verify still true in rebuild.

### components/PrivacyPolicyPage.tsx — KEEP
- Was `frontend/src/pages/PrivacyPolicyPage.tsx`.
- Standalone privacy policy page.
- **Imports it loses:** `react-router-dom` (`Link to="/"`) — conditional dep.
- Content note: claims "Supabase-hosted PostgreSQL / Supabase Storage" and
  "Firebase Authentication" — storage becomes R2, auth becomes Supabase; update
  copy in the rebuild.

---

## ui-export/lib/ — KEEP

### lib/utils.ts — KEEP
- Was `frontend/src/lib/utils.ts`. The `cn()` clsx + tailwind-merge helper.
  Imported by nearly every component. No losses.

### lib/image.ts — KEEP
- Was `frontend/src/lib/image.ts`. `transformImage()` / `buildSrcSet()` — the
  responsive-image URL layer used by ArtifactCard, ArtifactDetailModal,
  SmartImage, CollectionGridPreview, and the reference grid.
- **Imports it loses:** none, but it is **Supabase-Storage-specific**: it rewrites
  `/storage/v1/object/public/` URLs to `/storage/v1/render/image/public/` and
  gates on `import.meta.env.VITE_ENABLE_IMAGE_TRANSFORMS === "true"` (env var
  name only — no secret values in the file). With R2 the function bodies must be
  re-targeted (e.g. Cloudflare Image Resizing `/cdn-cgi/image/...` URLs) while
  **keeping the call-sites' contract**: `transformImage(url, {width})` +
  `buildSrcSet(url, cssWidth)` returning 1x/2x, no-op pass-through for foreign URLs.
- Hardcoded: width ladder `[120, 240, 360, 480, 640, 800, 1024, 1280, 1600, 1920]`;
  default quality 75; default resize `cover`.

### lib/seo.ts — KEEP
- Was `frontend/src/lib/seo.ts`. `useDocumentMeta()` — imperative
  title/OG/twitter/canonical tag sync, no dependencies beyond react.
- **Imports it loses:** none.
- Hardcoded: `DEFAULT_TITLE = "SquareShare"`, default description "Curate the
  things you love on a personal grid."; title pattern `{page} · SquareShare`.

---

## ui-export/types/ — KEEP

### types/index.ts — KEEP
- Was `frontend/src/types/index.ts` (folder added beyond the prescribed
  substructure to preserve the filename verbatim; imports referenced it as `@/types`).
- Pure client-side view-state types: `GridItem`, `GridPosition` (col/row/colSpan/rowSpan,
  1-based), `Artifact` (includes `imgOffsetX/Y`), `SPAN_PRESETS` map
  (1x1/2x1/1x2/2x2/4x2/3x3), `AuthFormState`, misc.
- **Imports it loses:** none.
- Note: in the rebuild these should be derived from the shared schemas package;
  the coordinate vocabulary here (`col/row/colSpan/rowSpan` client-side vs
  `gridX/gridY/spanW/spanH` on the wire) is the mapping the grid package must honor.

---

## ui-export/styles/ — KEEP

### styles/tokens.css — KEEP
- Source: `frontend/src/index.css` lines 1–159 (the entire file), byte-exact
  below the added 12-line header.
- Contains: Tailwind v4 `@theme` (Swiss-minimalist palette, `--grid-columns: 12`,
  `--grid-gap: 12px`, `--grid-cell-size: 120px`, radii, Helvetica stack, shadow,
  duration tokens); base resets incl. iOS tap/zoom fixes; safe-area vars
  (`--safe-top/bottom/left/right`); `.btn-upload-loader` (conic-gradient square
  spinner — its `::after` uses `--color-foreground` as fill);
  `.animate-progress-bar` (8 s ease-out); `.spinner`; thin scrollbars ≤640 px;
  responsive grid overrides (≤768 px → 6 cols/6 px gap, ≤480 px → 4 cols/4 px gap).
- Keeps the `@import "tailwindcss";` line — this file is the app's stylesheet
  entry, not a fragment.

---

## ui-export/reference/ — REFERENCE ONLY (behavioral spec for the shared grid package — do not ship)

### reference/GridCanvas.tsx — REFERENCE
- Was `frontend/src/components/GridCanvas.tsx`. **The core spec.** Behaviors the
  shared grid package must replicate:
  - Square-cell geometry: `cellSize = (containerWidth − (cols−1)·gap) / cols`,
    with `cols`/`gap` read live from `--grid-columns`/`--grid-gap` (so the
    responsive overrides and the Settings density control keep working);
    ResizeObserver recompute.
  - dnd-kit `DndContext` + `DragOverlay`: PointerSensor with 5 px activation
    distance (click vs drag disambiguation), KeyboardSensor; dragged item dims to
    0.25 opacity while a floating overlay card follows the cursor.
  - Drop math: delta → col/row offset via `Math.round(delta / (cellSize + gap))`,
    clamped to grid bounds (rows unbounded downward).
  - **Displacement:** overlapped items move to the nearest free slot by Manhattan
    distance from their original position (row-scan with early exit).
  - `findOpenSlot(w, h)`: first-fit scan, row-major, for new artifacts.
  - Rows: `max(6, maxOccupiedRow + 2)`; dashed background cells under items.
  - Optimistic updates: query-cache write + local mirror before mutation
    (batch position update on drop/resize; single update for offset/detail edits).
  - Header (title + Add Artifact + share + settings-popover with public/private
    toggle), empty states (no collection selected vs empty collection),
    upload progress/moderation-error toasts.
- Imports lost with it: `@/services/api`, `@/hooks/useArtifacts` (see below),
  `@tanstack/react-query`, `@dnd-kit/core`; renders KEEP components
  (ArtifactCard/ArtifactModal/ArtifactDetailModal/Toast).
- Hardcoded: DEMO_ITEMS fallback seed data (placehold.co URLs) shown when the
  API is unreachable; MIN_ROWS 6; `max-w-[1440px]` lives in GridPage.

### reference/SortableArtifact.tsx — REFERENCE
- Was `frontend/src/components/SortableArtifact.tsx`. dnd-kit `useDraggable`
  wrapper mapping `position` → `grid-column/grid-row: X / span N`, drag styling
  (opacity 0.25, grab/grabbing cursors, zIndex 1). Exports `DraggableArtifact`
  (+ legacy `SortableArtifact` alias).

### reference/Resizer.tsx — REFERENCE
- Was `frontend/src/components/Resizer.tsx`. The span-preset picker pill
  (bottom-right of each card): popover listing `SPAN_PRESETS` from
  `types/index.ts` (1×1, 2×1, 1×2, 2×2, 4×2, 3×3), outside-click close,
  active-preset highlight. The grid package's resize affordance must offer
  equivalent behavior. Note: ArtifactCard (KEEP) imports `./Resizer` — the
  package's replacement control plugs into that slot.

### reference/GridPage.tsx — REFERENCE
- Was `frontend/src/pages/GridPage.tsx`. Trivial wrapper: `mx-auto max-w-[1440px]`
  container around GridCanvas + prop pass-through. Kept as reference for the
  page-level sizing constraint.

### reference/PublicCollectionPage.tsx — REFERENCE *(judgment call)*
- Was `frontend/src/pages/PublicCollectionPage.tsx`. The **read-only** rendering
  of the coordinate grid: same cell-size computation from CSS vars as GridCanvas,
  same dashed background cells, `ArtifactReadOnly` renders artifacts at
  `gridX/gridY/spanW/spanH` with the offset transform (`transform-origin:
  {x}% {y}%; scale(1.5)`) and hover metadata overlay — this is the viewer half
  the grid package must also produce.
- Classified REFERENCE because it re-implements the grid; its page chrome
  (back-to-@user header, CopyLinkButton, ArtifactDetailModal in viewer mode,
  `useDocumentMeta` OG image = first artifact) is keep-worthy design — rebuild it
  on top of the grid package rather than reusing this file.
- Imports lost with it: `@/services/api` (`userApi.publicProfile`), react-router.
  Collection lookup is by case-insensitive name match against the URL slug.

### reference/useArtifacts.ts — REFERENCE *(judgment call)*
- Was `frontend/src/hooks/useArtifacts.ts`. TanStack Query hooks for the old
  Express API — being replaced wholesale. Included as reference for two contracts:
  1. **Wire ↔ view mapping:** `gridX/gridY/spanW/spanH` + `imgOffsetX/Y ?? 50`
     ↔ `position{col,row,colSpan,rowSpan}` + artifact fields; lists sorted by
     `sortOrder` (batch updates persist array index as `sortOrder`).
  2. Cache/invalidations pattern (`staleTime` 30 s, invalidate-all on mutate)
     that GridCanvas's optimistic updates assume.

---

## Deliberately excluded (rebuild replaces wholesale — do not port)

- `frontend/src/lib/firebase.ts` (Firebase config/SDK init)
- `frontend/src/services/api.ts` (Express API client; DTO shapes summarized above)
- `frontend/src/App.tsx`, `main.tsx` (routing/auth shell), `frontend/index.html`
- `frontend/src/components/index.ts` (barrel re-exporting a mix of KEEP and
  REFERENCE files — recreate as needed in the rebuild)
- `frontend/src/assets/*` (no keeper file imports any asset)
- All of `backend/`, Prisma schema, auth/moderation middleware
