import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import type { GridItem } from "@/types";
import {
  artifactKeys,
  useArtifacts,
  useCreateArtifact,
  useBatchUpdatePositions,
  useDeleteArtifact,
  useUpdateArtifact,
} from "@/hooks/useArtifacts";
import { DraggableArtifact } from "./SortableArtifact";
import { ArtifactCard } from "./ArtifactCard";
import { ArtifactModal } from "./ArtifactModal";
import { ArtifactDetailModal } from "./ArtifactDetailModal";
import { useToast } from "./Toast";
import { collectionApi } from "@/services/api";
import { Plus, Layers, Settings, Globe, Lock, Check, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Demo seed data (used when API is unavailable) ─────────────────
const DEMO_ITEMS: GridItem[] = [
  {
    id: "item-1",
    artifact: {
      id: "a1",
      title: "Prototype PCB v3",
      description: "Third revision of the main controller board.",
      imageUrl: "https://placehold.co/480x480/000/fff?text=PCB+v3",
      imgOffsetX: 50,
      imgOffsetY: 50,
      dateAdded: new Date().toISOString(),
    },
    position: { col: 1, row: 1, colSpan: 2, rowSpan: 2 },
  },
  {
    id: "item-2",
    artifact: {
      id: "a2",
      title: "Helvetica Specimen",
      description: "Original 1957 type specimen sheet.",
      imageUrl: "https://placehold.co/480x240/000/fff?text=Helvetica",
      imgOffsetX: 50,
      imgOffsetY: 50,
      dateAdded: new Date().toISOString(),
    },
    position: { col: 3, row: 1, colSpan: 4, rowSpan: 2 },
  },
  {
    id: "item-3",
    artifact: {
      id: "a3",
      title: "Dieter Rams SK4",
      description: "Braun SK4 radiogram, 1956.",
      imageUrl: "https://placehold.co/360x360/000/fff?text=SK4",
      imgOffsetX: 50,
      imgOffsetY: 50,
      dateAdded: new Date().toISOString(),
    },
    position: { col: 7, row: 1, colSpan: 3, rowSpan: 3 },
  },
  {
    id: "item-4",
    artifact: {
      id: "a4",
      title: "Grid Notebook",
      description: "Leuchtturm 1917 dot grid A5.",
      imageUrl: "https://placehold.co/240x240/000/fff?text=Notebook",
      imgOffsetX: 50,
      imgOffsetY: 50,
      dateAdded: new Date().toISOString(),
    },
    position: { col: 10, row: 1, colSpan: 2, rowSpan: 2 },
  },
];

/**
 * GridCanvas — The core 12-column draggable grid.
 *
 * Uses TanStack Query for data fetching + optimistic updates.
 * Falls back to demo seed data when the API is unavailable,
 * so the grid is always functional during frontend-only development.
 */
interface GridCanvasProps {
  modalOpen: boolean;
  onCloseModal: () => void;
  activeCollectionId?: string | null;
  collectionName?: string | null;
  collectionIsPublic?: boolean;
  onAddArtifact?: () => void;
}

export function GridCanvas({ modalOpen, onCloseModal, activeCollectionId, collectionName, collectionIsPublic: collectionIsPublicProp = false, onAddArtifact }: GridCanvasProps) {
  // ── Compute square cell size from container width ──────────────
  const gridRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(120);
  const [gap, setGap] = useState(12);
  const [cols, setCols] = useState(12);
  const { progressToast, toast } = useToast();

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const compute = () => {
      const style = getComputedStyle(document.documentElement);
      const c = parseInt(style.getPropertyValue("--grid-columns")) || 12;
      const g = parseInt(style.getPropertyValue("--grid-gap")) || 12;
      setCols(c);
      setGap(g);
      const w = el.clientWidth;
      setCellSize((w - (c - 1) * g) / c);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── TanStack Query hooks ───────────────────────────────────────
  const qc = useQueryClient();
  const { data: apiItems, isError: apiUnavailable, isLoading: apiLoading } = useArtifacts(activeCollectionId);
  const createMutation = useCreateArtifact();
  const batchMutation = useBatchUpdatePositions();
  const deleteMutation = useDeleteArtifact();
  const updateMutation = useUpdateArtifact();

  // ── Local state (fallback when API is down, or for demo) ───────
  const [localItems, setLocalItems] = useState<GridItem[]>(DEMO_ITEMS);

  // Use API data when available; demo items only as a true offline
  // fallback. While the real request is in flight we render nothing
  // (a spinner shows instead) so stale/placeholder data never leaks in.
  const items = apiUnavailable ? localItems : (apiItems ?? []);

  // Show a spinner only while genuinely fetching real data for a
  // selected collection (not during the offline/demo fallback).
  const showLoading = !apiUnavailable && apiLoading && activeCollectionId != null;

  const [activeId, setActiveId] = useState<string | null>(null);

  // ── Sensors (pointer + keyboard) ───────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  // ── Active item (for drag overlay) ─────────────────────────────
  const activeItem = useMemo(
    () => items.find((i) => i.id === activeId) ?? null,
    [items, activeId],
  );

  // ── Grid rows (enough to show items + extra space) ─────────────
  const MIN_ROWS = 6;
  const maxOccupiedRow = items.reduce(
    (max, item) => Math.max(max, item.position.row + item.position.rowSpan - 1),
    0,
  );
  const gridRows = Math.max(MIN_ROWS, maxOccupiedRow + 2);

  // ── Find open slot for new items ───────────────────────────────
  const findOpenSlot = useCallback(
    (w: number, h: number): { col: number; row: number } => {
      const occupied = new Set<string>();
      for (const item of items) {
        const { col, row, colSpan, rowSpan } = item.position;
        for (let r = row; r < row + rowSpan; r++) {
          for (let c = col; c < col + colSpan; c++) {
            occupied.add(`${c},${r}`);
          }
        }
      }
      for (let row = 1; ; row++) {
        for (let col = 1; col <= cols - w + 1; col++) {
          let free = true;
          for (let r = row; r < row + h && free; r++) {
            for (let c = col; c < col + w && free; c++) {
              if (occupied.has(`${c},${r}`)) free = false;
            }
          }
          if (free) return { col, row };
        }
      }
    },
    [items, cols],
  );

  // ── Handlers ───────────────────────────────────────────────────
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, delta } = event;
      setActiveId(null);

      if (!delta) return;

      const colOffset = Math.round(delta.x / (cellSize + gap));
      const rowOffset = Math.round(delta.y / (cellSize + gap));

      if (colOffset === 0 && rowOffset === 0) return;

      const item = items.find((i) => i.id === active.id);
      if (!item) return;

      const newCol = Math.max(1, Math.min(cols - item.position.colSpan + 1, item.position.col + colOffset));
      const newRow = Math.max(1, item.position.row + rowOffset);

      // Collect all overlapping items
      const overlappingIds = new Set<string>();
      for (const other of items) {
        if (other.id === active.id) continue;
        const oCol = other.position.col;
        const oRow = other.position.row;
        const oColEnd = oCol + other.position.colSpan;
        const oRowEnd = oRow + other.position.rowSpan;
        const nColEnd = newCol + item.position.colSpan;
        const nRowEnd = newRow + item.position.rowSpan;
        if (newCol < oColEnd && nColEnd > oCol && newRow < oRowEnd && nRowEnd > oRow) {
          overlappingIds.add(other.id);
        }
      }

      // Build the updated list: move the dragged item first
      let updated = items.map((i) =>
        i.id === active.id
          ? { ...i, position: { ...i.position, col: newCol, row: newRow } }
          : i,
      );

      // For each displaced item, find the nearest free slot
      for (const dispId of overlappingIds) {
        const dispItem = updated.find((i) => i.id === dispId);
        if (!dispItem) continue;

        const w = dispItem.position.colSpan;
        const h = dispItem.position.rowSpan;

        // Build occupied set excluding the displaced item itself
        const occupied = new Set<string>();
        for (const it of updated) {
          if (it.id === dispId) continue;
          const { col: ic, row: ir, colSpan: iw, rowSpan: ih } = it.position;
          for (let r = ir; r < ir + ih; r++) {
            for (let c = ic; c < ic + iw; c++) {
              occupied.add(`${c},${r}`);
            }
          }
        }

        // Search outward from the displaced item's current position
        const origCol = dispItem.position.col;
        const origRow = dispItem.position.row;
        let bestCol = origCol;
        let bestRow = origRow;
        let bestDist = Infinity;

        // Search nearby rows (within a generous range)
        const searchMaxRow = Math.max(maxOccupiedRow + 4, origRow + h + 4);
        for (let r = 1; r <= searchMaxRow; r++) {
          for (let c = 1; c <= cols - w + 1; c++) {
            let free = true;
            for (let dr = 0; dr < h && free; dr++) {
              for (let dc = 0; dc < w && free; dc++) {
                if (occupied.has(`${c + dc},${r + dr}`)) free = false;
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
          // Early exit: if we found a spot and moved past the row range where closer ones could exist
          if (bestDist < Infinity && r > origRow + bestDist) break;
        }

        updated = updated.map((i) =>
          i.id === dispId
            ? { ...i, position: { ...i.position, col: bestCol, row: bestRow } }
            : i,
        );
      }

      // Optimistically update the query cache so the item moves instantly
      qc.setQueryData(artifactKeys.list(activeCollectionId), updated);
      setLocalItems(updated);
      batchMutation.mutate(updated);
    },
    [items, cellSize, gap, cols, maxOccupiedRow, batchMutation, qc, activeCollectionId],
  );

  const handleSpanChange = useCallback(
    (itemId: string, colSpan: number, rowSpan: number) => {
      const updated = items.map((item) =>
        item.id === itemId
          ? { ...item, position: { ...item.position, colSpan, rowSpan } }
          : item,
      );
      qc.setQueryData(artifactKeys.list(activeCollectionId), updated);
      setLocalItems(updated);
      batchMutation.mutate(updated);
    },
    [items, batchMutation, qc, activeCollectionId],
  );

  const handleDelete = useCallback(
    (itemId: string) => {
      const filtered = items.filter((i) => i.id !== itemId);
      qc.setQueryData(artifactKeys.list(activeCollectionId), filtered);
      setLocalItems(filtered);
      deleteMutation.mutate(itemId);
    },
    [items, deleteMutation, qc, activeCollectionId],
  );

  const handleImageOffsetChange = useCallback(
    (itemId: string, offsetX: number, offsetY: number) => {
      // Optimistic local update
      const updated = items.map((i) =>
        i.id === itemId
          ? { ...i, artifact: { ...i.artifact, imgOffsetX: offsetX, imgOffsetY: offsetY } }
          : i,
      );
      qc.setQueryData(artifactKeys.list(activeCollectionId), updated);
      setLocalItems(updated);
      updateMutation.mutate({ id: itemId, imgOffsetX: offsetX, imgOffsetY: offsetY });
    },
    [items, updateMutation, qc, activeCollectionId],
  );

  const handleAddArtifact = useCallback(
    (title: string, description: string, imageUrl: string, colSpan: number, rowSpan: number) => {
      const slot = findOpenSlot(colSpan, rowSpan);

      // Close modal immediately
      onCloseModal();

      if (!apiUnavailable) {
        const t = progressToast("Uploading artifact…");
        createMutation.mutate(
          { title, description, imageUrl, collectionId: activeCollectionId ?? undefined, gridX: slot.col, gridY: slot.row, spanW: colSpan, spanH: rowSpan },
          {
            onSuccess: () => t.success("Artifact added to grid!"),
            onError: (err) => {
              const msg = err?.message?.includes("content moderation")
                ? "Upload rejected — violates community guidelines."
                : (err?.message ?? "Upload failed. Please try again.");
              t.error(msg);
            },
          },
        );
      } else {
        const newItem: GridItem = {
          id: `item-${Date.now()}`,
          artifact: {
            id: `a-${Date.now()}`,
            title,
            description,
            imageUrl,
            imgOffsetX: 50,
            imgOffsetY: 50,
            dateAdded: new Date().toISOString(),
          },
          position: { col: slot.col, row: slot.row, colSpan, rowSpan },
        };
        setLocalItems((prev) => [...prev, newItem]);
      }
    },
    [apiUnavailable, createMutation, activeCollectionId, onCloseModal, findOpenSlot, progressToast],
  );

  // ── Collection settings popover ──────────────────────────────────
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [collectionIsPublic, setCollectionIsPublic] = useState(collectionIsPublicProp);
  const [togglingPrivacy, setTogglingPrivacy] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Sync when prop changes (collection switched from outside)
  useEffect(() => {
    setCollectionIsPublic(collectionIsPublicProp);
  }, [collectionIsPublicProp]);

  // Close settings popover on outside click
  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [settingsOpen]);

  const handleTogglePrivacy = useCallback(async () => {
    if (!activeCollectionId || togglingPrivacy) return;
    setTogglingPrivacy(true);
    const newVal = !collectionIsPublic;
    try {
      await collectionApi.update(activeCollectionId, { isPublic: newVal });
      setCollectionIsPublic(newVal);
      toast(newVal ? "Collection is now public" : "Collection is now private", "success");
    } catch {
      toast("Failed to update privacy", "error");
    } finally {
      setTogglingPrivacy(false);
    }
  }, [activeCollectionId, collectionIsPublic, togglingPrivacy, toast]);

  // ── Artifact detail modal ────────────────────────────────────────
  const [detailItem, setDetailItem] = useState<GridItem | null>(null);

  const handleOpenDetail = useCallback((item: GridItem) => {
    setDetailItem(item);
  }, []);

  const handleDetailUpdate = useCallback(
    (id: string, title: string, description: string) => {
      const updated = items.map((i) =>
        i.id === id
          ? { ...i, artifact: { ...i.artifact, title, description } }
          : i,
      );
      qc.setQueryData(artifactKeys.list(activeCollectionId), updated);
      setLocalItems(updated);
      updateMutation.mutate({ id, title, description });
      // Update the detail modal's artifact in case it's still open
      setDetailItem((prev) =>
        prev && prev.id === id
          ? { ...prev, artifact: { ...prev.artifact, title, description } }
          : prev,
      );
    },
    [items, updateMutation, qc, activeCollectionId],
  );

  return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-8">
      {/* ── Header ──────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between sm:mb-8">
        <h1 className="text-xl font-medium tracking-tight sm:text-2xl">
          {collectionName || "The Grid"}
        </h1>
        <div className="flex items-center gap-2">
          {/* Add artifact button */}
          {onAddArtifact && (
            <button
              onClick={onAddArtifact}
              className="flex h-9 items-center gap-2 rounded-[--radius-card] bg-foreground px-4 text-sm font-medium text-accent-foreground transition-all duration-[--duration-fast] hover:opacity-90 active:scale-[0.98]"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span className="hidden sm:inline">Add Artifact</span>
            </button>
          )}

          {/* Copy link button (public collections only) */}
          {collectionIsPublic && <CopyLinkButton />}

          {/* Collection settings button */}
          {activeCollectionId && (
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setSettingsOpen((v) => !v)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-[--radius-card] border border-border transition-all duration-[--duration-fast] hover:bg-muted active:scale-[0.98]",
                  settingsOpen && "bg-muted",
                )}
                aria-label="Collection settings"
              >
                <Settings size={16} />
              </button>

              {/* Settings popover */}
              {settingsOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-[calc(100vw-2rem)] rounded-xl border border-border bg-background p-4 shadow-lg sm:w-64">
                  <h3 className="mb-3 text-sm font-medium">Collection Settings</h3>
                  <button
                    onClick={handleTogglePrivacy}
                    disabled={togglingPrivacy}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    {collectionIsPublic ? (
                      <Globe size={16} className="shrink-0 text-green-500" />
                    ) : (
                      <Lock size={16} className="shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <span className="block font-medium">
                        {collectionIsPublic ? "Public" : "Private"}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {collectionIsPublic
                          ? "Anyone can see this collection"
                          : "Only you can see this collection"}
                      </span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Grid ────────────────────────────────── */}
      <div className="relative">
        {/* Loading spinner — shown while fetching real artifact data
            for the selected collection. */}
        {showLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            <div className="h-6 w-6 spinner rounded-full border-2 border-muted-foreground/25 border-t-foreground" />
          </div>
        )}

        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div
            ref={gridRef}
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gridTemplateRows: `repeat(${gridRows}, ${cellSize}px)`,
              gap: `${gap}px`,
            }}
          >
            {/* Background grid cells */}
            {Array.from({ length: gridRows * cols }, (_, i) => {
              const c = (i % cols) + 1;
              const r = Math.floor(i / cols) + 1;
              return (
                <div
                  key={`cell-${c}-${r}`}
                  style={{ gridColumn: c, gridRow: r }}
                  className="rounded-[--radius-card] border border-dashed border-border/30 bg-muted/10"
                />
              );
            })}

            {/* Artifact items (explicit placement, above grid cells) */}
            {items.map((item) => (
              <DraggableArtifact
                key={item.id}
                item={item}
                onSpanChange={handleSpanChange}
                onDelete={handleDelete}
                onImageOffsetChange={handleImageOffsetChange}
                onOpenDetail={handleOpenDetail}
              />
            ))}
          </div>

          {/* Empty state overlay */}
          {items.length === 0 && !showLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              {!activeCollectionId ? (
                <div className="flex flex-col items-center px-4 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-background shadow-sm">
                    <Layers size={28} className="text-muted-foreground" />
                  </div>
                  <h2 className="mb-1 text-lg font-medium">Start by creating a collection</h2>
                  <p className="mb-2 max-w-xs text-sm text-muted-foreground">
                    Collections organise your artifacts. Use the sidebar (desktop) or the Collections tab (mobile) to create your first one.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center px-4 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-background shadow-sm">
                    <Layers size={28} className="text-muted-foreground" />
                  </div>
                  <h2 className="mb-1 text-lg font-medium">Collection is empty</h2>
                  <p className="mb-6 max-w-xs text-sm text-muted-foreground">
                    Add your first artifact to start curating.
                  </p>
                  {onAddArtifact && (
                    <button
                      onClick={onAddArtifact}
                      className="flex h-11 items-center gap-2 rounded-[--radius-card] bg-foreground px-5 text-sm font-medium text-accent-foreground transition-all duration-[--duration-fast] hover:opacity-90 active:scale-[0.98]"
                    >
                      <Plus size={16} strokeWidth={2.5} />
                      Add Artifact
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Drag overlay — floating card follows cursor */}
          <DragOverlay dropAnimation={null}>
            {activeItem ? (
              <div
                style={{
                  width: activeItem.position.colSpan * cellSize + (activeItem.position.colSpan - 1) * gap,
                  height: activeItem.position.rowSpan * cellSize + (activeItem.position.rowSpan - 1) * gap,
                }}
                className="rounded-[--radius-card] shadow-2xl ring-2 ring-foreground/20"
              >
                <ArtifactCard item={activeItem} isOverlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* ── Add Artifact Modal ──────────────────── */}
      {modalOpen && (
        <ArtifactModal
          onSubmit={handleAddArtifact}
          onClose={() => { createMutation.reset(); onCloseModal(); }}
          gridCols={cols}
        />
      )}

      {/* ── Artifact Detail Modal ───────────────── */}
      {detailItem && (
        <ArtifactDetailModal
          artifact={detailItem.artifact}
          isOwner
          onClose={() => setDetailItem(null)}
          onUpdate={handleDetailUpdate}
        />
      )}
    </div>
  );
}

function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "flex h-9 shrink-0 items-center gap-2 rounded-[--radius-card] border border-border px-3 text-sm transition-all duration-150",
        copied
          ? "border-foreground/30 bg-muted text-foreground"
          : "text-muted-foreground hover:border-foreground/20 hover:text-foreground active:scale-95",
      )}
      aria-label="Copy collection link"
    >
      {copied ? <Check size={14} /> : <Link2 size={14} />}
      <span className="hidden sm:inline">{copied ? "Copied!" : "Share"}</span>
    </button>
  );
}
