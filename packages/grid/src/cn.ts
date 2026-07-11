import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes without conflicts. Identical to the `cn()` in both
 *  apps' lib/utils.ts — vendored so the grid has no app-relative imports. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
