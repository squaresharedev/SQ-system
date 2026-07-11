import { useState, useRef, type FormEvent } from "react";
import { X, Upload, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ImageCropper } from "./ImageCropper";

interface ArtifactModalProps {
  onSubmit: (title: string, description: string, imageUrl: string, colSpan: number, rowSpan: number) => void;
  onClose: () => void;
  gridCols?: number;
  uploading?: boolean;
  /** Error message from a failed upload (e.g. moderation rejection) */
  uploadError?: string | null;
}

/**
 * ArtifactModal — Form for adding a new artifact with grid-based image cropping.
 *
 * After uploading an image, users can crop it along a grid overlay
 * that matches the real artifact grid. The crop selection determines
 * both the visible image area and the artifact's grid span size.
 */
export function ArtifactModal({ onSubmit, onClose, gridCols = 12, uploading = false, uploadError }: ArtifactModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // Raw uploaded image (before crop)
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
  // Cropped result
  const [croppedUrl, setCroppedUrl] = useState<string | null>(null);
  const [spanW, setSpanW] = useState(2);
  const [spanH, setSpanH] = useState(2);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const original = reader.result as string;
      // Resize + compress via canvas so the payload stays well under the 5MB server limit.
      // Max dimension: 2000px. Quality: 85% JPEG.
      const img = new Image();
      img.onload = () => {
        const MAX = 2000;
        let { naturalWidth: w, naturalHeight: h } = img;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round((h / w) * MAX); w = MAX; }
          else        { w = Math.round((w / h) * MAX); h = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL("image/jpeg", 0.85);
        setRawImageUrl(compressed);
        setCroppedUrl(null);
      };
      img.src = original;
    };
    reader.readAsDataURL(file);
  };

  const handleCrop = (dataUrl: string, colSpan: number, rowSpan: number) => {
    setCroppedUrl(dataUrl);
    setSpanW(colSpan);
    setSpanH(rowSpan);
  };

  const handleResetImage = () => {
    setRawImageUrl(null);
    setCroppedUrl(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const imageUrl =
      croppedUrl ?? rawImageUrl ?? `https://placehold.co/480x480/000/fff?text=${encodeURIComponent(title)}`;
    onSubmit(title.trim(), description.trim(), imageUrl, spanW, spanH);
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-foreground/40"
      onClick={onClose}
    >
      <div
        className="flex min-h-full items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
      {/* Modal */}
      <div
        className={cn(
          "relative w-full rounded-[--radius-card] border border-border bg-background p-5 shadow-lg sm:p-6",
          rawImageUrl && !croppedUrl ? "max-w-2xl" : "max-w-md",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-[--radius-pill] transition-colors hover:bg-muted active:scale-95"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <h2 className="mb-6 text-lg font-medium tracking-tight">
          Add Artifact
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Image upload / crop */}
          {rawImageUrl && !croppedUrl ? (
            /* Cropper mode — image uploaded, awaiting crop selection */
            <ImageCropper
              imageUrl={rawImageUrl}
              gridCols={gridCols}
              onCrop={handleCrop}
              onReset={handleResetImage}
            />
          ) : croppedUrl ? (
            /* Crop confirmed — show preview with option to re-crop */
            <div className="relative">
              <button
                type="button"
                onClick={() => setCroppedUrl(null)}
                className={cn(
                  "flex w-full items-center justify-center overflow-hidden",
                  "rounded-[--radius-card] border-2 border-dashed border-border",
                  "transition-colors duration-[--duration-fast] hover:border-foreground/30",
                )}
                style={{ aspectRatio: `${spanW} / ${spanH}`, maxHeight: "240px" }}
              >
                <img
                  src={croppedUrl}
                  alt="Cropped preview"
                  className="h-full w-full object-cover"
                />
              </button>
              <span className="mt-1 block text-center text-xs text-muted-foreground">
                {spanW}×{spanH} — click to re-crop
              </span>
            </div>
          ) : (
            /* No image yet — upload prompt */
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={cn(
                "flex h-32 w-full items-center justify-center overflow-hidden sm:h-40",
                "rounded-[--radius-card] border-2 border-dashed border-border",
                "transition-colors duration-[--duration-fast] hover:border-foreground/30",
                "p-4",
              )}
            >
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload size={24} />
                <span className="text-sm">Click to upload image</span>
              </div>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Title */}
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={cn(
              "h-11 w-full rounded-[--radius-card] border border-border bg-background",
              "px-3 text-base placeholder:text-muted-foreground sm:text-sm",
              "outline-none transition-colors focus:border-foreground",
            )}
            autoFocus
          />

          {/* Description */}
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={cn(
              "w-full resize-none rounded-[--radius-card] border border-border bg-background",
              "px-3 py-2.5 text-base placeholder:text-muted-foreground sm:text-sm",
              "outline-none transition-colors focus:border-foreground",
            )}
          />

          {/* Moderation rejection feedback */}
          {uploadError && (
            <div className="flex items-start gap-2 rounded-[--radius-card] border border-destructive/30 bg-destructive/5 px-3 py-2.5">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{uploadError}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!title.trim() || uploading}
            className={cn(
              "relative flex h-11 w-full items-center justify-center gap-2 rounded-[--radius-pill] bg-foreground px-5",
              "text-sm font-medium text-accent-foreground",
              "transition-opacity hover:opacity-80",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            {uploading ? (
              <>
                <span>Uploading</span>
                <span className="btn-upload-loader" />
              </>
            ) : (
              "Add to Grid"
            )}
          </button>
        </form>
      </div>
      </div>
    </div>
  );
}
