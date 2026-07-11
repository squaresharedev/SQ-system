import { cn } from "@/lib/utils";

interface GridLoaderProps {
  className?: string;
}

/**
 * Minimal loading indicator — a small circular spinner.
 * Kept under the GridLoader name to avoid churning all callsites.
 */
export function GridLoader({ className }: GridLoaderProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "spinner h-4 w-4 rounded-full border-2 border-muted-foreground/25 border-t-foreground",
        className,
      )}
    />
  );
}
