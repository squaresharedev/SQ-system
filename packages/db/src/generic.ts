import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { AUTH_COOKIE_OPTIONS } from "./cookie-options.js";

// The runtime-agnostic server-client factory: the caller supplies how cookies
// are read from / written to ITS request context, and gets back a Supabase
// client whose auth cookies always carry AUTH_COOKIE_OPTIONS (the shared
// `.squareshare.eu` session contract).
//
// This is the flavor a Hono Worker uses — wire the adapter to hono/cookie:
//
//   import { getCookie, setCookie } from "hono/cookie";
//   const supabase = createSupabaseServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
//     getAll: () =>
//       Object.entries(getCookie(c)).map(([name, value]) => ({ name, value })),
//     setAll: (cookies) => {
//       for (const { name, value, options } of cookies)
//         setCookie(c, name, value, options);
//     },
//   });
//
// No service-role helper lives here on purpose: service keys stay app-side.

/** One cookie as @supabase/ssr exchanges them with the adapter. */
export interface CookiePair {
  name: string;
  value: string;
}

export interface CookieToSet extends CookiePair {
  /** Merged attributes (AUTH_COOKIE_OPTIONS + supabase's own maxAge etc.). */
  options: CookieOptions;
}

/** How the host runtime reads/writes cookies on the current request. */
export interface CookieAdapter {
  getAll(): CookiePair[] | Promise<CookiePair[]>;
  setAll(cookies: CookieToSet[]): void | Promise<void>;
}

/**
 * Create a server-side Supabase client bound to the caller's cookie adapter.
 * Explicit url/key params — apps own their env access (process.env vs Worker
 * bindings vs import.meta.env), the package never reads env for credentials.
 */
export function createSupabaseServerClient<Database = any>(
  supabaseUrl: string,
  supabaseAnonKey: string,
  cookies: CookieAdapter,
) {
  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies,
  });
}
