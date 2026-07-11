import { useState, useEffect, useRef, useCallback } from "react";
import type { GridItem } from "@/types";
import { Resizer } from "./Resizer";
import { Trash2, ImageOff, Heart, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { transformImage, buildSrcSet } from "@/lib/image";

interface ArtifactCardProps {
  item: GridItem;
  /** Rendered in DragOverlay — no interactive controls */
  isOverlay?: boolean;
  onSpanChange?: (itemId: string, colSpan: number, rowSpan: number) => void;
  onDelete?: (itemId: string) => void;
  onImageOffsetChange?: (itemId: string, offsetX: number, offsetY: number) => void;
  onOpenDetail?: (item: GridItem) => void;
}

/**
 * ArtifactCard — The visual container for a single grid artifact.
 *
 * Renders the image filling the cell with `object-cover`.
 * On hover, a gradient metadata overlay slides up from the bottom.
 * A Resizer handle sits at the bottom-right corner.
 * Double-click to enter pan mode and reposition the image within its frame.
 */
export function ArtifactCard({
  item,
  isOverlay = false,
  onSpanChange,
  onDelete,
  onImageOffsetChange,
  onOpenDetail,
}: ArtifactCardProps) {
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const { artifact } = item;

  // ── Pan mode state ─────────────────────────────────────────────
  const [panning, setPanning] = useState(false);
  const [offsetX, setOffsetX] = useState(artifact.imgOffsetX ?? 50);
  const [offsetY, setOffsetY] = useState(artifact.imgOffsetY ?? 50);
  const panStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Sync from artifact prop when not actively panning
  useEffect(() => {
    if (!panning) {
      setOffsetX(artifact.imgOffsetX ?? 50);
      setOffsetY(artifact.imgOffsetY ?? 50);
    }
  }, [artifact.imgOffsetX, artifact.imgOffsetY, panning]);

  // Reset error state when imageUrl changes
  useEffect(() => {
    setImgError(false);
    setImgLoaded(false);
  }, [artifact.imageUrl]);

  // Exit pan mode on Escape
  useEffect(() => {
    if (!panning) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPanning(false);
        onImageOffsetChange?.(item.id, offsetX, offsetY);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [panning, offsetX, offsetY, item.id, onImageOffsetChange]);

  // Exit pan mode on click outside
  useEffect(() => {
    if (!panning) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setPanning(false);
        onImageOffsetChange?.(item.id, offsetX, offsetY);
      }
    };
    window.addEventListener("pointerdown", handleClickOutside);
    return () => window.removeEventListener("pointerdown", handleClickOutside);
  }, [panning, offsetX, offsetY, item.id, onImageOffsetChange]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!panning) {
      setPanning(true);
    } else {
      setPanning(false);
      onImageOffsetChange?.(item.id, offsetX, offsetY);
    }
  }, [panning, offsetX, offsetY, item.id, onImageOffsetChange]);

  const handlePanPointerDown = useCallback((e: React.PointerEvent) => {
    if (!panning) return;
    e.stopPropagation();
    e.preventDefault();
    panStart.current = { x: e.clientX, y: e.clientY, ox: offsetX, oy: offsetY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [panning, offsetX, offsetY]);

  const handlePanPointerMove = useCallback((e: React.PointerEvent) => {
    if (!panning || !panStart.current) return;
    e.stopPropagation();
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const dx = ((e.clientX - panStart.current.x) / rect.width) * 100;
    const dy = ((e.clientY - panStart.current.y) / rect.height) * 100;
    // Subtract delta because moving pointer right should shift focal point right
    setOffsetX(Math.max(0, Math.min(100, panStart.current.ox - dx)));
    setOffsetY(Math.max(0, Math.min(100, panStart.current.oy - dy)));
  }, [panning]);

  const handlePanPointerUp = useCallback((e: React.PointerEvent) => {
    if (!panning) return;
    e.stopPropagation();
    panStart.current = null;
  }, [panning]);

  // Single-click detection (delay to avoid firing on double-click)
  const clickTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleClick = useCallback((_e: React.MouseEvent) => {
    if (panning || isOverlay) return;
    // Clear any pending single-click on subsequent clicks
    clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      onOpenDetail?.(item);
    }, 250);
  }, [panning, isOverlay, item, onOpenDetail]);

  const handleDoubleClickWrapper = useCallback((e: React.MouseEvent) => {
    clearTimeout(clickTimer.current);
    handleDoubleClick(e);
  }, [handleDoubleClick]);

  return (
    <div
      ref={cardRef}
      className={cn(
        "group relative h-full w-full overflow-hidden border border-border bg-muted",
        "rounded-[--radius-card] shadow-[--shadow-card]",
        "transition-shadow duration-[--duration-normal]",
        !isOverlay && "hover:shadow-md",
        panning && "ring-2 ring-foreground/40",
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); }}
      onClick={!isOverlay ? handleClick : undefined}
      onDoubleClick={!isOverlay ? handleDoubleClickWrapper : undefined}
    >
      {/* ── Image ──────────────────────────────── */}
      {artifact.imageUrl && !imgError ? (
        <>
          {!imgLoaded && (
            <div className="absolute inset-0 animate-pulse bg-muted" aria-hidden />
          )}
          <img
            src={transformImage(artifact.imageUrl, { width: 640 })}
            srcSet={buildSrcSet(artifact.imageUrl, 640)}
            alt={artifact.title}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-200",
              imgLoaded ? "opacity-100" : "opacity-0",
              panning && "cursor-move",
            )}
            style={{
              transformOrigin: `${offsetX}% ${offsetY}%`,
              transform: "scale(1.5)",
            }}
            draggable={false}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            onPointerDown={handlePanPointerDown}
            onPointerMove={handlePanPointerMove}
            onPointerUp={handlePanPointerUp}
          />
        </>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
          <ImageOff size={24} />
          <span className="max-w-[80%] truncate text-xs">{artifact.title}</span>
        </div>
      )}

      {/* ── Metadata overlay (gradient, bottom) ── */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 flex flex-col justify-end px-4 pb-3 pt-10",
          "bg-gradient-to-t from-black/80 to-transparent",
          "transition-all duration-[--duration-normal]",
          hovered && !isOverlay && !panning
            ? "translate-y-0 opacity-100"
            : "translate-y-2 opacity-0",
        )}
      >
        <span className="truncate text-sm font-medium text-white">{artifact.title}</span>
        <span className="truncate text-xs text-white/70">
          {artifact.description}
        </span>
      </div>

      {/* ── Controls (only in live cards, not overlay) ── */}
      {!isOverlay && !panning && (
        <>
          {/* Delete button — top-right */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(item.id);
            }}
            className={cn(
              "absolute right-2 top-2 flex h-7 w-7 items-center justify-center",
              "rounded-[--radius-pill] bg-foreground/80 text-accent-foreground",
              "transition-all duration-[--duration-fast]",
              "hover:scale-110 hover:bg-destructive",
              hovered ? "opacity-100" : "opacity-0",
            )}
            aria-label={`Delete ${artifact.title}`}
          >
            <Trash2 size={14} />
          </button>

          {/* Like + Report — top-left, visible on hover */}
          <div
            className={cn(
              "absolute left-2 top-2 flex gap-1.5",
              "transition-all duration-[--duration-fast]",
              hovered ? "opacity-100" : "opacity-0",
            )}
          >
            <button
              onClick={(e) => e.stopPropagation()}
              className="flex h-7 w-7 items-center justify-center rounded-[--radius-pill] bg-foreground/80 text-accent-foreground transition-all duration-[--duration-fast] hover:scale-110 hover:bg-red-500"
              aria-label="Like"
            >
              <Heart size={14} />
            </button>
            <button
              onClick={(e) => e.stopPropagation()}
              className="flex h-7 w-7 items-center justify-center rounded-[--radius-pill] bg-foreground/80 text-accent-foreground transition-all duration-[--duration-fast] hover:scale-110 hover:bg-yellow-500"
              aria-label="Report"
            >
              <Flag size={14} />
            </button>
          </div>

          {/* Resizer handle — bottom-right */}
          <div
            className={cn(
              "absolute bottom-2 right-2 transition-opacity duration-[--duration-fast]",
              hovered ? "opacity-100" : "opacity-0",
            )}
          >
            <Resizer
              currentColSpan={item.position.colSpan}
              currentRowSpan={item.position.rowSpan}
              onChange={(colSpan, rowSpan) =>
                onSpanChange?.(item.id, colSpan, rowSpan)
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
