"use client";

import { useEffect, useState, type RefObject } from "react";
import {
  DEFAULT_GRID_GEOMETRY,
  GRID_COLUMNS_FALLBACK,
  GRID_GAP_FALLBACK,
  type GridCellGeometry,
} from "./types.js";

// The square-cell geometry contract from the old GridCanvas, verbatim:
// columns + gap are read live off document.documentElement's --grid-columns /
// --grid-gap custom properties (NOT the grid element) so the responsive
// media-query overrides AND the Settings density control — which writes these
// vars onto documentElement at runtime — keep working. Cell size derives from
// the measured container width; a ResizeObserver recomputes on any resize.
//
// NOTE: values are read with parseInt, so the vars must resolve to unitless
// or px values ("12" or "12px" → 12; "0.5rem" parses as 0 → fallback).

/**
 * Measure the positioned grid's cell geometry from the element in `ref`.
 * Returns `defaults` until the element mounts and is first measured.
 */
export function useGridCellGeometry(
  ref: RefObject<HTMLElement | null>,
  defaults: GridCellGeometry = DEFAULT_GRID_GEOMETRY,
): GridCellGeometry {
  const [geometry, setGeometry] = useState<GridCellGeometry>(defaults);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const compute = () => {
      const style = getComputedStyle(document.documentElement);
      const columns =
        parseInt(style.getPropertyValue("--grid-columns")) ||
        GRID_COLUMNS_FALLBACK;
      const gap =
        parseInt(style.getPropertyValue("--grid-gap")) || GRID_GAP_FALLBACK;
      const width = el.clientWidth;
      const next: GridCellGeometry = {
        columns,
        gap,
        cellSize: (width - (columns - 1) * gap) / columns,
      };
      setGeometry((prev) =>
        prev.cellSize === next.cellSize &&
        prev.gap === next.gap &&
        prev.columns === next.columns
          ? prev
          : next,
      );
    };
    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return geometry;
}

/**
 * One-shot read of the current column count (same CSS-var contract as the
 * hook). For imperative call sites — e.g. computing a findOpenSlot placement
 * when creating a new artifact. Returns `fallback` during SSR.
 */
export function readGridColumns(
  fallback: number = GRID_COLUMNS_FALLBACK,
): number {
  if (typeof document === "undefined") return fallback;
  return (
    parseInt(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--grid-columns",
      ),
    ) || fallback
  );
}
