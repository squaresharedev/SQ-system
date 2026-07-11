// @squaresharedev/grid — the SquareShare bento grid, two modes:
//
// FLOW (lifted from SQ-store, zero behavior change): auto-placed blocks with
// a size enum, drag-to-reorder + corner-drag resize. True-square cells via
// the .ss-grid CSS (container queries). <Grid> + useGridLayout/useResizable.
//
// POSITIONED (replicates the old SQ-app grid canvas): blocks carry explicit
// gridX/gridY/spanW/spanH coordinates + image framing offsets. Free drag with
// drop snapping, Manhattan-distance displacement, findOpenSlot placement,
// preset-based resize. <PositionedGrid> + SpanPresetPicker + placement math.
//
// Import the stylesheet once per app: "@squaresharedev/grid/styles.css".

// ── Flow mode ───────────────────────────────────────────────────────────
export { Grid, type GridProps } from "./flow/Grid.js";
export {
  GRID_SIZES,
  SIZE_SPANS,
  SIZE_LABELS,
  GRID_COLUMNS_DESKTOP,
  GRID_COLUMNS_MOBILE,
  MAX_COL_SPAN,
  MAX_ROW_SPAN,
  GRID_CELL_RADIUS_CLASS,
  GRID_ROOT_CLASS,
  GRID_CONTAINER_CLASS,
  clampSpanToColumns,
  snapToSize,
  trailingPlaceholderCount,
  type GridSize,
  type GridSpan,
  type GridBlock,
  type GridBlockState,
  type RenderGridBlock,
} from "./flow/gridConstants.js";
export {
  useGridLayout,
  type UseGridLayoutResult,
} from "./flow/useGridLayout.js";
export {
  useResizable,
  type UseResizableOptions,
  type UseResizableResult,
  type ResizeHandleProps,
} from "./flow/useResizable.js";

// ── Positioned mode ─────────────────────────────────────────────────────
export {
  PositionedGrid,
  type PositionedGridProps,
} from "./positioned/PositionedGrid.js";
export {
  SpanPresetPicker,
  type SpanPresetPickerProps,
} from "./positioned/SpanPresetPicker.js";
export {
  SPAN_PRESETS,
  DEFAULT_IMG_OFFSET,
  IMAGE_FRAMING_SCALE,
  DEFAULT_GRID_GEOMETRY,
  GRID_COLUMNS_FALLBACK,
  GRID_GAP_FALLBACK,
  POSITIONED_MIN_ROWS,
  POSITIONED_GROWTH_ROWS,
  POSITIONED_DRAG_ACTIVATION_DISTANCE,
  imageFramingStyle,
  toGridPosition,
  fromGridPosition,
  type SpanPreset,
  type SpanSize,
  type GridPosition,
  type GridItem,
  type PositionedBlock,
  type PositionedBlockState,
  type RenderPositionedBlock,
  type GridCellGeometry,
} from "./positioned/types.js";
export {
  findOpenSlot,
  applyDrop,
  applyResize,
  getMaxOccupiedRow,
  type GridRect,
  type DropDelta,
} from "./positioned/placement.js";
export {
  useGridCellGeometry,
  readGridColumns,
} from "./positioned/useGridGeometry.js";
