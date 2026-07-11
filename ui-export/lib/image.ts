/**
 * Image optimization helpers.
 *
 * Rewrites Supabase Storage public URLs to go through the image
 * transformation endpoint, which returns resized / quality-optimized
 * (and WebP when the browser supports it via Accept negotiation)
 * variants of the original asset.
 *
 * Set `VITE_ENABLE_IMAGE_TRANSFORMS=true` once you've enabled the
 * Image Transformations feature in your Supabase project. Until then
 * the helper is a no-op pass-through, so the app keeps working on
 * free / un-flagged Supabase projects.
 */

const TRANSFORMS_ENABLED =
  import.meta.env.VITE_ENABLE_IMAGE_TRANSFORMS === "true";

const PUBLIC_MARKER = "/storage/v1/object/public/";

export interface TransformOpts {
  width?: number;
  height?: number;
  quality?: number; // 1–100
  resize?: "cover" | "contain" | "fill";
}

/** Round a target dimension up to a small set of canonical widths so we
 * benefit from CDN caching instead of generating a unique URL per pixel. */
function snapWidth(w: number): number {
  // 2x DPR aware ladder. Cells are small, so the ladder is dense at the low end.
  const ladder = [120, 240, 360, 480, 640, 800, 1024, 1280, 1600, 1920];
  for (const step of ladder) if (w <= step) return step;
  return ladder[ladder.length - 1];
}

export function transformImage(url: string, opts: TransformOpts = {}): string {
  if (!url || !TRANSFORMS_ENABLED) return url;
  const idx = url.indexOf(PUBLIC_MARKER);
  if (idx === -1) return url; // not a Supabase storage URL — leave alone
  const base = url.slice(0, idx);
  const path = url.slice(idx + PUBLIC_MARKER.length);

  const params = new URLSearchParams();
  if (opts.width) params.set("width", String(snapWidth(opts.width)));
  if (opts.height) params.set("height", String(opts.height));
  params.set("quality", String(opts.quality ?? 75));
  params.set("resize", opts.resize ?? "cover");

  return `${base}/storage/v1/render/image/public/${path}?${params.toString()}`;
}

/**
 * Build a srcset string at 1x and 2x the target CSS width, so high-DPI
 * displays get a sharper variant without forcing low-DPI displays to
 * pay for it.
 */
export function buildSrcSet(url: string, cssWidth: number, opts: Omit<TransformOpts, "width"> = {}): string | undefined {
  if (!TRANSFORMS_ENABLED) return undefined;
  if (!url || url.indexOf(PUBLIC_MARKER) === -1) return undefined;
  const at1x = transformImage(url, { ...opts, width: cssWidth });
  const at2x = transformImage(url, { ...opts, width: cssWidth * 2 });
  return `${at1x} 1x, ${at2x} 2x`;
}
