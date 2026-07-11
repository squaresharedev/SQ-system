import { useState, useEffect, useRef } from "react";
import { X, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { transformImage, buildSrcSet } from "@/lib/image";

interface ArtifactData {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  imgOffsetX: number;
  imgOffsetY: number;
}

interface ArtifactDetailModalProps {
  artifact: ArtifactData;
  isOwner: boolean;
  onClose: () => void;
  onUpdate?: (id: string, title: string, description: string) => void;
}

export function ArtifactDetailModal({ artifact, isOwner, onClose, onUpdate }: ArtifactDetailModalProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(artifact.title);
  const [description, setDescription] = useState(artifact.description);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(artifact.title);
    setDescription(artifact.description);
    setEditing(false);
  }, [artifact.id]);

  useEffect(() => {
    if (editing) titleRef.current?.focus();
  }, [editing]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSave = () => {
    if (!title.trim()) return;
    onUpdate?.(artifact.id, title.trim(), description.trim());
    setEditing(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={cn(
          "relative flex flex-col overflow-hidden bg-background",
          // Desktop: centered popup
          "max-h-[90vh] w-full max-w-2xl rounded-xl border border-border shadow-2xl",
          // Mobile: fullscreen
          "max-md:max-h-full max-md:max-w-full max-md:rounded-none max-md:border-0",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 sm:h-8 sm:w-8"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Image */}
        <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-muted max-md:aspect-square">
          <img
            src={transformImage(artifact.imageUrl, { width: 1280 })}
            srcSet={buildSrcSet(artifact.imageUrl, 1280)}
            alt={artifact.title}
            className="h-full w-full object-cover"
            loading="eager"
            decoding="async"
            style={{
              transformOrigin: `${artifact.imgOffsetX}% ${artifact.imgOffsetY}%`,
              transform: "scale(1.5)",
            }}
          />
        </div>

        {/* Details */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5 sm:p-6">
          {editing ? (
            <>
              <input
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-lg border border-border bg-transparent px-3 py-2 text-lg font-semibold tracking-tight outline-none focus:border-foreground"
                placeholder="Title"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") setEditing(false);
                }}
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-muted-foreground outline-none focus:border-foreground"
                placeholder="Add a description…"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
                >
                  <Check size={14} />
                  Save
                </button>
                <button
                  onClick={() => {
                    setTitle(artifact.title);
                    setDescription(artifact.description);
                    setEditing(false);
                  }}
                  className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight">{artifact.title}</h2>
                {isOwner && (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
              {artifact.description ? (
                <p className="text-sm leading-relaxed text-muted-foreground">{artifact.description}</p>
              ) : (
                <p className="text-sm italic text-muted-foreground/50">No description</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
