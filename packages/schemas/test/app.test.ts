import { describe, expect, it } from "vitest";
import { artifactSchema } from "../src/app.js";
import { isObjectKeyOwnedBy } from "../src/object-key.js";

const OWNER = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const ATTACKER = "9c858901-8a57-4791-81fe-4c455b099bc9";
const ASSET = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";
const COLLECTION = "1b4e28ba-2fa1-4d1d-883f-01ff1a2b3c4d";

const imageKey = (owner: string) => `images/${owner}/${ASSET}-photo.png`;

const artifact = (overrides: Record<string, unknown> = {}) => ({
  title: "A print",
  description: "Two colours,\nrisograph.",
  imageKey: imageKey(OWNER),
  gridX: 1,
  gridY: 1,
  spanW: 2,
  spanH: 2,
  sortOrder: 0,
  collectionId: COLLECTION,
  productId: null,
  ...overrides,
});

describe("artifactSchema", () => {
  it("parses a well-formed artifact and defaults the framing offsets", () => {
    const parsed = artifactSchema.safeParse(artifact());
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.imgOffsetX).toBe(50);
    expect(parsed.success && parsed.data.imgOffsetY).toBe(50);
  });

  // ── Regression: the HIGH audit finding ────────────────────────────────
  // imageKey was `.max(512).regex(SINGLE_LINE_TEXT_PATTERN)`, which rejects
  // control characters and nothing else. Every value below passed before.
  describe("imageKey is a minted key, not a free string", () => {
    it.each([
      ["an absolute URL", "https://evil.example/x.png"],
      ["a protocol-relative URL", "//evil.example/x.png"],
      ["path traversal", `images/${OWNER}/../${ASSET}-x.png`],
      ["an unminted prefix", `avatars/${OWNER}/${ASSET}-x.png`],
      ["a bare filename", "photo.png"],
      ["an empty string", ""],
    ])("rejects %s", (_label, imageKeyValue) => {
      expect(artifactSchema.safeParse(artifact({ imageKey: imageKeyValue })).success).toBe(
        false,
      );
    });

    it("rejects a files/ key — an artifact is an image", () => {
      expect(
        artifactSchema.safeParse({
          ...artifact(),
          imageKey: `files/${OWNER}/${ASSET}-manual.pdf`,
        }).success,
      ).toBe(false);
    });
  });

  // The schema proves SHAPE, never IDENTITY. This encodes the split so the
  // app-side ownership check can never be quietly assumed away.
  it("accepts another creator's well-formed key — ownership is the caller's job", () => {
    const victimsKey = imageKey(OWNER);
    expect(artifactSchema.safeParse(artifact({ imageKey: victimsKey })).success).toBe(
      true,
    );
    expect(isObjectKeyOwnedBy(victimsKey, ATTACKER)).toBe(false);
  });

  it("rejects unknown keys (no mass assignment into the row)", () => {
    expect(
      artifactSchema.safeParse(artifact({ userId: ATTACKER })).success,
    ).toBe(false);
    expect(artifactSchema.safeParse(artifact({ id: ASSET })).success).toBe(false);
  });

  it("rejects out-of-range placement", () => {
    // Grid coordinates are 1-based on the wire.
    expect(artifactSchema.safeParse(artifact({ gridX: 0 })).success).toBe(false);
    expect(artifactSchema.safeParse(artifact({ gridY: 0 })).success).toBe(false);
    expect(artifactSchema.safeParse(artifact({ spanW: 0 })).success).toBe(false);
    expect(artifactSchema.safeParse(artifact({ spanW: 13 })).success).toBe(false);
    expect(artifactSchema.safeParse(artifact({ sortOrder: -1 })).success).toBe(false);
  });

  it("rejects control characters in text fields", () => {
    const withNul = `bad${String.fromCharCode(0)}title`;
    expect(artifactSchema.safeParse(artifact({ title: withNul })).success).toBe(false);
    // Newline is allowed in description but not in the single-line title.
    expect(artifactSchema.safeParse(artifact({ title: "two\nlines" })).success).toBe(
      false,
    );
    expect(
      artifactSchema.safeParse(artifact({ description: "two\nlines" })).success,
    ).toBe(true);
  });

  it("requires uuids for the relational fields", () => {
    expect(artifactSchema.safeParse(artifact({ collectionId: "nope" })).success).toBe(
      false,
    );
    expect(artifactSchema.safeParse(artifact({ collectionId: null })).success).toBe(
      true,
    );
  });
});
