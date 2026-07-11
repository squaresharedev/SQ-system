import { useState, useRef, useCallback, useEffect } from "react";
import { ZoomIn, ZoomOut, Move, Crop } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageCropperProps {
  imageUrl: string;
  gridCols: number;
  onCrop: (croppedDataUrl: string, colSpan: number, rowSpan: number) => void;
  onReset: () => void;
}

type DragEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | null;

const EDGE_CURSORS: Record<string, string> = {
  n: "ns-resize", s: "ns-resize",
  e: "ew-resize", w: "ew-resize",
  ne: "nesw-resize", sw: "nesw-resize",
  nw: "nwse-resize", se: "nwse-resize",
};

const MAX_CROP_COLS = 6;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.01;

/**
 * ImageCropper — Grid-based crop with two modes:
 *
 * **Resize mode** (default): Drag edges/corners to trim cells from any side.
 *   The image stays fixed in place — only the visible frame shrinks/grows.
 *
 * **Pan mode** (double-click to toggle): Drag to move the image within
 *   the fixed crop frame. The frame size (aspect ratio) is locked.
 */
export function ImageCropper({
  imageUrl,
  gridCols: realGridCols,
  onCrop,
  onReset,
}: ImageCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const cropCols = Math.min(realGridCols, MAX_CROP_COLS);

  const [gridRows, setGridRows] = useState(0);
  const [cellSize, setCellSize] = useState(0);
  const [naturalW, setNaturalW] = useState(0);
  const [naturalH, setNaturalH] = useState(0);

  // Frame bounds (1-based inclusive)
  const [c1, setC1] = useState(1);
  const [r1, setR1] = useState(1);
  const [c2, setC2] = useState(1);
  const [r2, setR2] = useState(1);

  // Image offset in pan mode (pixels, relative to full grid origin)
  const [imgOffX, setImgOffX] = useState(0);
  const [imgOffY, setImgOffY] = useState(0);

  // Zoom
  const [zoom, setZoom] = useState(MIN_ZOOM);

  // Pan mode toggle
  const [panMode, setPanMode] = useState(false);

  // Drag state
  const [dragEdge, setDragEdge] = useState<DragEdge>(null);
  const [isPanning, setIsPanning] = useState(false);
  const dragStart = useRef<{
    x: number; y: number;
    c1: number; r1: number; c2: number; r2: number;
    offX: number; offY: number;
  } | null>(null);

  // Pinch-to-zoom tracking
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPinchDistRef = useRef<number | null>(null);
  const pinchBaseZoomRef = useRef(MIN_ZOOM);

  const handleImageLoad = useCallback(() => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return;

    setNaturalW(img.naturalWidth);
    setNaturalH(img.naturalHeight);

    const containerW = container.clientWidth;
    const cs = containerW / cropCols;
    setCellSize(cs);

    const displayH = (img.naturalHeight / img.naturalWidth) * containerW;
    const rows = Math.max(1, Math.round(displayH / cs));
    setGridRows(rows);

    setC1(1); setR1(1); setC2(cropCols); setR2(rows);
    setImgOffX(0); setImgOffY(0);
    setZoom(MIN_ZOOM);
  }, [cropCols]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !naturalW) return;
    const ro = new ResizeObserver(() => {
      const containerW = container.clientWidth;
      const cs = containerW / cropCols;
      setCellSize(cs);
      const displayH = (naturalH / naturalW) * containerW;
      setGridRows(Math.max(1, Math.round(displayH / cs)));
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [cropCols, naturalW, naturalH]);

  const colSpan = c2 - c1 + 1;
  const rowSpan = r2 - r1 + 1;

  // Pixel rect of frame
  const frameLeft = (c1 - 1) * cellSize;
  const frameTop = (r1 - 1) * cellSize;
  const frameW = colSpan * cellSize;
  const frameH = rowSpan * cellSize;

  const HANDLE = 12;

  const hitTest = useCallback(
    (clientX: number, clientY: number): DragEdge => {
      const el = containerRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      const left = frameLeft, right = frameLeft + frameW;
      const top = frameTop, bottom = frameTop + frameH;

      const onL = Math.abs(x - left) < HANDLE && y >= top - HANDLE && y <= bottom + HANDLE;
      const onR = Math.abs(x - right) < HANDLE && y >= top - HANDLE && y <= bottom + HANDLE;
      const onT = Math.abs(y - top) < HANDLE && x >= left - HANDLE && x <= right + HANDLE;
      const onB = Math.abs(y - bottom) < HANDLE && x >= left - HANDLE && x <= right + HANDLE;

      if (onT && onL) return "nw";
      if (onT && onR) return "ne";
      if (onB && onL) return "sw";
      if (onB && onR) return "se";
      if (onT) return "n";
      if (onB) return "s";
      if (onL) return "w";
      if (onR) return "e";
      return null;
    },
    [frameLeft, frameTop, frameW, frameH],
  );

  const isInsideFrame = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      return x > frameLeft + HANDLE && x < frameLeft + frameW - HANDLE &&
             y > frameTop + HANDLE && y < frameTop + frameH - HANDLE;
    },
    [frameLeft, frameTop, frameW, frameH],
  );

  const [cursor, setCursor] = useState("default");

  const updateCursor = useCallback(
    (clientX: number, clientY: number) => {
      if (panMode) {
        setCursor(isInsideFrame(clientX, clientY) ? "grab" : "default");
      } else {
        const edge = hitTest(clientX, clientY);
        setCursor(edge ? EDGE_CURSORS[edge] : "default");
      }
    },
    [panMode, hitTest, isInsideFrame],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      // Pinch start — two fingers
      if (pointersRef.current.size === 2) {
        const pts = [...pointersRef.current.values()];
        lastPinchDistRef.current = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        pinchBaseZoomRef.current = zoom;
        return;
      }
      if (pointersRef.current.size > 2) return;

      if (panMode) {
        // Pan mode: drag the image inside the frame
        if (!isInsideFrame(e.clientX, e.clientY)) return;
        setIsPanning(true);
        setCursor("grabbing");
        dragStart.current = {
          x: e.clientX, y: e.clientY,
          c1, r1, c2, r2,
          offX: imgOffX, offY: imgOffY,
        };
        return;
      }

      // Resize mode: drag edges
      const edge = hitTest(e.clientX, e.clientY);
      if (!edge) return;
      setDragEdge(edge);
      setCursor(EDGE_CURSORS[edge]);
      dragStart.current = {
        x: e.clientX, y: e.clientY,
        c1, r1, c2, r2,
        offX: imgOffX, offY: imgOffY,
      };
    },
    [panMode, hitTest, isInsideFrame, c1, r1, c2, r2, imgOffX, imgOffY, zoom],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      // Track pointer position for pinch
      if (pointersRef.current.has(e.pointerId)) {
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      // Pinch zoom — two active fingers
      if (pointersRef.current.size === 2 && lastPinchDistRef.current != null) {
        const pts = [...pointersRef.current.values()];
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const scale = dist / lastPinchDistRef.current;
        setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchBaseZoomRef.current * scale)));
        return;
      }

      // Update cursor when not actively dragging
      if (!dragEdge && !isPanning) {
        updateCursor(e.clientX, e.clientY);
        return;
      }

      if (!dragStart.current || cellSize === 0) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      const s = dragStart.current;

      if (isPanning) {
        // Pan: move image offset (free-form, pixel-based)
        setImgOffX(s.offX + dx);
        setImgOffY(s.offY + dy);
        return;
      }

      // Resize: snap to grid cells
      const dCols = Math.round(dx / cellSize);
      const dRows = Math.round(dy / cellSize);

      let nc1 = s.c1, nr1 = s.r1, nc2 = s.c2, nr2 = s.r2;

      if (dragEdge?.includes("w")) nc1 = Math.max(1, Math.min(s.c2, s.c1 + dCols));
      if (dragEdge?.includes("e")) nc2 = Math.max(s.c1, Math.min(cropCols, s.c2 + dCols));
      if (dragEdge?.includes("n")) nr1 = Math.max(1, Math.min(s.r2, s.r1 + dRows));
      if (dragEdge?.includes("s")) nr2 = Math.max(s.r1, Math.min(gridRows, s.r2 + dRows));

      setC1(nc1); setR1(nr1); setC2(nc2); setR2(nr2);
    },
    [dragEdge, isPanning, cellSize, cropCols, gridRows, updateCursor],
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) lastPinchDistRef.current = null;
    setDragEdge(null);
    setIsPanning(false);
    dragStart.current = null;
  }, []);

  const handleDoubleClick = useCallback(() => {
    setPanMode((prev) => !prev);
  }, []);

  // Scroll-to-zoom — native listener to prevent page scroll (React onWheel is passive)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z - e.deltaY * 0.002)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Crop via offscreen canvas — transform-based math matching CSS render
  const handleConfirm = useCallback(() => {
    if (!naturalW || !naturalH || gridRows === 0) return;

    const bW = cellSize * cropCols;
    const bH = cellSize * gridRows;
    const halfW = bW / 2;
    const halfH = bH / 2;

    // Map frame top-left from screen coords to image-local coords.
    // CSS transform: translate(offX, offY) scale(zoom) with origin center.
    // Inverse: lx = (sx - offX - halfW) / zoom + halfW
    const ix = (frameLeft - imgOffX - halfW) / zoom + halfW;
    const iy = (frameTop - imgOffY - halfH) / zoom + halfH;
    const visW = frameW / zoom;
    const visH = frameH / zoom;

    // Map to natural image pixels
    const sx = (ix / bW) * naturalW;
    const sy = (iy / bH) * naturalH;
    const sw = (visW / bW) * naturalW;
    const sh = (visH / bH) * naturalH;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext("2d");
    if (!ctx || !imgRef.current) return;

    ctx.drawImage(
      imgRef.current,
      Math.round(sx), Math.round(sy), Math.round(sw), Math.round(sh),
      0, 0, canvas.width, canvas.height,
    );

    onCrop(canvas.toDataURL("image/jpeg", 0.92), colSpan, rowSpan);
  }, [naturalW, naturalH, gridRows, cropCols, cellSize, zoom, frameLeft, frameTop, frameW, frameH, imgOffX, imgOffY, colSpan, rowSpan, onCrop]);

  // Full image display dimensions (at zoom = 1)
  const baseW = cellSize * cropCols;
  const baseH = cellSize * gridRows;

  return (
    <div className="flex flex-col gap-3">
      {/* Cropper area */}
      <div
        ref={containerRef}
        className="relative w-full select-none overflow-hidden rounded-[--radius-card] border border-border bg-muted"
        style={{
          height: gridRows > 0 ? baseH : 240,
          cursor,
          touchAction: "none",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        {/* Image — zoom scales from top-left, pan offsets reposition */}
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Crop preview"
          className="absolute"
          draggable={false}
          onLoad={handleImageLoad}
          style={{
            width: baseW,
            height: baseH,
            transformOrigin: "center center",
            transform: `translate(${imgOffX}px, ${imgOffY}px) scale(${zoom})`,
          }}
        />

        {/* Dark overlays on cropped-out edges */}
        {cellSize > 0 && (
          <>
            {frameTop > 0 && (
              <div className="pointer-events-none absolute bg-black/50" style={{ left: 0, top: 0, width: baseW, height: frameTop }} />
            )}
            {frameTop + frameH < baseH && (
              <div className="pointer-events-none absolute bg-black/50" style={{ left: 0, top: frameTop + frameH, width: baseW, height: baseH - frameTop - frameH }} />
            )}
            {frameLeft > 0 && (
              <div className="pointer-events-none absolute bg-black/50" style={{ left: 0, top: frameTop, width: frameLeft, height: frameH }} />
            )}
            {frameLeft + frameW < baseW && (
              <div className="pointer-events-none absolute bg-black/50" style={{ left: frameLeft + frameW, top: frameTop, width: baseW - frameLeft - frameW, height: frameH }} />
            )}
          </>
        )}

        {/* Frame border + grid lines */}
        {cellSize > 0 && (
          <div
            className="pointer-events-none absolute ring-2 ring-white/90"
            style={{ left: frameLeft, top: frameTop, width: frameW, height: frameH }}
          >
            {Array.from({ length: colSpan - 1 }, (_, i) => (
              <div
                key={`sv-${i}`}
                className="absolute top-0 h-full w-px bg-white/30"
                style={{ left: (i + 1) * cellSize }}
              />
            ))}
            {Array.from({ length: rowSpan - 1 }, (_, i) => (
              <div
                key={`sh-${i}`}
                className="absolute left-0 h-px w-full bg-white/30"
                style={{ top: (i + 1) * cellSize }}
              />
            ))}
          </div>
        )}

        {/* Corner handles */}
        {cellSize > 0 && !panMode && (
          <>
            {([
              ["nw", frameLeft, frameTop],
              ["ne", frameLeft + frameW, frameTop],
              ["sw", frameLeft, frameTop + frameH],
              ["se", frameLeft + frameW, frameTop + frameH],
            ] as const).map(([key, x, y]) => (
              <div
                key={key}
                className="pointer-events-none absolute h-3 w-3 rounded-full bg-white shadow"
                style={{ left: x - 6, top: y - 6 }}
              />
            ))}
            {([
              ["n", frameLeft + frameW / 2, frameTop],
              ["s", frameLeft + frameW / 2, frameTop + frameH],
              ["w", frameLeft, frameTop + frameH / 2],
              ["e", frameLeft + frameW, frameTop + frameH / 2],
            ] as const).map(([key, x, y]) => (
              <div
                key={key}
                className="pointer-events-none absolute h-2 w-2 rounded-full bg-white/80 shadow-sm"
                style={{ left: x - 4, top: y - 4 }}
              />
            ))}
          </>
        )}

        {/* Pan mode indicator */}
        {panMode && (
          <div className="pointer-events-none absolute left-3 top-3 rounded-[--radius-pill] bg-black/60 px-2 py-1 text-[10px] font-medium text-white">
            Drag to reposition image
          </div>
        )}
      </div>

      {/* Zoom slider + mode toggle */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPanMode(false)}
            className={cn(
              "flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors",
              !panMode ? "bg-foreground text-accent-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
            )}
            title="Resize frame"
          >
            <Crop size={12} />
            Crop
          </button>
          <button
            type="button"
            onClick={() => setPanMode(true)}
            className={cn(
              "flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors",
              panMode ? "bg-foreground text-accent-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
            )}
            title="Pan image"
          >
            <Move size={12} />
            Pan
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <ZoomOut size={14} className="text-muted-foreground" />
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={ZOOM_STEP}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-foreground"
          />
          <ZoomIn size={14} className="text-muted-foreground" />
          <span className="ml-1 min-w-[3ch] text-[11px] text-muted-foreground">{Math.round(zoom * 100)}%</span>
        </div>
      </div>

      {/* Info bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Size: <span className="font-medium text-foreground">{colSpan}×{rowSpan}</span> cells
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onReset}
            className={cn(
              "rounded-[--radius-pill] border border-border px-3 py-1",
              "text-xs transition-colors hover:bg-muted",
            )}
          >
            Change Image
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={cn(
              "rounded-[--radius-pill] bg-foreground px-3 py-1",
              "text-xs font-medium text-accent-foreground",
              "transition-opacity hover:opacity-80",
            )}
          >
            Confirm Crop
          </button>
        </div>
      </div>
    </div>
  );
}
