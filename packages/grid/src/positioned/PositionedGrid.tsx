"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { cn } from "../cn.js";
import {
  POSITIONED_DRAG_ACTIVATION_DISTANCE,
  POSITIONED_GROWTH_ROWS,
  POSITIONED_MIN_ROWS,
  type GridCellGeometry,
  type PositionedBlock,
  type PositionedBlockState,
  type RenderPositionedBlock,
} from "./types.js";
import { applyDrop, applyResize, getMaxOccupiedRow } from "./placement.js";
import { useGridCellGeometry } from "./useGridGeometry.js";

// POSITIONED bento grid: blocks carry explicit 1-based coordinates
// (gridX/gridY/spanW/spanH) instead of flowing. Behavior replicates the old
// SQ-app GridCanvas/SortableArtifact (ui-export/reference/):
//
// - Square cells measured off --grid-columns/--grid-gap + container width.
// - dnd-kit PointerSensor with a 5px activation distance (click vs drag),
//   KeyboardSensor stepping one cell per arrow press; the dragged block dims
//   to 0.25 opacity while a floating overlay copy follows the cursor.
// - Drop math: delta → col/row offset via round(delta / (cellSize + gap)),
//   clamped to columns (rows unbounded downward); overlapped blocks move to
//   the nearest free slot by Manhattan distance (see placement.ts).
// - Resize (via renderBlock's `resize` / SpanPresetPicker) sets spans as-is.
// - Dashed background cells under the blocks; rows = max(minRows,
//   maxOccupiedRow + growthRows).
//
// Like flow mode it is CONTROLLED and presentation-agnostic: `blocks` in,
// the complete next layout out through `onBlocksChange` (fired synchronously
// on drop/resize so consumers can write it to their cache optimistically and
// persist array index as sortOrder — the old optimistic-update pattern).

interface PositionedGridCommonProps<TData> {
  blocks: PositionedBlock<TData>[];
  renderBlock: RenderPositionedBlock<TData>;
  /** Accessible name for the grid region. */
  ariaLabel?: string;
  /** Accessible name per block (editable mode drag handles). */
  getBlockLabel?: (block: PositionedBlock<TData>) => string;
  /** Minimum canvas rows (default 6). */
  minRows?: number;
  /** Extra rows kept below the lowest block (default 2). */
  growthRows?: number;
  /** Dashed empty-cell backdrop under the blocks (default true). */
  showBackgroundCells?: boolean;
  className?: string;
  /** Extra classes for each dashed background cell. */
  cellClassName?: string;
  /** Extra classes for the floating drag-overlay frame. */
  overlayClassName?: string;
}

/**
 * OFF = static read-only grid (public collection pages); callbacks rejected.
 * ON = drag + displacement + resize; onBlocksChange is REQUIRED at the type
 * level so an editable grid can never silently drop its mutations.
 */
export type PositionedGridProps<TData> =
  | (PositionedGridCommonProps<TData> & {
      editable?: false;
      onBlocksChange?: undefined;
    })
  | (PositionedGridCommonProps<TData> & {
      editable: true;
      /** Receives the COMPLETE next layout (input order preserved). */
      onBlocksChange: (next: PositionedBlock<TData>[]) => void;
    });

const NOOP_RESIZE = () => {};

const READ_ONLY_STATE: PositionedBlockState = {
  editable: false,
  isDragging: false,
  isOverlay: false,
  resize: NOOP_RESIZE,
};

function blockPlacementStyle(block: PositionedBlock<unknown>): CSSProperties {
  return {
    gridColumn: `${block.gridX} / span ${block.spanW}`,
    gridRow: `${block.gridY} / span ${block.spanH}`,
  };
}

export function PositionedGrid<TData>(props: PositionedGridProps<TData>) {
  const {
    blocks,
    renderBlock,
    editable = false,
    onBlocksChange,
    ariaLabel = "Grid",
    getBlockLabel,
    minRows = POSITIONED_MIN_ROWS,
    growthRows = POSITIONED_GROWTH_ROWS,
    showBackgroundCells = true,
    className,
    cellClassName,
    overlayClassName,
  } = props;

  const gridRef = useRef<HTMLDivElement>(null);
  const geometry = useGridCellGeometry(gridRef);
  const { cellSize, gap, columns } = geometry;

  const maxOccupiedRow = getMaxOccupiedRow(blocks);
  const gridRows = Math.max(minRows, maxOccupiedRow + growthRows);

  // Explicit tracks (not auto-rows): the dashed backdrop addresses every
  // cell, and rows keep their height even when empty — as in the reference.
  const gridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gridTemplateRows: `repeat(${gridRows}, ${cellSize}px)`,
    gap: `${gap}px`,
  };

  const backgroundCells: ReactNode = showBackgroundCells
    ? Array.from({ length: gridRows * columns }, (_, i) => {
        const c = (i % columns) + 1;
        const r = Math.floor(i / columns) + 1;
        return (
          <div
            key={`cell-${c}-${r}`}
            aria-hidden="true"
            style={{ gridColumn: c, gridRow: r }}
            className={cn("ss-pgrid-cell", cellClassName)}
          />
        );
      })
    : null;

  if (!editable) {
    return (
      <div
        ref={gridRef}
        role="list"
        aria-label={ariaLabel}
        className={cn("ss-pgrid", className)}
        style={gridStyle}
      >
        {backgroundCells}
        {blocks.map((block) => (
          <div
            key={block.key}
            role="listitem"
            style={{ ...blockPlacementStyle(block), zIndex: 1 }}
          >
            {renderBlock(block, READ_ONLY_STATE)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <EditablePositionedGrid
      gridRef={gridRef}
      geometry={geometry}
      gridStyle={gridStyle}
      backgroundCells={backgroundCells}
      blocks={blocks}
      renderBlock={renderBlock}
      onBlocksChange={onBlocksChange}
      ariaLabel={ariaLabel}
      getBlockLabel={getBlockLabel}
      className={className}
      overlayClassName={overlayClassName}
    />
  );
}

// --- editable grid --------------------------------------------------------

function EditablePositionedGrid<TData>({
  gridRef,
  geometry,
  gridStyle,
  backgroundCells,
  blocks,
  renderBlock,
  onBlocksChange,
  ariaLabel,
  getBlockLabel,
  className,
  overlayClassName,
}: {
  gridRef: RefObject<HTMLDivElement | null>;
  geometry: GridCellGeometry;
  gridStyle: CSSProperties;
  backgroundCells: ReactNode;
  blocks: PositionedBlock<TData>[];
  renderBlock: RenderPositionedBlock<TData>;
  onBlocksChange?: (next: PositionedBlock<TData>[]) => void;
  ariaLabel: string;
  getBlockLabel?: (block: PositionedBlock<TData>) => string;
  className?: string;
  overlayClassName?: string;
}) {
  const { cellSize, gap } = geometry;

  // Keyboard drags step exactly one cell per arrow press: the same
  // delta → cell drop math applies, so a press always moves one column/row.
  // Latest geometry lives in a ref so the sensor callback stays stable.
  const strideRef = useRef(cellSize + gap);
  useEffect(() => {
    strideRef.current = cellSize + gap;
  });
  const keyboardCoordinateGetter = useCallback<KeyboardCoordinateGetter>(
    (event, { currentCoordinates }) => {
      const stride = strideRef.current;
      switch (event.code) {
        case "ArrowRight":
          return { x: currentCoordinates.x + stride, y: currentCoordinates.y };
        case "ArrowLeft":
          return { x: currentCoordinates.x - stride, y: currentCoordinates.y };
        case "ArrowDown":
          return { x: currentCoordinates.x, y: currentCoordinates.y + stride };
        case "ArrowUp":
          return { x: currentCoordinates.x, y: currentCoordinates.y - stride };
      }
      return undefined;
    },
    [],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: POSITIONED_DRAG_ACTIVATION_DISTANCE },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinateGetter }),
  );

  // Stable id keeps dnd-kit's generated aria ids identical across SSR/CSR.
  const dndId = useId();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const activeBlock = useMemo(
    () => blocks.find((block) => block.key === activeKey) ?? null,
    [blocks, activeKey],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveKey(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, delta } = event;
      setActiveKey(null);
      const next = applyDrop(blocks, String(active.id), delta, geometry);
      if (next) onBlocksChange?.(next);
    },
    [blocks, geometry, onBlocksChange],
  );

  const resizeBlock = useCallback(
    (key: string, spanW: number, spanH: number) => {
      onBlocksChange?.(applyResize(blocks, key, spanW, spanH));
    },
    [blocks, onBlocksChange],
  );

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveKey(null)}
    >
      <div
        ref={gridRef}
        aria-label={ariaLabel}
        className={cn("ss-pgrid", className)}
        style={gridStyle}
      >
        {backgroundCells}
        {blocks.map((block) => (
          <DraggableBlock
            key={block.key}
            block={block}
            label={getBlockLabel?.(block)}
            renderBlock={renderBlock}
            onResize={resizeBlock}
          />
        ))}
      </div>

      {/* Floating copy that follows the cursor, sized to the block's exact
          pixel rect. The in-place block stays as a dimmed placeholder. The
          frame paints only radius + ring + shadow; renderBlock is responsible
          for the opaque card surface, exactly as in the grid. */}
      <DragOverlay dropAnimation={null}>
        {activeBlock ? (
          <div
            style={{
              width:
                activeBlock.spanW * cellSize + (activeBlock.spanW - 1) * gap,
              height:
                activeBlock.spanH * cellSize + (activeBlock.spanH - 1) * gap,
            }}
            className={cn("ss-pgrid-overlay", overlayClassName)}
          >
            {renderBlock(activeBlock, {
              editable: true,
              isDragging: true,
              isOverlay: true,
              resize: NOOP_RESIZE,
            })}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// --- draggable block wrapper ----------------------------------------------

function DraggableBlock<TData>({
  block,
  label,
  renderBlock,
  onResize,
}: {
  block: PositionedBlock<TData>;
  label?: string;
  renderBlock: RenderPositionedBlock<TData>;
  onResize: (key: string, spanW: number, spanH: number) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: block.key,
  });

  const resize = useCallback(
    (spanW: number, spanH: number) => onResize(block.key, spanW, spanH),
    [onResize, block.key],
  );

  // Reference SortableArtifact styling: explicit grid placement, dim to 0.25
  // while the overlay copy drags, grab cursors, opacity transition at rest.
  // touch-action none lets PointerSensor own touch gestures (drag on touch).
  const style: CSSProperties = {
    ...blockPlacementStyle(block),
    opacity: isDragging ? 0.25 : 1,
    zIndex: 1,
    cursor: isDragging ? "grabbing" : "grab",
    transition: isDragging ? "none" : "opacity 200ms ease",
    touchAction: "none",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      aria-label={label}
      {...attributes}
      {...listeners}
    >
      {renderBlock(block, {
        editable: true,
        isDragging,
        isOverlay: false,
        resize,
      })}
    </div>
  );
}
