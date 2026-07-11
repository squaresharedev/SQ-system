import { useState, useEffect } from "react";
import { Globe, Lock, Plus, X, Check } from "lucide-react";
import { collectionApi, type CollectionDTO } from "@/services/api";
import { cn } from "@/lib/utils";

interface MobileCollectionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeCollectionId: string | null;
  onSelectCollection: (id: string, name: string, isPublic: boolean) => void;
  currentUsername: string | null;
}

export function MobileCollectionSheet({
  isOpen,
  onClose,
  activeCollectionId,
  onSelectCollection,
}: MobileCollectionSheetProps) {
  const [collections, setCollections] = useState<CollectionDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    collectionApi
      .list()
      .then((cols) => setCollections(cols))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const created = await collectionApi.create(trimmed);
      const updated = await collectionApi.list();
      setCollections(updated);
      setCreatingNew(false);
      setNewName("");
      onSelectCollection(created.id, created.name, created.isPublic);
      onClose();
    } catch {
      // silently fail; user can retry
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 max-h-[70dvh] overflow-y-auto rounded-t-2xl border-t border-border bg-background translate-y-0 transition-transform duration-300"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="mx-auto mt-3 mb-4 h-1 w-10 rounded-full bg-border" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3">
          <h2 className="text-base font-medium">Collections</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-muted active:opacity-70"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Collection list */}
        {loading ? (
          <>
            <div className="mx-4 mb-2 h-12 animate-pulse rounded bg-muted" />
            <div className="mx-4 mb-2 h-12 animate-pulse rounded bg-muted" />
            <div className="mx-4 mb-2 h-12 animate-pulse rounded bg-muted" />
          </>
        ) : (
          collections.map((col) => (
            <button
              key={col.id}
              onClick={() => {
                onSelectCollection(col.id, col.name, col.isPublic);
                onClose();
              }}
              className={cn(
                "flex h-12 w-full items-center gap-3 px-4 text-sm active:bg-muted",
                col.id === activeCollectionId
                  ? "bg-muted font-medium"
                  : "hover:bg-muted",
              )}
            >
              <span className="flex-1 truncate text-left">{col.name}</span>
              {col.isPublic ? (
                <Globe size={14} className="text-muted-foreground" />
              ) : (
                <Lock size={14} className="text-muted-foreground" />
              )}
            </button>
          ))
        )}

        {/* Divider */}
        <div className="my-1 border-t border-border" />

        {/* New collection */}
        {creatingNew ? (
          <div className="flex h-12 items-center gap-2 px-4">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") {
                  setCreatingNew(false);
                  setNewName("");
                }
              }}
              placeholder="Collection name"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              onClick={handleCreate}
              disabled={saving || !newName.trim()}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-muted active:opacity-70 disabled:opacity-40"
              aria-label="Create collection"
            >
              <Check size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCreatingNew(true)}
            className="flex h-12 w-full items-center gap-2 px-4 text-sm text-muted-foreground hover:bg-muted active:bg-muted"
          >
            <Plus size={16} />
            New collection
          </button>
        )}
      </div>
    </>
  );
}
