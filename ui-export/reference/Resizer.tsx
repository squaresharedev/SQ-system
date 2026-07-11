import { useState, useRef, useEffect } from "react";
import { SPAN_PRESETS, type SpanPreset } from "@/types";
import { Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResizerProps {
  currentColSpan: number;
  currentRowSpan: number;
  onChange: (colSpan: number, rowSpan: number) => void;
}

/**
 * Resizer — A high-contrast toggle handle for preset artifact sizes.
 *
 * Appears as a small pill icon button. On click, pops out a radial
 * list of preset sizes (1×1, 2×2, 3×3, 4×2). Selecting one fires
 * `onChange` with the new span dimensions.
 */
export function Resizer({
  currentColSpan,
  currentRowSpan,
  onChange,
}: ResizerProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);

  const currentLabel = `${currentColSpan}×${currentRowSpan}`;

  return (
    <div ref={wrapperRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className={cn(
          "flex items-center gap-1.5 rounded-[--radius-pill]",
          "bg-foreground px-2.5 py-1 text-xs font-medium text-accent-foreground",
          "transition-all duration-[--duration-fast]",
          "hover:scale-110 hover:bg-foreground/70",
        )}
        aria-label="Resize artifact"
      >
        <Maximize2 size={12} />
        {currentLabel}
      </button>

      {/* Preset picker dropdown */}
      {open && (
        <div
          className={cn(
            "absolute bottom-full right-0 mb-2 flex flex-col gap-1",
            "rounded-[--radius-card] border border-border bg-background p-1.5",
            "shadow-md",
          )}
        >
          {(Object.keys(SPAN_PRESETS) as SpanPreset[]).map((preset) => {
            const { colSpan, rowSpan } = SPAN_PRESETS[preset];
            const isActive =
              colSpan === currentColSpan && rowSpan === currentRowSpan;

            return (
              <button
                key={preset}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(colSpan, rowSpan);
                  setOpen(false);
                }}
                className={cn(
                  "rounded-[--radius-pill] px-3 py-1 text-xs font-medium",
                  "transition-all duration-[--duration-fast]",
                  isActive
                    ? "bg-foreground text-accent-foreground"
                    : "bg-muted text-foreground hover:bg-foreground/10 hover:scale-105",
                )}
              >
                {preset}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
