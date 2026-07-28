import { z } from "zod";
import {
  BACKGROUND_IMAGE_SCALE_MAX,
  BACKGROUND_IMAGE_SCALE_MIN,
  CANVAS_COLUMNS_MAX,
  CANVAS_COLUMNS_MIN,
  CANVAS_ROWS_MAX,
  CANVAS_ROWS_MIN,
  CORNER_RADIUS_MAX,
  DISPLAY_MODES,
  EMBED_MAX_DOMAINS,
  GRID_GAP_MAX,
  HEADER_BIO_MAX,
  HEADER_NAME_MAX,
  PRICE_DISPLAYS,
  PRICE_TAG_POSITIONS,
  PRICE_TAG_STYLES,
  SHAPE_BORDER_WIDTH_MAX,
  SHAPE_KINDS,
  STOREFRONT_FONTS,
  TEXT_ALIGNS,
  TEXT_MAX_LENGTH,
  TEXT_VARIANTS,
  TITLE_DISPLAYS,
  TITLE_STYLES,
} from "./storefront.js";
import {
  MAX_BLOCKS,
  STOREFRONT_NAME_MAX,
  embedSettingsSchema,
  storefrontConfigSchema,
  storefrontNameSchema,
} from "./storefront-validation.js";
import {
  artifactPlacementBatchSchema,
  artifactSchema,
  collectionSchema,
} from "./app.js";

// The agent-surface introspection layer (docs/agent-surface.md §3.3): the
// machine-readable description of every storefront contract, derived from the
// SAME Zod objects the write path validates with, so discovery and enforcement
// can never disagree. The future MCP server's `schema_describe` / `tokens_list`
// tools are thin wrappers over these exports; nothing here mutates anything.
//
// FIELD_META exists because Zod carries min/max but not unit/step/label — that
// knowledge previously lived only in dashboard slider props. It is DATA about
// the contract, kept in lockstep with the schemas above; a bound change in the
// schema must be mirrored here (and vice versa).

/** UI-grade metadata for one bounded numeric field. */
export type AgentFieldMeta = {
  unit: "px" | "%" | "deg" | "cells";
  /** The dashboard's slider granularity. Agents should write multiples of it
   *  (the schema accepts any integer in range; the step is a convention). */
  step: number;
  min: number;
  max: number;
  /** Human anchors for the ends of the scale, when the number alone is
   *  unintuitive. */
  labels?: Record<number, string>;
};

/** Path convention: dot-separated from the config root; `blocks[]` prefixes
 *  per-block fields; union variants nest under their discriminator value. */
export const STOREFRONT_FIELD_META: Readonly<Record<string, AgentFieldMeta>> = {
  "theme.columns": {
    unit: "cells",
    step: 1,
    min: CANVAS_COLUMNS_MIN,
    max: CANVAS_COLUMNS_MAX,
  },
  "theme.rows": {
    unit: "cells",
    step: 1,
    min: CANVAS_ROWS_MIN,
    max: CANVAS_ROWS_MAX,
  },
  "theme.cornerRadius": {
    unit: "px",
    step: 2,
    min: 0,
    max: CORNER_RADIUS_MAX,
    labels: { 0: "sharp", [CORNER_RADIUS_MAX]: "circle / pill" },
  },
  "theme.gridGap": {
    unit: "px",
    step: 2,
    min: 0,
    max: GRID_GAP_MAX,
    labels: { 0: "touching", [GRID_GAP_MAX]: "airy" },
  },
  "theme.background.gradient.angle": { unit: "deg", step: 5, min: 0, max: 360 },
  "theme.background.image.x": { unit: "%", step: 1, min: 0, max: 100 },
  "theme.background.image.y": { unit: "%", step: 1, min: 0, max: 100 },
  "theme.background.image.scale": {
    unit: "%",
    step: 5,
    min: BACKGROUND_IMAGE_SCALE_MIN,
    max: BACKGROUND_IMAGE_SCALE_MAX,
    labels: { [BACKGROUND_IMAGE_SCALE_MIN]: "fit" },
  },
  "blocks[].x": { unit: "cells", step: 1, min: 0, max: CANVAS_COLUMNS_MAX - 1 },
  "blocks[].y": { unit: "cells", step: 1, min: 0, max: CANVAS_ROWS_MAX - 1 },
  "blocks[].w": { unit: "cells", step: 1, min: 1, max: CANVAS_COLUMNS_MAX },
  "blocks[].h": { unit: "cells", step: 1, min: 1, max: CANVAS_ROWS_MAX },
  "blocks[].borderWidth": {
    unit: "px",
    step: 1,
    min: 0,
    max: SHAPE_BORDER_WIDTH_MAX,
  },
  "blocks[].opacity": { unit: "%", step: 5, min: 0, max: 100 },
};

/** Every closed value set a presentation write can draw from. The future
 *  `tokens_list` payload. Members are the canonical const arrays, not copies. */
export const STOREFRONT_ENUMS = {
  fonts: STOREFRONT_FONTS,
  titleStyles: TITLE_STYLES,
  titleDisplays: TITLE_DISPLAYS,
  priceDisplays: PRICE_DISPLAYS,
  priceTagPositions: PRICE_TAG_POSITIONS,
  priceTagStyles: PRICE_TAG_STYLES,
  displayModes: DISPLAY_MODES,
  shapeKinds: SHAPE_KINDS,
  textVariants: TEXT_VARIANTS,
  textAligns: TEXT_ALIGNS,
} as const;

/** Hard caps an agent must plan around before writing. */
export const STOREFRONT_LIMITS = {
  maxBlocks: MAX_BLOCKS,
  storefrontNameMax: STOREFRONT_NAME_MAX,
  headerNameMax: HEADER_NAME_MAX,
  headerBioMax: HEADER_BIO_MAX,
  textBlockMax: TEXT_MAX_LENGTH,
  embedMaxDomains: EMBED_MAX_DOMAINS,
} as const;

/** The wire contracts an agent can ask to have described, by stable name.
 *  Each value is the exact Zod object the corresponding write path parses. */
export const AGENT_CONTRACTS = {
  storefront_config: storefrontConfigSchema,
  storefront_name: storefrontNameSchema,
  embed_settings: embedSettingsSchema,
  artifact: artifactSchema,
  artifact_placement_batch: artifactPlacementBatchSchema,
  collection: collectionSchema,
} as const;

export type AgentContractName = keyof typeof AGENT_CONTRACTS;

export type ContractDescription = {
  contract: AgentContractName;
  /** JSON Schema of the contract's OUTPUT shape (what a compliant write looks
   *  like after legacy migrations). Refinement-level rules that JSON Schema
   *  cannot express (non-overlap, canvas bounds, uniqueness) still apply at
   *  the validation boundary; `fields`/`limits` carry the rest. */
  jsonSchema: unknown;
  /** Present only for contracts with numeric presentation scales. */
  fields?: Readonly<Record<string, AgentFieldMeta>>;
  limits?: Readonly<Record<string, number>>;
  enums?: typeof STOREFRONT_ENUMS;
};

/**
 * Describe one contract for a machine consumer. The MCP server's
 * `schema_describe` tool is expected to return this verbatim, stamped with the
 * package version from its own dependency manifest.
 */
export function describeContract(name: AgentContractName): ContractDescription {
  const schema = AGENT_CONTRACTS[name];
  const description: ContractDescription = {
    contract: name,
    jsonSchema: z.toJSONSchema(schema, { io: "output", unrepresentable: "any" }),
  };
  if (name === "storefront_config") {
    description.fields = STOREFRONT_FIELD_META;
    description.limits = STOREFRONT_LIMITS;
    description.enums = STOREFRONT_ENUMS;
  }
  return description;
}
