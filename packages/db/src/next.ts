import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { AUTH_COOKIE_OPTIONS } from "./cookie-options.js";
import type { CookieToSet } from "./generic.js";

// The Next.js (App Router) flavor — SQ-store's lib/supabase/server.ts pattern:
// an async factory that binds createServerClient to next/headers cookies with
// AUTH_COOKIE_OPTIONS. Server-only (Server Components / Route Handlers /
// Server Actions); the matching browser client lives in "@squaresharedev/db/browser".
//
// `next` is an optional peer dependency — only this "./next" entry touches it.

/**
 * Create the request-scoped server client. Call per request (never cache it
 * across requests). url/key default to the standard Next public env vars.
 */
export async function createSupabaseServerClient<Database = any>(
  supabaseUrl?: string,
  supabaseAnonKey?: string,
) {
  const url = supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = supabaseAnonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "@squaresharedev/db/next: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, or pass supabaseUrl/supabaseAnonKey explicitly.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where Next forbids cookie writes.
          // Safe to ignore when middleware refreshes the session.
        }
      },
    },
  });
}
