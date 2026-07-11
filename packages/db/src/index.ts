// @squaresharedev/db — Supabase client factories + the session cookie contract.
//
// Entries:
// - "@squaresharedev/db"          (this file): AUTH_COOKIE_OPTIONS + the generic
//                              adapter-based server factory (Hono Worker etc.).
// - "@squaresharedev/db/next":    Next.js App Router server factory (next/headers).
// - "@squaresharedev/db/browser": createBrowserClient wrapper.
//
// Deliberately absent: any service-role helper — service keys stay app-side.

export { AUTH_COOKIE_OPTIONS } from "./cookie-options.js";
export {
  createSupabaseServerClient,
  type CookieAdapter,
  type CookiePair,
  type CookieToSet,
} from "./generic.js";
