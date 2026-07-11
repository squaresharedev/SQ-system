import { useState, useEffect, type ImgHTMLAttributes, type CSSProperties } from "react";
import { transformImage, buildSrcSet } from "@/lib/image";
import { cn } from "@/lib/utils";

interface SmartImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "loading"> {
  /** Original (un-transformed) image URL. */
  src: string;
  alt: string;
  /** CSS width hint for the slot this image fills. Used to pick the
   * right transformed variant. Default: 480. */
  width?: number;
  /** Force eager loading. Default: lazy. */
  eager?: boolean;
  /** className applied to the wrapping element. */
  wrapperClassName?: string;
  /** className applied to the inner <img>. */
  imgClassName?: string;
  /** style applied to the inner <img>. */
  imgStyle?: CSSProperties;
}

/**
 * SmartImage — drop-in <img> replacement that:
 *  - Resolves the Supabase render-image URL at the requested width
 *  - Provides a 2× srcset for high-DPI displays
 *  - Lazy-loads by default + async-decodes
 *  - Renders a pulsing skeleton placeholder until the image is decoded
 *  - Cross-fades the image in when ready
 */
export function SmartImage({
  src,
  alt,
  width = 480,
  eager = false,
  wrapperClassName,
  imgClassName,
  imgStyle,
  ...imgRest
}: SmartImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  // Reset when the underlying source changes
  useEffect(() => {
    setLoaded(false);
    setErrored(false);
  }, [src]);

  const optimized = transformImage(src, { width });
  const srcSet = buildSrcSet(src, width);

  return (
    <span
      className={cn(
        "relative block h-full w-full overflow-hidden",
        wrapperClassName,
      )}
    >
      {!loaded && !errored && (
        <span
          aria-hidden
          className="absolute inset-0 animate-pulse bg-muted"
        />
      )}
      <img
        {...imgRest}
        src={optimized}
        srcSet={srcSet}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        draggable={false}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-200",
          loaded ? "opacity-100" : "opacity-0",
          imgClassName,
        )}
        style={imgStyle}
      />
    </span>
  );
}
