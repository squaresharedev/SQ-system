import { z } from "zod";
import {
  MULTILINE_TEXT_PATTERN,
  SINGLE_LINE_TEXT_PATTERN,
  TEXT_ERROR,
} from "./text.js";
import { imageObjectKeySchema } from "./object-key.js";

// The SQ-app domain contract: Artifacts placed on the positioned grid, grouped
// into Collections. Mirrors the DB row shape minus server-only fields
// (id/userId/timestamps), in the same style as the storefront schemas: strict
// objects, enums/regex gates, no field that can hold HTML/URLs/CSS. Parsed
// server-side (Hono Worker) on every write; client checks are UX only.
//
// Coordinate vocabulary: `gridX/gridY/spanW/spanH` is the WIRE format
// (1-based). The grid package's view types (`GridPosition`'s
// col/row/colSpan/rowSpan) map 1:1 onto these — keep the mapping at the API
// client layer, exactly like the old app's dtoToGridItem.

// Plain-text gates (TEXT_ERROR / MULTILINE_TEXT_PATTERN /
// SINGLE_LINE_TEXT_PATTERN) come from ./text.ts — the same definitions the
// storefront contract uses.

/** Row ids are uuids everywhere; guards URL params + action inputs. */
export const artifactIdSchema = z.uuid();
export const collectionIdSchema = z.uuid();

// ── Artifact ────────────────────────────────────────────────────────────

export const ARTIFACT_TITLE_MAX = 120;
export const ARTIFACT_DESCRIPTION_MAX = 1000;

/** 1-based grid coordinates. The column cap is the CSS var at render time
 *  (--grid-columns, responsive); the wire cap is only a sanity bound. */
export const GRID_COORD_MAX = 9999;
/** Spans stay within any sane column count (presets top out at 4x2 / 3x3). */
export const GRID_SPAN_MAX = 12;
export const SORT_ORDER_MAX = 9999;

/** Image framing offsets: 0–100 percentages driving the shared crop contract
 *  (`transform-origin: {x}% {y}%; transform: scale(1.5)` over object-cover). */
export const IMG_OFFSET_MIN = 0;
export const IMG_OFFSET_MAX = 100;
export const IMG_OFFSET_DEFAULT = 50;

const gridCoordSchema = z.number().int().min(1).max(GRID_COORD_MAX);
const gridSpanSchema = z.number().int().min(1).max(GRID_SPAN_MAX);
const sortOrderSchema = z.number().int().min(0).max(SORT_ORDER_MAX);
const imgOffsetSchema = z
  .number()
  .min(IMG_OFFSET_MIN)
  .max(IMG_OFFSET_MAX)
  .default(IMG_OFFSET_DEFAULT);

export const artifactSchema = z.strictObject({
  title: z
    .string()
    .trim()
    .min(1, { error: "Give your artifact a title." })
    .max(ARTIFACT_TITLE_MAX, {
      error: `Titles are ${ARTIFACT_TITLE_MAX} characters or fewer.`,
    })
    .regex(SINGLE_LINE_TEXT_PATTERN, TEXT_ERROR),
  description: z
    .string()
    .max(ARTIFACT_DESCRIPTION_MAX, {
      error: `Descriptions are ${ARTIFACT_DESCRIPTION_MAX} characters or fewer.`,
    })
    .regex(MULTILINE_TEXT_PATTERN, TEXT_ERROR),
  // A MINTED R2 key (`images/{ownerId}/{uuid}-{name}`), never a URL and never
  // a client-chosen string. SHAPE ONLY: a well-formed key naming another
  // creator's id passes this schema, so the caller MUST also check ownership
  // with `isObjectKeyOwnedBy(key, session.user.id)` before trusting it.
  imageKey: imageObjectKeySchema,
  gridX: gridCoordSchema,
  gridY: gridCoordSchema,
  spanW: gridSpanSchema,
  spanH: gridSpanSchema,
  imgOffsetX: imgOffsetSchema,
  imgOffsetY: imgOffsetSchema,
  sortOrder: sortOrderSchema,
  collectionId: collectionIdSchema.nullable(),
  /** References a store product (uuid) when the artifact is shoppable. */
  productId: z.uuid().nullable(),
});

/** Output shape (offsets defaulted to 50 when omitted on input). */
export type Artifact = z.infer<typeof artifactSchema>;
/** Input shape (imgOffsetX/Y optional — the schema defaults them). */
export type ArtifactInput = z.input<typeof artifactSchema>;

/** One entry of the batch position update the grid emits on drop/resize —
 *  the old app persisted array index as sortOrder; keep that contract. */
export const artifactPlacementSchema = z.strictObject({
  id: artifactIdSchema,
  gridX: gridCoordSchema,
  gridY: gridCoordSchema,
  spanW: gridSpanSchema,
  spanH: gridSpanSchema,
  sortOrder: sortOrderSchema,
});
export type ArtifactPlacement = z.infer<typeof artifactPlacementSchema>;

/** Sanity cap on a batch update (mirrors MAX_BLOCKS-style bounds). */
export const MAX_PLACEMENTS = 500;
export const artifactPlacementBatchSchema = z
  .array(artifactPlacementSchema)
  .max(MAX_PLACEMENTS)
  .refine((items) => new Set(items.map((item) => item.id)).size === items.length, {
    error: "Each artifact can only appear once in a batch update.",
  });

// ── Collection ──────────────────────────────────────────────────────────

export const COLLECTION_NAME_MAX = 80;

export const collectionSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1, { error: "Give your collection a name." })
    .max(COLLECTION_NAME_MAX, {
      error: `Collection names are ${COLLECTION_NAME_MAX} characters or fewer.`,
    })
    .regex(SINGLE_LINE_TEXT_PATTERN, TEXT_ERROR),
  isPublic: z.boolean(),
  sortOrder: sortOrderSchema,
});
export type Collection = z.infer<typeof collectionSchema>;
