// @squaresharedev/schemas — shared domain types + Zod schemas.
//
// - storefront.ts: the StorefrontConfig contract (SQ-store), exported as-is.
// - storefront-validation.ts: its Zod mirror (the security contract).
// - app.ts: the SQ-app domain (Artifact / Collection wire schemas).
// - agent-meta.ts: the agent-surface introspection layer (field metadata,
//   enum catalog, JSON Schema derivation — see docs/agent-surface.md §3.3).

export * from "./storefront.js";
export * from "./storefront-validation.js";
export * from "./app.js";
export * from "./agent-meta.js";
