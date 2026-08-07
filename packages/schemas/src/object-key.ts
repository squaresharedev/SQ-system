import { z } from "zod";

// The R2 object-key contract — the single owner of "what a valid asset
// reference looks like", shared by every schema that stores one (product
// media, storefront background images, artifact images).
//
// Keys are MINTED SERVER-SIDE by the presign flow as
// `{prefix}/{ownerId}/{uuid}-{sanitizedName}`. They are never accepted raw
// from a client: per docs/agent-surface.md ("Debt C" / binding rule 8), asset
// references are minted keys, never URLs, and no write path may accept a key
// it did not mint.
//
// The owner id is embedded in the key's second segment, which is what makes
// `isObjectKeyOwnedBy` possible — and necessary. The regex constrains SHAPE
// only; it cannot tell you whose object it is. A well-formed key naming
// another creator's id passes the regex and must still be rejected by the
// caller. Always pair the schema parse with an ownership check against the
// session user before the key is trusted or persisted.

/** Prefixes the presign flow is allowed to mint under. */
export const OBJECT_KEY_PREFIXES = ["images", "files"] as const;

/**
 * A minted R2 object key: `{images|files}/{ownerUuid}/{uuid}-{sanitizedName}`.
 * Lowercase-hex UUIDs; the trailing name is already sanitized server-side to
 * `[A-Za-z0-9._-]`, so this rejects path traversal, absolute URLs, query
 * strings, and anything else a client might try to smuggle through.
 */
export const OBJECT_KEY_PATTERN =
  /^(images|files)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[A-Za-z0-9._-]{1,200}$/;

/** Belt-and-braces length cap. The pattern already bounds a key to ~281
 *  characters; this stops a pathological input before the regex runs. */
export const OBJECT_KEY_MAX = 600;

/** Any minted object key, either prefix. */
export const objectKeySchema = z
  .string()
  .max(OBJECT_KEY_MAX)
  .regex(OBJECT_KEY_PATTERN, { error: "Not a valid uploaded-asset key." });

/** A minted object key that must be an IMAGE upload (`images/` prefix). */
export const imageObjectKeySchema = objectKeySchema.refine(
  (key) => key.startsWith("images/"),
  { error: "Background images must be image uploads." },
);

/**
 * The owner id embedded in a key, or null when the key is not a valid minted
 * key. Never infer ownership from an unvalidated string — a null here means
 * "reject", not "unknown owner".
 */
export function objectKeyOwner(key: string): string | null {
  // No `g` flag, so `.test` carries no lastIndex state between calls.
  if (!OBJECT_KEY_PATTERN.test(key)) return null;
  return key.split("/")[1] ?? null;
}

/**
 * Whether `key` is a valid minted key belonging to `ownerId`.
 *
 * This is the check that must run in route/action code beside the schema
 * parse: the schema proves the key is well-formed, this proves it is the
 * caller's. A creator submitting `images/{someone-elses-uuid}/...` passes the
 * schema and fails here.
 */
export function isObjectKeyOwnedBy(key: string, ownerId: string): boolean {
  const owner = objectKeyOwner(key);
  return owner !== null && owner === ownerId.trim().toLowerCase();
}
