import { useState, useRef, useEffect } from "react";
import { User, LogOut, Plus, Settings, Layers, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { collectionApi } from "@/services/api";
import { useToast } from "@/components/Toast";

interface SidebarProps {
  userEmail: string;
  profilePic?: string | null;
  onLogout: () => void;
  onAddArtifact: (collectionId?: string, collectionName?: string) => void;
  activeCollectionId: string | null;
  onSelectCollection: (id: string | null, name?: string, isPublic?: boolean) => void;
  activePage: "grid" | "settings" | "profile" | "public-profile" | "public-collection";
  onNavigate: (page: "grid" | "settings" | "profile") => void;
  currentUsername?: string | null;
}

interface Collection {
  id: string;
  name: string;
  isPublic: boolean;
}

const COLLAPSED_W = 60;
const EXPANDED_W = 240;

export function Sidebar({ userEmail, profilePic, onLogout, onAddArtifact, activeCollectionId, onSelectCollection, activePage, onNavigate, currentUsername }: SidebarProps) {
  const [expanded, setExpanded] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Load collections from API on mount
  useEffect(() => {
    collectionApi.list().then((data) => {
      setCollections(data.map((c) => ({ id: c.id, name: c.name, isPublic: c.isPublic })));
    }).catch(() => {});
  }, []);

  const initials = userEmail
    .split("@")[0]
    .slice(0, 2)
    .toUpperCase();

  const addCollection = () => {
    // Create a temporary local entry for inline editing
    const tempId = `temp-${Date.now()}`;
    setCollections((prev) => [...prev, { id: tempId, name: "", isPublic: false }]);
    setEditingId(tempId);
    if (!expanded) setExpanded(true);
  };

  const renameCollection = (id: string, name: string) => {
    setCollections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name } : c)),
    );
  };

  const commitEdit = async (id: string) => {
    setEditingId(null);
    const col = collections.find((c) => c.id === id);
    if (!col || col.name.trim() === "") {
      // Remove blank collections
      setCollections((prev) => prev.filter((c) => c.id !== id));
      if (id.startsWith("temp-")) return;
      // If it was a real collection that was blanked, delete it
      try { await collectionApi.remove(id); } catch {}
      return;
    }

    if (id.startsWith("temp-")) {
      // Persist new collection to API
      try {
        const created = await collectionApi.create(col.name.trim());
        setCollections((prev) =>
          prev.map((c) => (c.id === id ? { id: created.id, name: created.name, isPublic: created.isPublic } : c)),
        );
      } catch {
        setCollections((prev) => prev.filter((c) => c.id !== id));
      }
    } else {
      // Update existing collection
      try {
        await collectionApi.update(id, { name: col.name.trim() });
      } catch {}
    }
  };

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      style={{ width: expanded ? EXPANDED_W : COLLAPSED_W }}
      className={cn(
        "fixed left-0 top-0 z-40 flex h-dvh flex-col",
        "border-r border-border bg-background py-4",
        "transition-[width] duration-300 ease-in-out",
        "hidden md:flex",
      )}
    >
      {/* Brand */}
      <div className="mb-6 flex h-8 items-center overflow-hidden">
        <div className="flex w-[60px] shrink-0 items-center justify-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-[--radius-card] bg-foreground text-[10px] font-bold tracking-tighter text-accent-foreground">
            SS
          </div>
        </div>
        {expanded && (
          <span className="whitespace-nowrap text-sm font-semibold tracking-tight">
            SquareShare
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1">
        <button
          onClick={() => onNavigate("profile")}
          className={cn(
            "flex h-9 items-center overflow-hidden",
            "transition-colors duration-[--duration-fast]",
            activePage === "profile"
              ? "text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
          aria-label="Profile"
        >
          <span className={cn(
            "flex w-[60px] shrink-0 items-center justify-center",
          )}>
            <span className={cn(
              "flex h-9 w-9 items-center justify-center rounded-[--radius-card]",
              activePage === "profile" ? "bg-muted" : "hover:bg-muted",
            )}>
              <User size={18} />
            </span>
          </span>
          {expanded && <span className="whitespace-nowrap text-sm">Profile</span>}
        </button>
        <button
          onClick={() => onNavigate("settings")}
          className={cn(
            "flex h-9 items-center overflow-hidden",
            "transition-colors duration-[--duration-fast]",
            activePage === "settings"
              ? "text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
          aria-label="Settings"
        >
          <span className={cn(
            "flex w-[60px] shrink-0 items-center justify-center",
          )}>
            <span className={cn(
              "flex h-9 w-9 items-center justify-center rounded-[--radius-card]",
              activePage === "settings" ? "bg-muted" : "hover:bg-muted",
            )}>
              <Settings size={18} />
            </span>
          </span>
          {expanded && <span className="whitespace-nowrap text-sm">Settings</span>}
        </button>
      </nav>

      {/* Collections */}
      <div className="mt-6 flex flex-col gap-2">
        {/* Header row — icon always in 60px zone */}
        <div className="flex h-9 items-center overflow-hidden">
          <div className="flex w-[60px] shrink-0 items-center justify-center">
            <button
              onClick={addCollection}
              className="relative flex h-9 w-9 items-center justify-center rounded-[--radius-card] text-muted-foreground transition-colors duration-[--duration-fast] hover:bg-muted hover:text-foreground"
              aria-label="Collections"
              title="Collections"
            >
              <Layers size={18} />
            </button>
          </div>
          {expanded && (
            <div className="mr-3 flex flex-1 items-center gap-2 overflow-hidden">
              <span className="flex-1 text-xs font-medium text-muted-foreground">Collections</span>
              <button
                onClick={addCollection}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-foreground/15 text-foreground transition-all duration-[--duration-fast] hover:bg-foreground/25 active:scale-90"
                aria-label="Add collection"
              >
                <Plus size={12} strokeWidth={2.5} />
              </button>
            </div>
          )}
        </div>

        {/* Collection pills — only when expanded */}
        {expanded && (
          <div className="flex flex-col gap-2 px-3">
            {collections.map((col) => (
              <CollectionPill
                key={col.id}
                collection={col}
                active={activeCollectionId === col.id}
                editing={editingId === col.id}
                onRename={(name) => renameCollection(col.id, name)}
                onCommit={() => commitEdit(col.id)}
                onSelect={() => onSelectCollection(col.id, col.name, col.isPublic)}
                onStartEdit={() => setEditingId(col.id)}
                onAddArtifact={() => onAddArtifact(col.id, col.name)}
                currentUsername={currentUsername}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* User info */}
      <div className="flex flex-col gap-2">
        <div className="flex h-9 items-center overflow-hidden" title={userEmail}>
          <div className="flex w-[60px] shrink-0 items-center justify-center">
            {profilePic ? (
              <img src={profilePic} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground/10 text-[10px] font-medium text-muted-foreground">
                {initials}
              </div>
            )}
          </div>
          {expanded && (
            <span className="min-w-0 truncate text-xs text-muted-foreground">
              {userEmail}
            </span>
          )}
        </div>
        <button
          onClick={onLogout}
          className="group flex h-9 items-center overflow-hidden text-muted-foreground transition-colors duration-[--duration-fast] hover:text-red-500"
          aria-label="Log out"
        >
          <span className="flex w-[60px] shrink-0 items-center justify-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-[--radius-card] group-hover:bg-red-500/10">
              <LogOut size={16} />
            </span>
          </span>
          {expanded && <span className="whitespace-nowrap text-xs">Log out</span>}
        </button>
      </div>
    </aside>
  );
}

// ─── Collection pill ───────────────────────────────────────────────

function CollectionPill({
  collection,
  active,
  editing,
  onRename,
  onCommit,
  onSelect,
  onStartEdit,
  onAddArtifact,
  currentUsername,
}: {
  collection: Collection;
  active: boolean;
  editing: boolean;
  onRename: (name: string) => void;
  onCommit: () => void;
  onSelect: () => void;
  onStartEdit: () => void;
  onAddArtifact: () => void;
  currentUsername?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleShare = async () => {
    setMenuOpen(false);
    if (!currentUsername || !collection.name) {
      toast("Set a username in Settings before sharing.", "error");
      return;
    }
    if (!collection.isPublic) {
      toast("Make this collection public to share it.", "error");
      return;
    }
    const url = `${window.location.origin}/${currentUsername}/${encodeURIComponent(collection.name)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied to clipboard", "success");
    } catch {
      toast("Couldn't copy link", "error");
    }
  };

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={collection.name}
        onChange={(e) => onRename(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommit();
          if (e.key === "Escape") onCommit();
        }}
        placeholder="Collection name here..."
        className="h-10 w-full rounded-lg border border-border bg-muted px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none"
      />
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={onSelect}
        onDoubleClick={onStartEdit}
        className={cn(
          "group relative flex h-10 w-full items-center rounded-none border px-4 text-left text-sm",
          "transition-all duration-200 ease-in-out",
          active
            ? "border-foreground/30 bg-foreground/10 text-foreground font-medium"
            : "border-border bg-muted text-foreground hover:rounded-lg hover:border-foreground/20 hover:bg-foreground/10",
        )}
      >
        {/* Active accent bar */}
        {active && (
          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-foreground" />
        )}
        <span className="truncate pr-6">
          {collection.name || <span className="text-muted-foreground">Collection name here...</span>}
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setMenuOpen((v) => !v); } }}
          className="absolute right-2 flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity duration-[--duration-fast] hover:text-foreground group-hover:opacity-100"
          aria-label="Collection options"
        >
          <MoreVertical size={14} />
        </span>
      </button>

      {/* Dropdown menu */}
      {menuOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-border bg-background py-1 shadow-md">
          <button
            onClick={() => { setMenuOpen(false); onAddArtifact(); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
          >
            <Plus size={14} /> Add artifact
          </button>
          <button
            onClick={() => { setMenuOpen(false); onStartEdit(); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
          >
            Rename
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
            onClick={() => setMenuOpen(false)}
          >
            Duplicate
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
            onClick={handleShare}
          >
            Share
          </button>
          <div className="my-1 border-t border-border" />
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-muted"
            onClick={() => setMenuOpen(false)}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
