// ─── Allgrid MVP: Frontend View-State Interfaces ───────────────────
//
// These types model the CLIENT-SIDE state only.
// They are decoupled from the backend API shape — mapping happens in
// the service layer (api.ts) so components stay pure.

/** Preset span sizes available in the Resizer UI */
export type SpanPreset = "1x1" | "2x2" | "3x3" | "4x2" | "2x1" | "1x2";

/** Column/row span dimensions parsed from a SpanPreset */
export interface SpanSize {
  colSpan: number; // 1–12
  rowSpan: number; // 1–N
}

/** Map of human-readable preset labels to their grid dimensions */
export const SPAN_PRESETS: Record<SpanPreset, SpanSize> = {
  "1x1": { colSpan: 1, rowSpan: 1 },
  "2x1": { colSpan: 2, rowSpan: 1 },
  "1x2": { colSpan: 1, rowSpan: 2 },
  "2x2": { colSpan: 2, rowSpan: 2 },
  "4x2": { colSpan: 4, rowSpan: 2 },
  "3x3": { colSpan: 3, rowSpan: 3 },
};

/** Position of an artifact within the 12-column grid */
export interface GridPosition {
  /** Column start (1-based, 1–12) */
  col: number;
  /** Row start (1-based, 1–N) */
  row: number;
  /** Number of columns this item spans */
  colSpan: number;
  /** Number of rows this item spans */
  rowSpan: number;
}

/** Core artifact data (matches DB shape minus server-only fields) */
export interface Artifact {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  imgOffsetX: number;
  imgOffsetY: number;
  dateAdded: string; // ISO 8601
}

/** A single item placed on the grid canvas */
export interface GridItem {
  id: string;
  artifact: Artifact;
  position: GridPosition;
}

/** Complete client-side grid state */
export interface GridState {
  items: GridItem[];
}

/** Auth form state (shared between Login & Signup) */
export interface AuthFormState {
  email: string;
  password: string;
}

/** The currently authenticated user (minimal frontend shape) */
export interface AuthUser {
  id: string;
  email: string;
}

/** Top-level app view state */
export interface AppState {
  user: AuthUser | null;
  grid: GridState;
  isLoading: boolean;
}

/** Drag event payload passed between dnd-kit and GridCanvas */
export interface DragPayload {
  itemId: string;
  originCol: number;
  originRow: number;
}
