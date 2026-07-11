import type { CSSProperties, ReactNode } from "react";

// Shared types + constants for POSITIONED mode: blocks carry explicit
// 1-based grid coordinates (the wire format: gridX/gridY/spanW/spanH) plus
// image framing offsets. The behavioral spec is the old SQ-app grid
// (ui-export/reference/): GridCanvas cell geometry, SortableArtifact drag,
// Resizer + SPAN_PRESETS resize.

// ── Span presets (absorbed from the old app's types/index.ts) ───────────

/** Preset span sizes available in the resize control */
export type SpanPreset = "1x1" | "2x2" | "3x3" | "4x2" | "2x1" | "1x2";

/** Column/row span dimensions parsed from a SpanPreset */
export interface SpanSize {
  colSpan: number; // 1–12
  rowSpan: number; // 1–N
}

/** Map of human-readable preset labels to their grid dimensions.
 *  Object order is the menu order in SpanPresetPicker (as in the old Resizer). */
export const SPAN_PRESETS: Record<SpanPreset, SpanSize> = {
  "1x1": { colSpan: 1, rowSpan: 1 },
  "2x1": { colSpan: 2, rowSpan: 1 },
  "1x2": { colSpan: 1, rowSpan: 2 },
  "2x2": { colSpan: 2, rowSpan: 2 },
  "4x2": { colSpan: 4, rowSpan: 2 },
  "3x3": { colSpan: 3, rowSpan: 3 },
};

// ── View-state coordinate types (absorbed from the old app) ─────────────

/** Position of an item within the coordinate grid (client-side vocabulary).
 *  Maps 1:1 onto the wire fields: col=gridX, row=gridY, colSpan=spanW,
 *  rowSpan=spanH — see toGridPosition/fromGridPosition. */
export interface GridPosition {
  /** Column start (1-based) */
  col: number;
  /** Row start (1-based) */
  row: number;
  /** Number of columns this item spans */
  colSpan: number;
  /** Number of rows this item spans */
  rowSpan: number;
}

/** A single item placed on the grid canvas (the old app's GridItem, with the
 *  artifact payload made generic so this package stays domain-free). */
export interface GridItem<TArtifact = unknown> {
  id: string;
  artifact: TArtifact;
  position: GridPosition;
}

// ── Positioned block (the grid's own input shape) ───────────────────────

/**
 * One block on the positioned grid. Wire-format coordinates (1-based) plus
 * the image framing offsets, carried through untouched — the grid never
 * renders images itself; renderBlock applies them (see imageFramingStyle).
 * `data` is an opaque consumer payload, exactly like flow-mode GridBlock.
 */
export interface PositionedBlock<TData = unknown> {
  /** Stable identity: doubles as the draggable id and the React key. */
  key: string;
  /** Column start, 1-based. */
  gridX: number;
  /** Row start, 1-based. */
  gridY: number;
  /** Columns spanned. */
  spanW: number;
  /** Rows spanned. */
  spanH: number;
  /** Image framing offset percentages (0–100, default 50/50). */
  imgOffsetX?: number;
  imgOffsetY?: number;
  data: TData;
}

/** Wire ↔ view mapping helpers (the old dtoToGridItem contract). */
export function toGridPosition(block: {
  gridX: number;
  gridY: number;
  spanW: number;
  spanH: number;
}): GridPosition {
  return {
    col: block.gridX,
    row: block.gridY,
    colSpan: block.spanW,
    rowSpan: block.spanH,
  };
}

export function fromGridPosition(position: GridPosition): {
  gridX: number;
  gridY: number;
  spanW: number;
  spanH: number;
} {
  return {
    gridX: position.col,
    gridY: position.row,
    spanW: position.colSpan,
    spanH: position.rowSpan,
  };
}

// ── Image framing (the crop/offset system contract) ─────────────────────

/** Default framing offset: image centered in its cell. */
export const DEFAULT_IMG_OFFSET = 50;
/** The fixed pan-zoom factor of the crop system. */
export const IMAGE_FRAMING_SCALE = 1.5;

/**
 * The shared framing formula: an `object-fit: cover` image with
 * `transform-origin: {x}% {y}%; transform: scale(1.5)`. Used identically by
 * edit cards, detail views, and public read-only views — apply the returned
 * style to the <img> alongside object-cover.
 */
export function imageFramingStyle(
  offsetX: number = DEFAULT_IMG_OFFSET,
  offsetY: number = DEFAULT_IMG_OFFSET,
  scale: number = IMAGE_FRAMING_SCALE,
): CSSProperties {
  return {
    transformOrigin: `${offsetX}% ${offsetY}%`,
    transform: `scale(${scale})`,
  };
}

// ── Grid geometry (cell size from CSS vars) ─────────────────────────────

/** Live cell geometry, derived from --grid-columns/--grid-gap + container
 *  width: cellSize = (width - (columns - 1) * gap) / columns. */
export interface GridCellGeometry {
  cellSize: number;
  gap: number;
  columns: number;
}

/** Pre-measure placeholder values (the old GridCanvas useState defaults). */
export const DEFAULT_GRID_GEOMETRY: GridCellGeometry = {
  cellSize: 120,
  gap: 12,
  columns: 12,
};

/** parseInt fallbacks when the CSS vars are missing/unparsable. */
export const GRID_COLUMNS_FALLBACK = 12;
export const GRID_GAP_FALLBACK = 12;

// ── Positioned-grid behavior constants ──────────────────────────────────

/** Minimum rows always shown (empty-grid canvas height). */
export const POSITIONED_MIN_ROWS = 6;
/** Extra rows below the lowest block (room to drag downward). */
export const POSITIONED_GROWTH_ROWS = 2;
/** PointerSensor activation distance (px): the click-vs-drag threshold. */
export const POSITIONED_DRAG_ACTIVATION_DISTANCE = 5;

// ── renderBlock contract ────────────────────────────────────────────────

/** Per-render state the positioned grid hands to `renderBlock`. */
export interface PositionedBlockState {
  editable: boolean;
  /** True on the dimmed in-grid placeholder while its overlay copy drags. */
  isDragging: boolean;
  /** True when rendering inside the floating DragOverlay — hide controls. */
  isOverlay: boolean;
  /** Commit a new span for this block (wire it to SpanPresetPicker's
   *  onChange). No-op in read-only mode and in the overlay. */
  resize: (spanW: number, spanH: number) => void;
}

/**
 * Consumer-supplied render function. The grid provides placement, drag and
 * displacement mechanics only; renderBlock paints the entire cell surface
 * (image, chrome, controls) — same presentation-agnostic contract as flow mode.
 */
export type RenderPositionedBlock<TData> = (
  block: PositionedBlock<TData>,
  state: PositionedBlockState,
) => ReactNode;
