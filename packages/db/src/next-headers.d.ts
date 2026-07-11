// Minimal structural typing for next/headers so this package builds without
// installing Next (a heavy dev dependency for one function). Consumers of the
// "./next" entry have the real `next` installed (it's an optional peer), and
// none of these ambient shapes leak into the published .d.ts files — the
// factory's public signature only exposes @supabase/ssr types.
declare module "next/headers" {
  interface SqDbRequestCookie {
    name: string;
    value: string;
  }
  interface SqDbCookieStore {
    getAll(): SqDbRequestCookie[];
    set(name: string, value: string, options?: unknown): void;
  }
  export function cookies(): Promise<SqDbCookieStore>;
}
