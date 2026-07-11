import { createBrowserClient } from "@supabase/ssr";

// The browser flavor (SQ-store's lib/supabase/client.ts pattern). Note the
// session cookie is HttpOnly (see cookie-options.ts): browser JS cannot read
// or write it, so this client is for anon/public reads and client-side auth
// flows that round-trip through the server — auth state itself is server-driven.
//
// Explicit url/key params: Next apps pass their NEXT_PUBLIC_* values, Vite
// apps their import.meta.env.VITE_* values — the package never reads env.

export function createSupabaseBrowserClient<Database = any>(
  supabaseUrl: string,
  supabaseAnonKey: string,
) {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
