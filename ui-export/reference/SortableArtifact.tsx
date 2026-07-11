import { useDraggable } from "@dnd-kit/core";
import type { GridItem } from "@/types";
import { ArtifactCard } from "./ArtifactCard";

interface DraggableArtifactProps {
  item: GridItem;
  onSpanChange: (itemId: string, colSpan: number, rowSpan: number) => void;
  onDelete: (itemId: string) => void;
  onImageOffsetChange?: (itemId: string, offsetX: number, offsetY: number) => void;
  onOpenDetail?: (item: GridItem) => void;
}

/**
 * Wrapper that makes an ArtifactCard draggable via dnd-kit.
 * Uses explicit CSS Grid placement from position data.
 * During drag, item dims and the DragOverlay shows the floating card.
 */
export function DraggableArtifact({
  item,
  onSpanChange,
  onDelete,
  onImageOffsetChange,
  onOpenDetail,
}: DraggableArtifactProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useDraggable({ id: item.id, data: item });

  const { col, row, colSpan, rowSpan } = item.position;

  const style: React.CSSProperties = {
    gridColumn: `${col} / span ${colSpan}`,
    gridRow: `${row} / span ${rowSpan}`,
    opacity: isDragging ? 0.25 : 1,
    zIndex: 1,
    cursor: isDragging ? "grabbing" : "grab",
    transition: isDragging ? "none" : "opacity 200ms ease",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ArtifactCard
        item={item}
        onSpanChange={onSpanChange}
        onDelete={onDelete}
        onImageOffsetChange={onImageOffsetChange}
        onOpenDetail={onOpenDetail}
      />
    </div>
  );
}

// Re-export for backwards compatibility
export { DraggableArtifact as SortableArtifact };
