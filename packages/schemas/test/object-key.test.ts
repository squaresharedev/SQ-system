import { describe, expect, it } from "vitest";
import {
  OBJECT_KEY_PATTERN,
  imageObjectKeySchema,
  isObjectKeyOwnedBy,
  objectKeyOwner,
  objectKeySchema,
} from "../src/object-key.js";
import { storefrontConfigSchema } from "../src/storefront-validation.js";
import {
  BACKGROUND_IMAGE_SCALE_MIN,
  DEFAULT_STOREFRONT_CONFIG,
} from "../src/storefront.js";

// Two different creators, plus an asset uuid. Valid v4 UUIDs so they satisfy
// z.uuid() elsewhere, and lowercase hex so they satisfy OBJECT_KEY_PATTERN.
const OWNER = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const ATTACKER = "9c858901-8a57-4791-81fe-4c455b099bc9";
const ASSET = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";

const imageKey = (owner: string, name = "photo.png") =>
  `images/${owner}/${ASSET}-${name}`;
const fileKey = (owner: string, name = "manual.pdf") =>
  `files/${owner}/${ASSET}-${name}`;

describe("OBJECT_KEY_PATTERN", () => {
  it("accepts keys the presign flow actually mints", () => {
    expect(OBJECT_KEY_PATTERN.test(imageKey(OWNER))).toBe(true);
    expect(OBJECT_KEY_PATTERN.test(fileKey(OWNER))).toBe(true);
  });

  it.each([
    ["path traversal", `images/${OWNER}/../${ASSET}-x.png`],
    ["traversal in the name", `images/${OWNER}/${ASSET}-../../secret.png`],
    ["an absolute URL", "https://evil.example/x.png"],
    ["a protocol-relative URL", "//evil.example/x.png"],
    ["an unminted prefix", `avatars/${OWNER}/${ASSET}-x.png`],
    ["a missing owner segment", `images/${ASSET}-x.png`],
    ["a leading slash", `/images/${OWNER}/${ASSET}-x.png`],
    ["a query string", `images/${OWNER}/${ASSET}-x.png?raw=1`],
    ["a non-uuid owner", `images/not-a-uuid/${ASSET}-x.png`],
    ["uppercase hex", `images/${OWNER.toUpperCase()}/${ASSET}-x.png`],
    ["an empty string", ""],
  ])("rejects %s", (_label, key) => {
    expect(OBJECT_KEY_PATTERN.test(key)).toBe(false);
    expect(objectKeySchema.safeParse(key).success).toBe(false);
  });

  it("rejects a filename beyond the 200-char cap", () => {
    expect(objectKeySchema.safeParse(imageKey(OWNER, "a".repeat(200))).success).toBe(
      true,
    );
    expect(objectKeySchema.safeParse(imageKey(OWNER, "a".repeat(201))).success).toBe(
      false,
    );
  });
});

describe("imageObjectKeySchema", () => {
  it("accepts an images/ key", () => {
    expect(imageObjectKeySchema.safeParse(imageKey(OWNER)).success).toBe(true);
  });

  it("rejects a well-formed files/ key — images only", () => {
    expect(imageObjectKeySchema.safeParse(fileKey(OWNER)).success).toBe(false);
  });
});

describe("ownership", () => {
  it("extracts the owner from a valid key", () => {
    expect(objectKeyOwner(imageKey(OWNER))).toBe(OWNER);
    expect(objectKeyOwner(fileKey(ATTACKER))).toBe(ATTACKER);
  });

  it("returns null rather than guessing for an invalid key", () => {
    expect(objectKeyOwner("https://evil.example/x.png")).toBeNull();
    expect(objectKeyOwner(`images/${OWNER}/../${ASSET}-x.png`)).toBeNull();
  });

  it("confirms a creator's own key", () => {
    expect(isObjectKeyOwnedBy(imageKey(OWNER), OWNER)).toBe(true);
  });

  // The cross-tenant regression test: a perfectly well-formed key naming
  // ANOTHER creator's id is exactly what the schema cannot catch.
  it("rejects a well-formed key belonging to another creator", () => {
    expect(imageObjectKeySchema.safeParse(imageKey(OWNER)).success).toBe(true);
    expect(isObjectKeyOwnedBy(imageKey(OWNER), ATTACKER)).toBe(false);
  });

  it("normalises caller-supplied owner ids before comparing", () => {
    expect(isObjectKeyOwnedBy(imageKey(OWNER), ` ${OWNER.toUpperCase()} `)).toBe(true);
  });

  it("never reports ownership for an invalid key", () => {
    expect(isObjectKeyOwnedBy("https://evil.example/x.png", OWNER)).toBe(false);
    expect(isObjectKeyOwnedBy("", OWNER)).toBe(false);
  });
});

// The gap this whole module exists to close was one call site using the shared
// pattern and another not. Assert BOTH consumers are wired to it.
describe("every object-key call site shares one gate", () => {
  const configWithBackgroundKey = (key: string) => ({
    ...DEFAULT_STOREFRONT_CONFIG,
    theme: {
      ...DEFAULT_STOREFRONT_CONFIG.theme,
      background: {
        kind: "image",
        key,
        x: 50,
        y: 50,
        scale: BACKGROUND_IMAGE_SCALE_MIN,
      },
    },
  });

  it("accepts a minted background image key", () => {
    const parsed = storefrontConfigSchema.safeParse(
      configWithBackgroundKey(imageKey(OWNER)),
    );
    expect(parsed.success).toBe(true);
  });

  it("rejects an unminted background image key", () => {
    expect(
      storefrontConfigSchema.safeParse(
        configWithBackgroundKey("https://evil.example/x.png"),
      ).success,
    ).toBe(false);
    expect(
      storefrontConfigSchema.safeParse(configWithBackgroundKey(fileKey(OWNER)))
        .success,
    ).toBe(false);
  });
});
