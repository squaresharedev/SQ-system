# SQ-system

pnpm workspace publishing the shared SquareShare packages to GitHub Packages
under the `@squaresharedev` scope. Consumed by **SQ-store** (Next.js App Router on
Cloudflare Workers via OpenNext) and **SQ-app** (Vite React SPA + Hono API
Worker).

| Package | What it is |
|---|---|
| `@squaresharedev/tokens` | Brand/semantic design tokens (Tailwind v4 `@theme` CSS incl. the `--radius: 0rem` square-corner identity) + the shared control-style class constants (sharp-corner CTA rule). |
| `@squaresharedev/grid` | The bento grid, two modes: **flow** (SQ-store's auto-placed grid, lifted verbatim) and **positioned** (explicit `gridX/gridY/spanW/spanH` coordinates, replicating the old SQ-app grid canvas). Ships `styles.css`. |
| `@squaresharedev/schemas` | Domain types + Zod v4 schemas: `StorefrontConfig` (+ its validation mirror) and the new `Artifact` / `Collection` app domain. |
| `@squaresharedev/db` | Supabase client factories on `@supabase/ssr` + `AUTH_COOKIE_OPTIONS` (the `.squareshare.eu` session cookie contract). |

`store-export/` and `ui-export/` are the read-only source inputs the packages
were lifted from — do not edit or import them.

## Consuming the packages

GitHub Packages requires authentication even for reads. Create a **classic
personal access token** with the `read:packages` scope
(GitHub → Settings → Developer settings → Personal access tokens), then in the
consuming repo add a `.npmrc` with the two lines below and export the token as
`GITHUB_TOKEN` in your shell/CI (or paste it in your user-level `~/.npmrc`
instead of the env reference — never commit a token):

```ini
@squaresharedev:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Then `pnpm add @squaresharedev/tokens @squaresharedev/grid @squaresharedev/schemas @squaresharedev/db`.

> **Scope note:** GitHub Packages only accepts a scoped package when the scope
> matches the owner of the repo it's published from — this repo lives under
> `squaresharedev`, so the packages are scoped `@squaresharedev/*` to match.

### Peer dependencies

Install alongside, per package used: `@squaresharedev/grid` → `react`,
`react-dom`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`,
`lucide-react`. `@squaresharedev/schemas` → `zod@^4`. `@squaresharedev/db` →
`@supabase/ssr` (plus `next` when using the `/next` entry).

## Usage

### @squaresharedev/tokens

```css
/* app entry css (Tailwind v4) */
@import "tailwindcss";
@import "@squaresharedev/tokens/tokens.css";
/* If your app drives dark mode off the .dark class, declare the variant
   in YOUR entry (not the package): */
@custom-variant dark (&:is(.dark *));
```

```ts
import { primaryButtonClass, fieldBaseClass } from "@squaresharedev/tokens";
```

Grid CSS vars are NOT in tokens — they ship with the grid package. SQ-store
keeps its app-specific `--grid-gap: 0.5rem` and `--spacing-tile-row` @theme
lines app-side.

### @squaresharedev/grid

```css
@import "@squaresharedev/grid/styles.css";
```

Because the flow-mode `Grid` uses Tailwind utility classes, Tailwind v4
consumers must let Tailwind scan the package dist:

```css
@source "../node_modules/@squaresharedev/grid/dist";
```

Flow mode (SQ-store — drop-in for the old `components/grid` imports):

```tsx
import { Grid, useGridLayout } from "@squaresharedev/grid";
```

Positioned mode (SQ-app):

```tsx
import {
  PositionedGrid, SpanPresetPicker, findOpenSlot, readGridColumns,
  imageFramingStyle, type PositionedBlock,
} from "@squaresharedev/grid";

<PositionedGrid
  blocks={blocks}
  editable
  onBlocksChange={(next) => {
    setCacheOptimistically(next);                    // cache write first…
    persistBatch(next.map((b, i) => ({ ...wire(b), sortOrder: i }))); // …then mutate
  }}
  renderBlock={(block, state) => (
    <ArtifactCard block={block} dimmed={state.isDragging} hideControls={state.isOverlay}
      resizer={<SpanPresetPicker spanW={block.spanW} spanH={block.spanH} onChange={state.resize} />} />
  )}
/>

// creating a new artifact:
const slot = findOpenSlot(blocks, readGridColumns(), spanW, spanH);
```

The geometry contract: positioned mode reads `--grid-columns` / `--grid-gap`
off `document.documentElement` (px/unitless values — they're parsed with
`parseInt`). Package defaults (12 cols / 12px gap / 6-col and 4-col responsive
overrides) are declared at zero specificity, so any app `@theme`/`:root` value
or a runtime `documentElement.style.setProperty(...)` (the Settings density
control) overrides them.

### @squaresharedev/schemas

```ts
import { storefrontConfigSchema, parseStoredStorefrontConfig } from "@squaresharedev/schemas";
// SQ-store passes its app-side legacy gradient map for v1 config upgrades:
parseStoredStorefrontConfig(raw, LEGACY_BACKGROUND_GRADIENTS);

import { artifactSchema, collectionSchema, artifactPlacementBatchSchema } from "@squaresharedev/schemas";
```

### @squaresharedev/db

```ts
// Next.js server code (Server Components / Route Handlers / Actions):
import { createSupabaseServerClient } from "@squaresharedev/db/next";
const supabase = await createSupabaseServerClient(); // NEXT_PUBLIC_* env defaults

// Browser (any app; note the session cookie is HttpOnly — server-driven auth):
import { createSupabaseBrowserClient } from "@squaresharedev/db/browser";
const supabase = createSupabaseBrowserClient(url, anonKey);

// Hono Worker (generic cookie adapter):
import { createSupabaseServerClient } from "@squaresharedev/db";
import { getCookie, setCookie } from "hono/cookie";
const supabase = createSupabaseServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  getAll: () => Object.entries(getCookie(c)).map(([name, value]) => ({ name, value })),
  setAll: (cookies) => cookies.forEach(({ name, value, options }) => setCookie(c, name, value, options)),
});
```

`AUTH_COOKIE_OPTIONS` (exported from the root entry) is the single source of
session-cookie truth (`.squareshare.eu` parent-domain in prod, host-only in
dev, HttpOnly). It reads `process.env` at module load — fine in Next, Node,
and Workers with `nodejs_compat`; don't import the root entry in browser
bundles (use `/browser`). No service-role helper ships here by design.

## Development

```sh
pnpm install
pnpm build        # tsc for all packages → dist/ (ESM + .d.ts)
```

## Publishing

1. Bump the version in all four `packages/*/package.json` (kept in lockstep).
2. Commit, tag `vX.Y.Z`, push the tag.
3. `.github/workflows/publish.yml` builds everything and runs
   `pnpm -r publish` against GitHub Packages using the workflow's
   `GITHUB_TOKEN` (no PAT needed on the publish side).
