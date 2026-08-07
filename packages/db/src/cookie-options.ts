import type { CookieOptions } from "@supabase/ssr";

/**
 * Shared attributes for every auth cookie the server writes.
 *
 * WHY A PARENT-DOMAIN COOKIE: the session is scoped to `.squareshare.eu` so the
 * same login is valid across `dashboard.squareshare.eu` (this dashboard) and the
 * marketplace subdomains that come later. In local dev we fall back to a
 * host-only cookie (no Domain, not Secure) so `http://localhost` still works.
 *
 * WHY HttpOnly: per the project brief the session cookie is HttpOnly. That means
 * the browser JS client cannot read it, so auth is server-driven — Server
 * Components / Route Handlers / Server Actions read the session via the server
 * client (see ./server.ts). The next agent wiring auth logic should follow that
 * pattern (e.g. a `/auth/callback` route handler + server actions), not try to
 * read the session from `document.cookie`.
 *
 * INVARIANT — a cookie with a Domain attribute is ALWAYS Secure. A parent-domain
 * cookie is cross-subdomain by definition, so dropping Secure would put the
 * session token on every plaintext http:// request to any host under the domain.
 * `secure` is therefore driven by the Domain attribute as well as NODE_ENV: a
 * preview deployment that sets NEXT_PUBLIC_COOKIE_DOMAIN without an exact
 * `production` NODE_ENV cannot silently ship a non-Secure session cookie.
 * Host-only dev (no override, not prod) is the ONLY case that gets Secure=false,
 * because http://localhost needs it.
 */

const isProd = process.env.NODE_ENV === "production";

// Explicit override wins (handy for preview deployments on a different apex);
// otherwise use the shared parent domain in prod and a host-only cookie in dev.
const cookieDomain =
  process.env.NEXT_PUBLIC_COOKIE_DOMAIN ||
  (isProd ? ".squareshare.eu" : undefined);

export const AUTH_COOKIE_OPTIONS: CookieOptions = {
  domain: cookieDomain,
  path: "/",
  sameSite: "lax",
  secure: isProd || Boolean(cookieDomain),
  httpOnly: true,
};
