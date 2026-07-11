import type { GridCellGeometry } from "./types.js";

// Pure layout math for POSITIONED mode, replicating the old GridCanvas
// algorithms exactly (ui-export/reference/GridCanvas.tsx is the spec):
// drop snapping, bounds clamping, Manhattan-distance displacement with
// row-scan early exit, and first-fit findOpenSlot. Pure functions on a
// structural rect shape so they work on PositionedBlock, wire rows, or
// anything carrying gridX/gridY/spanW/spanH — and stay unit-testable.

/** The structural placement shape (wire vocabulary, 1-based coords). */
export interface GridRect {
  gridX: number;
  gridY: number;
  spanW: number;
  spanH: number;
}

const cellKey = (col: number, row: number) => `${col},${row}`;

function addRectCells(occupied: Set<string>, rect: GridRect): void {
  for (let r = rect.gridY; r < rect.gridY + rect.spanH; r++) {
    for (let c = rect.gridX; c < rect.gridX + rect.spanW; c++) {
      occupied.add(cellKey(c, r));
    }
  }
}

/** Lowest occupied row index (0 when empty) — drives the canvas row count:
 *  rows = max(minRows, maxOccupiedRow + growthRows). */
export function getMaxOccupiedRow(rects: readonly GridRect[]): number {
  return rects.reduce(
    (max, rect) => Math.max(max, rect.gridY + rect.spanH - 1),
    0,
  );
}

/**
 * First-fit slot for a new block: row-major scan from (1,1), returning the
 * first position where a spanW×spanH rect fits with no overlap.
 *
 * Deviation from the reference (deliberate): when spanW exceeds the column
 * count the reference loops forever; here the searched width is clamped to
 * `columns` so placement terminates (the block still renders at its full
 * span, overflowing into implicit columns exactly as a manual move would).
 */
export function findOpenSlot(
  rects: readonly GridRect[],
  columns: number,
  spanW: number,
  spanH: number,
): { gridX: number; gridY: number } {
  const occupied = new Set<string>();
  for (const rect of rects) addRectCells(occupied, rect);

  const w = Math.min(spanW, columns);
  const h = spanH;
  for (let row = 1; ; row++) {
    for (let col = 1; col <= columns - w + 1; col++) {
      let free = true;
      for (let r = row; r < row + h && free; r++) {
        for (let c = col; c < col + w && free; c++) {
          if (occupied.has(cellKey(c, r))) free = false;
        }
      }
      if (free) return { gridX: col, gridY: row };
    }
  }
}

/** Pointer delta at drag end, in px (dnd-kit's DragEndEvent.delta). */
export interface DropDelta {
  x: number;
  y: number;
}

/**
 * Resolve a drag-end into the complete next layout, or null when the drop is
 * a no-op (zero cell offset / unknown key). Reference semantics, in order:
 *
 * 1. Snap: colOffset = round(delta.x / (cellSize + gap)), same for rows.
 * 2. Clamp: newCol ∈ [1, columns - spanW + 1]; newRow ≥ 1 (unbounded down).
 * 3. Collect every block the moved rect now overlaps (AABB test against
 *    pre-move positions).
 * 4. Move the dragged block first, then displace each overlapped block to
 *    the nearest free slot by Manhattan distance from its original position
 *    (row scan from row 1 with early exit once no closer row can exist).
 *    A block with no free slot in range stays put (overlap persists).
 *
 * The returned array preserves input order — persist index as sortOrder to
 * keep the old batch-update contract.
 */
export function applyDrop<T extends GridRect & { key: string }>(
  blocks: readonly T[],
  activeKey: string,
  delta: DropDelta | null | undefined,
  geometry: GridCellGeometry,
): T[] | null {
  if (!delta) return null;
  const { cellSize, gap, columns } = geometry;

  const colOffset = Math.round(delta.x / (cellSize + gap));
  const rowOffset = Math.round(delta.y / (cellSize + gap));
  if (colOffset === 0 && rowOffset === 0) return null;

  const item = blocks.find((b) => b.key === activeKey);
  if (!item) return null;

  const newCol = Math.max(
    1,
    Math.min(columns - item.spanW + 1, item.gridX + colOffset),
  );
  const newRow = Math.max(1, item.gridY + rowOffset);

  // Collect all overlapping items (against pre-move positions).
  const overlappingKeys = new Set<string>();
  const nColEnd = newCol + item.spanW;
  const nRowEnd = newRow + item.spanH;
  for (const other of blocks) {
    if (other.key === activeKey) continue;
    const oColEnd = other.gridX + other.spanW;
    const oRowEnd = other.gridY + other.spanH;
    if (
      newCol < oColEnd &&
      nColEnd > other.gridX &&
      newRow < oRowEnd &&
      nRowEnd > other.gridY
    ) {
      overlappingKeys.add(other.key);
    }
  }

  // Reference reads this from pre-drop state (its render-scope closure).
  const maxOccupiedRow = getMaxOccupiedRow(blocks);

  // Build the updated list: move the dragged item first.
  let updated: T[] = blocks.map((b) =>
    b.key === activeKey ? { ...b, gridX: newCol, gridY: newRow } : b,
  );

  // For each displaced item, find the nearest free slot.
  for (const dispKey of overlappingKeys) {
    const dispItem = updated.find((b) => b.key === dispKey);
    if (!dispItem) continue;

    const w = dispItem.spanW;
    const h = dispItem.spanH;

    // Occupied set excluding the displaced item itself.
    const occupied = new Set<string>();
    for (const b of updated) {
      if (b.key === dispKey) continue;
      addRectCells(occupied, b);
    }

    // Search outward from the displaced item's current position.
    const origCol = dispItem.gridX;
    const origRow = dispItem.gridY;
    let bestCol = origCol;
    let bestRow = origRow;
    let bestDist = Infinity;

    // Search nearby rows (within a generous range).
    const searchMaxRow = Math.max(maxOccupiedRow + 4, origRow + h + 4);
    for (let r = 1; r <= searchMaxRow; r++) {
      for (let c = 1; c <= columns - w + 1; c++) {
        let free = true;
        for (let dr = 0; dr < h && free; dr++) {
          for (let dc = 0; dc < w && free; dc++) {
            if (occupied.has(cellKey(c + dc, r + dr))) free = false;
          }
        }
        if (free) {
          const dist = Math.abs(c - origCol) + Math.abs(r - origRow);
          if (dist < bestDist) {
            bestDist = dist;
            bestCol = c;
            bestRow = r;
          }
        }
      }
      // Early exit: past the row range where closer slots could still exist.
      if (bestDist < Infinity && r > origRow + bestDist) break;
    }

    updated = updated.map((b) =>
      b.key === dispKey ? { ...b, gridX: bestCol, gridY: bestRow } : b,
    );
  }

  return updated;
}

/**
 * Apply a span change (from the resize control). Reference semantics: spans
 * are set as-is — no clamping, no displacement (only a drop resolves
 * overlaps), and the full list is returned for the same batch-persist path.
 */
export function applyResize<T extends GridRect & { key: string }>(
  blocks: readonly T[],
  key: string,
  spanW: number,
  spanH: number,
): T[] {
  return blocks.map((b) => (b.key === key ? { ...b, spanW, spanH } : b));
}
