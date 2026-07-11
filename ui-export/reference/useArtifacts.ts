import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  artifactApi,
  type ArtifactDTO,
  type CreateArtifactPayload,
  type UpdateArtifactPayload,
  type BatchUpdateItem,
} from "../services/api";
import type { GridItem } from "../types";

// ─── Query Keys ────────────────────────────────────────────────────

export const artifactKeys = {
  all: ["artifacts"] as const,
  list: (collectionId?: string | null) => [...artifactKeys.all, "list", collectionId ?? "all"] as const,
};

// ─── DTO ↔ View-State Mapping ──────────────────────────────────────

function dtoToGridItem(dto: ArtifactDTO): GridItem {
  return {
    id: dto.id,
    artifact: {
      id: dto.id,
      title: dto.title,
      description: dto.description,
      imageUrl: dto.imageUrl,
      imgOffsetX: dto.imgOffsetX ?? 50,
      imgOffsetY: dto.imgOffsetY ?? 50,
      dateAdded: dto.createdAt,
    },
    position: {
      col: dto.gridX,
      row: dto.gridY,
      colSpan: dto.spanW,
      rowSpan: dto.spanH,
    },
  };
}

function gridItemsToBatch(items: GridItem[]): BatchUpdateItem[] {
  return items.map((item, index) => ({
    id: item.id,
    gridX: item.position.col,
    gridY: item.position.row,
    spanW: item.position.colSpan,
    spanH: item.position.rowSpan,
    sortOrder: index,
  }));
}

// ─── Hooks ─────────────────────────────────────────────────────────

/** Fetch artifacts for the current user, optionally filtered by collection */
export function useArtifacts(collectionId?: string | null) {
  return useQuery({
    queryKey: artifactKeys.list(collectionId),
    queryFn: async () => {
      const dtos = await artifactApi.list(collectionId);
      const sorted = [...dtos].sort((a, b) => a.sortOrder - b.sortOrder);
      return sorted.map(dtoToGridItem);
    },
    staleTime: 30_000,
  });
}

/** Create a new artifact */
export function useCreateArtifact() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateArtifactPayload) =>
      artifactApi.create(payload),
    onSuccess: () => {
      // Invalidate all artifact lists (any collection filter)
      void qc.invalidateQueries({ queryKey: artifactKeys.all });
    },
  });
}

/** Update a single artifact's metadata or position */
export function useUpdateArtifact() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: UpdateArtifactPayload & { id: string }) =>
      artifactApi.update(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: artifactKeys.all });
    },
  });
}

/** Batch update all artifact positions after drag-end / reflow.
 *  Uses optimistic updates for snappy UX. */
export function useBatchUpdatePositions() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (items: GridItem[]) =>
      artifactApi.batchUpdate(gridItemsToBatch(items)),

    // Always refetch to ensure consistency
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: artifactKeys.all });
    },
  });
}

/** Delete an artifact */
export function useDeleteArtifact() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => artifactApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: artifactKeys.all });
    },
  });
}
