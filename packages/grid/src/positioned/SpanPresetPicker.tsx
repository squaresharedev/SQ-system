"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2 } from "lucide-react";
import { cn } from "../cn.js";
import { SPAN_PRESETS, type SpanPreset } from "./types.js";

// The resize control consumer cards plug into their corner — the replacement
// for the old app's Resizer (ui-export/reference/Resizer.tsx), replicated:
// a small pill trigger showing the current span; clicking pops a vertical
// list of SPAN_PRESETS; outside pointerdown closes; the active preset is
// highlighted; selecting fires onChange(colSpan, rowSpan) and closes.
// Styling lives in styles.css (.ss-resizer*) on themeable CSS vars.
//
// Wire it to the positioned grid via renderBlock's state:
//   <SpanPresetPicker spanW={block.spanW} spanH={block.spanH}
//                     onChange={state.resize} />

export interface SpanPresetPickerProps {
  /** The block's current spans (drive the pill label + active highlight). */
  spanW: number;
  spanH: number;
  /** Fired with the chosen preset's dimensions. */
  onChange: (spanW: number, spanH: number) => void;
  /** Subset/reorder of offered presets (default: all, in SPAN_PRESETS order). */
  presets?: readonly SpanPreset[];
  className?: string;
  ariaLabel?: string;
}

export function SpanPresetPicker({
  spanW,
  spanH,
  onChange,
  presets,
  className,
  ariaLabel = "Resize artifact",
}: SpanPresetPickerProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click.
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

  const offered = presets ?? (Object.keys(SPAN_PRESETS) as SpanPreset[]);
  const currentLabel = `${spanW}×${spanH}`;

  return (
    <div ref={wrapperRef} className={cn("ss-resizer", className)}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="ss-resizer-trigger"
        aria-label={ariaLabel}
        aria-expanded={open}
      >
        <Maximize2 size={12} aria-hidden="true" />
        {currentLabel}
      </button>

      {/* Preset picker dropdown */}
      {open && (
        <div className="ss-resizer-menu">
          {offered.map((preset) => {
            const { colSpan, rowSpan } = SPAN_PRESETS[preset];
            const isActive = colSpan === spanW && rowSpan === spanH;

            return (
              <button
                type="button"
                key={preset}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(colSpan, rowSpan);
                  setOpen(false);
                }}
                className="ss-resizer-option"
                data-active={isActive || undefined}
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
