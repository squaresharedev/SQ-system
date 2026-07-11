import { Layers } from "lucide-react";
import { transformImage } from "@/lib/image";

export interface GridPreviewArtifact {
  id: string;
  imageUrl: string;
  gridX: number;
  gridY: number;
  spanW: number;
  spanH: number;
}

const PREVIEW_COLS = 12;
const PREVIEW_GAP = 2;

export function CollectionGridPreview({ artifacts }: { artifacts: GridPreviewArtifact[] }) {
  const maxRow = artifacts.length > 0
    ? artifacts.reduce((max, a) => Math.max(max, a.gridY + a.spanH - 1), 0)
    : 0;
  const minRows = Math.ceil(PREVIEW_COLS * (9 / 16));
  const rows = Math.max(minRows, maxRow);

  const cells = [];
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= PREVIEW_COLS; c++) {
      cells.push(
        <div
          key={`${r}-${c}`}
          className="rounded-[1px] bg-foreground/[0.04]"
          style={{ gridColumn: c, gridRow: r }}
        />,
      );
    }
  }

  return (
    <div
      className="relative aspect-video overflow-hidden bg-background"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${PREVIEW_COLS}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: `${PREVIEW_GAP}px`,
        padding: `${PREVIEW_GAP}px`,
      }}
    >
      {cells}
      {artifacts.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Layers size={28} className="text-muted-foreground/40" />
        </div>
      )}
      {artifacts.map((art) => (
        <div
          key={art.id}
          className="overflow-hidden rounded-[2px] bg-muted"
          style={{
            gridColumn: `${art.gridX} / span ${art.spanW}`,
            gridRow: `${art.gridY} / span ${art.spanH}`,
          }}
        >
          <img
            src={transformImage(art.imageUrl, { width: 240 })}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>
      ))}
    </div>
  );
}
