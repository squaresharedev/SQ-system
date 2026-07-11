import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Pin, PinOff, Layers, Image as ImageIcon, X, ZoomIn, ZoomOut, Upload, Search, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { collectionApi, artifactApi, userApi, searchApi, type CollectionDTO, type ArtifactDTO, type SearchResult } from "@/services/api";
import { useToast } from "@/components/Toast";
import { CollectionGridPreview } from "@/components/CollectionGridPreview";
import { GridLoader } from "@/components/GridLoader";

const PIN_STORAGE_KEY = "ss-pinned-collections";

function loadPinnedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(PIN_STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {}
  return new Set();
}

function savePinnedIds(ids: Set<string>) {
  localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify([...ids]));
}

interface ProfilePageProps {
  userEmail: string;
  onSelectCollection: (id: string, name: string) => void;
  isOwner?: boolean;
  isActive?: boolean;
  cachedUsername?: string | null;
}

export function ProfilePage({ userEmail, onSelectCollection, isOwner = true, isActive = false, cachedUsername }: ProfilePageProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [rawPicForCrop, setRawPicForCrop] = useState<string | null>(null);
  const [username, setUsername] = useState(() => cachedUsername || userEmail.split("@")[0]);
  const [editingName, setEditingName] = useState(false);
  const [collections, setCollections] = useState<CollectionDTO[]>([]);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(loadPinnedIds);
  // Full artifact data per collection for grid preview
  const [collectionArtifacts, setCollectionArtifacts] = useState<Record<string, ArtifactDTO[]>>({});
  const [loaded, setLoaded] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const loaderTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wasActive = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Sync username from parent when cachedUsername arrives (e.g. after API resolves)
  useEffect(() => {
    if (cachedUsername) setUsername(cachedUsername);
  }, [cachedUsername]);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close search dropdown on outside click
  useEffect(() => {
    if (!showSearchResults) return;
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSearchResults]);

  // Debounced search — supports @username syntax
  useEffect(() => {
    const raw = searchQuery.trim();
    if (!raw || raw.length < 2) {
      setSearchResults(null);
      setShowSearchResults(false);
      return;
    }

    const timer = setTimeout(() => {
      const q = raw.startsWith("@") ? raw.slice(1) : raw;
      if (!q) return;
      searchApi.query(q).then(results => {
        setSearchResults(results);
        setShowSearchResults(true);
      }).catch(() => {
        setSearchResults(null);
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      userApi.me(),
      collectionApi.list(),
    ]).then(async ([u, cols]) => {
      if (cancelled) return;
      setUsername(u.username);
      if (u.profilePicUrl) setProfilePic(u.profilePicUrl);
      setCollections(cols);
      const results = await Promise.all(
        cols.map(col =>
          artifactApi.list(col.id)
            .then((arts: ArtifactDTO[]) => ({ id: col.id, arts }))
            .catch(() => ({ id: col.id, arts: [] as ArtifactDTO[] }))
        ),
      );
      if (cancelled) return;
      const artifacts: Record<string, ArtifactDTO[]> = {};
      for (const { id, arts } of results) artifacts[id] = arts;
      setCollectionArtifacts(artifacts);
      setLoaded(true);
    }).catch(() => {
      if (!cancelled) setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (editingName) nameRef.current?.focus();
  }, [editingName]);

  const handlePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast("Profile picture must be under 2 MB.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const raw = reader.result as string;
      setProfilePic(raw);
      setRawPicForCrop(raw);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCropSave = async (croppedDataUrl: string) => {
    setCropModalOpen(false);
    setProfilePic(croppedDataUrl);
    try {
      await userApi.updateProfilePic(croppedDataUrl);
    } catch {
      // Silent fail — local state already updated
    }
  };

  const togglePin = (id: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      savePinnedIds(next);
      return next;
    });
  };

  const sorted = [...collections].sort((a, b) => {
    const ap = pinnedIds.has(a.id) ? 0 : 1;
    const bp = pinnedIds.has(b.id) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return a.sortOrder - b.sortOrder;
  });

  const initials = username.slice(0, 2).toUpperCase();

  // Show loader only on first activation; silent background refresh on subsequent visits
  useEffect(() => {
    const becameActive = isActive && !wasActive.current;
    wasActive.current = isActive;

    clearTimeout(loaderTimer.current);
    setShowLoader(false);

    if (becameActive && !loaded) {
      loaderTimer.current = setTimeout(() => setShowLoader(true), 1000);
    }

    // Silent background refresh when returning with data already loaded
    let cancelled = false;
    if (becameActive && loaded) {
      Promise.all([userApi.me(), collectionApi.list()])
        .then(async ([u, cols]) => {
          if (cancelled) return;
          setUsername(u.username);
          if (u.profilePicUrl) setProfilePic(u.profilePicUrl);
          setCollections(cols);
          const results = await Promise.all(
            cols.map(col =>
              artifactApi.list(col.id)
                .then((arts: ArtifactDTO[]) => ({ id: col.id, arts }))
                .catch(() => ({ id: col.id, arts: [] as ArtifactDTO[] }))
            ),
          );
          if (cancelled) return;
          const artifacts: Record<string, ArtifactDTO[]> = {};
          for (const { id, arts } of results) artifacts[id] = arts;
          setCollectionArtifacts(artifacts);
        })
        .catch(() => {});
    }

    return () => { cancelled = true; clearTimeout(loaderTimer.current); };
  }, [isActive, loaded]);

  if (!loaded) {
    return (
      <div className="flex h-full min-h-[60dvh] items-center justify-center">
        {showLoader && (
          <GridLoader className="h-5 w-5" />
        )}
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-4 sm:px-8 sm:py-6">
      {/* ── Search bar ──────────────────────────── */}
      <div className="mx-auto mb-6 max-w-xl" ref={searchRef}>
        <div className="relative">
          <div className="flex items-center gap-3 rounded-full border border-border bg-background px-4 py-2.5 transition-colors focus-within:border-foreground/30">
            <Search size={16} className="shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if (searchResults) setShowSearchResults(true); }}
              placeholder="Search for creators or collections"
              className="w-full bg-transparent text-base text-foreground placeholder:text-muted-foreground outline-none sm:text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(""); setSearchResults(null); setShowSearchResults(false); }}
              >
                <X size={14} className="text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          {/* Search results dropdown */}
          {showSearchResults && searchResults && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border border-border bg-background shadow-lg">
              {searchResults.users.length === 0 && searchResults.collections.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  No results found
                </div>
              ) : (
                <>
                  {searchResults.users.length > 0 && (
                    <div>
                      <div className="px-4 py-2 text-xs font-medium text-muted-foreground">Creators</div>
                      {searchResults.users.map(u => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            if (!u.isPublic) {
                              toast("This account is private", "default");
                              return;
                            }
                            navigate(`/${u.username}`);
                            setShowSearchResults(false);
                            setSearchQuery("");
                          }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted"
                        >
                          {u.profilePicUrl ? (
                            <img src={u.profilePicUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground/10 text-xs font-medium text-muted-foreground">
                              {u.username.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">@{u.username}</span>
                            {!u.isPublic && <Lock size={12} className="text-muted-foreground" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.collections.length > 0 && (
                    <div>
                      <div className="px-4 py-2 text-xs font-medium text-muted-foreground">Collections</div>
                      {searchResults.collections.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            navigate(`/${c.ownerUsername}/${encodeURIComponent(c.name)}`);
                            setShowSearchResults(false);
                            setSearchQuery("");
                          }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-[--radius-card] bg-foreground/5">
                            <Layers size={14} className="text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <span className="block truncate text-sm font-medium">{c.name}</span>
                            <span className="text-xs text-muted-foreground">@{c.ownerUsername}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Top: Profile header ─────────────────── */}
      <div className="mb-10 flex items-center gap-5">
        {/* Profile picture */}
        <button
          type="button"
          onClick={() => {
            if (!isOwner) return;
            if (rawPicForCrop || profilePic) {
              setCropModalOpen(true);
            } else {
              fileRef.current?.click();
            }
          }}
          className={cn(
            "group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted ring-2 ring-border transition-all",
            isOwner && "cursor-pointer hover:ring-foreground/30",
          )}
        >
          {profilePic ? (
            <img src={profilePic} alt="Profile" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xl font-semibold text-muted-foreground">
              {initials}
            </span>
          )}
          {isOwner && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <Pencil size={18} className="text-white" />
            </div>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePicChange}
        />

        {/* Profile pic crop modal */}
        {cropModalOpen && (rawPicForCrop || profilePic) && (
          <ProfilePicCropModal
            src={(rawPicForCrop || profilePic)!}
            onSave={handleCropSave}
            onClose={() => setCropModalOpen(false)}
            onUploadNew={() => {
              setCropModalOpen(false);
              fileRef.current?.click();
            }}
          />
        )}

        {/* Username + email */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {editingName ? (
            <input
              ref={nameRef}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") setEditingName(false);
              }}
              className={cn(
                "w-fit rounded-[--radius-card] border border-border bg-background px-2 py-1",
                "text-lg font-semibold tracking-tight outline-none focus:border-foreground",
              )}
            />
          ) : (
            <h1
              className="cursor-pointer text-lg font-semibold tracking-tight"
              onClick={() => setEditingName(true)}
              title="Click to edit"
            >
              {username || "Your Name"}
            </h1>
          )}
          <span className="text-xs text-muted-foreground">{userEmail}</span>
        </div>

      </div>

      {/* ── Bottom: Collections ─────────────────── */}
      <div>
        <h2 className="mb-4 text-lg font-medium tracking-tight">Collections</h2>

        {collections.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Layers size={24} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">No collections yet</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                On desktop, use the sidebar to create your first collection. On mobile, tap the Collections tab in the bottom navigation.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((col) => {
              const pinned = pinnedIds.has(col.id);
              const arts = collectionArtifacts[col.id] ?? [];
              return (
                <div
                  key={col.id}
                  className={cn(
                    "group relative flex cursor-pointer flex-col overflow-hidden rounded-[--radius-card] border",
                    "transition-colors duration-[--duration-fast]",
                    pinned
                      ? "border-foreground/20"
                      : "border-border hover:border-foreground/15",
                  )}
                  onClick={() => onSelectCollection(col.id, col.name)}
                >
                  {/* 16:9 mini grid viewport */}
                  <CollectionGridPreview artifacts={arts} />

                  {/* Pin button overlay */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); togglePin(col.id); }}
                    className={cn(
                      "absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md bg-black/50 transition-opacity",
                      pinned
                        ? "text-white opacity-100"
                        : "text-white/80 opacity-0 group-hover:opacity-100",
                    )}
                    title={pinned ? "Unpin" : "Pin to top"}
                  >
                    {pinned ? <PinOff size={12} /> : <Pin size={12} />}
                  </button>

                  {/* Collection info */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{col.name}</span>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <ImageIcon size={10} />
                          {arts.length} artifact{arts.length !== 1 ? "s" : ""}
                        </span>
                        <span>·</span>
                        <span>{new Date(col.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Profile picture crop modal ────────────────────────────────────
// Pan + zoom via CSS transform (same drag pattern as ImageCropper).
// Transform-based: object-fit:cover sizes the image, scale() zooms,
// translate() pans. Works for any aspect ratio including square.

const CROP_SIZE = 280;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

export function ProfilePicCropModal({
  src,
  onSave,
  onClose,
  onUploadNew,
}: {
  src: string;
  onSave: (croppedDataUrl: string) => void;
  onClose: () => void;
  onUploadNew: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [imgOffX, setImgOffX] = useState(0);
  const [imgOffY, setImgOffY] = useState(0);
  const [naturalW, setNaturalW] = useState(0);
  const [naturalH, setNaturalH] = useState(0);
  const [saving, setSaving] = useState(false);

  // Drag state — same ref pattern as ImageCropper
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, offX: 0, offY: 0 });

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setNaturalW(img.naturalWidth);
      setNaturalH(img.naturalHeight);
      setZoom(1);
      setImgOffX(0);
      setImgOffY(0);
    };
    img.src = src;
  }, [src]);

  // Max offset for a given zoom — how far the image can be panned
  const maxOff = useCallback(
    (z: number) => (z - 1) * CROP_SIZE / 2,
    [],
  );

  const clampOff = useCallback(
    (ox: number, oy: number, z: number) => {
      const m = maxOff(z);
      return {
        x: Math.max(-m, Math.min(m, ox)),
        y: Math.max(-m, Math.min(m, oy)),
      };
    },
    [maxOff],
  );

  // Pointer handlers — same pattern as ImageCropper pan mode
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragging.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY, offX: imgOffX, offY: imgOffY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [imgOffX, imgOffY],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      const clamped = clampOff(dragStart.current.offX + dx, dragStart.current.offY + dy, zoom);
      setImgOffX(clamped.x);
      setImgOffY(clamped.y);
    },
    [clampOff, zoom],
  );

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const newZ = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom - e.deltaY * 0.003));
      const clamped = clampOff(imgOffX, imgOffY, newZ);
      setZoom(newZ);
      setImgOffX(clamped.x);
      setImgOffY(clamped.y);
    },
    [zoom, imgOffX, imgOffY, clampOff],
  );

  const handleZoomSlider = useCallback(
    (newZ: number) => {
      const clamped = clampOff(imgOffX, imgOffY, newZ);
      setZoom(newZ);
      setImgOffX(clamped.x);
      setImgOffY(clamped.y);
    },
    [imgOffX, imgOffY, clampOff],
  );

  const handleSave = useCallback(() => {
    if (!imgRef.current || !naturalW || !naturalH) return;
    setSaving(true);
    const canvas = canvasRef.current!;
    const outputSize = 512;
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext("2d")!;

    // Compute the cover-fit dimensions at zoom=1 (how the browser renders object-fit:cover)
    const aspect = naturalW / naturalH;
    let coverW: number, coverH: number;
    if (aspect >= 1) { coverH = CROP_SIZE; coverW = CROP_SIZE * aspect; }
    else { coverW = CROP_SIZE; coverH = CROP_SIZE / aspect; }

    // The visible window into the image (in display-pixel coords of the cover-fitted image)
    // Transform: translate(offX, offY) scale(zoom) with origin: center
    // A screen point (sx,sy) maps to inner coords:
    //   ix = (sx - CROP_SIZE/2 - offX) / zoom + CROP_SIZE/2
    // Visible top-left in inner coords:
    const half = CROP_SIZE / 2;
    const visTLx = (0 - half - imgOffX) / zoom + half;
    const visTLy = (0 - half - imgOffY) / zoom + half;
    const visSize = CROP_SIZE / zoom;

    // In inner coords, the cover-fitted image is centered:
    const imgLeft = (CROP_SIZE - coverW) / 2;
    const imgTop = (CROP_SIZE - coverH) / 2;

    // Source rect in natural image pixels
    const sx = (visTLx - imgLeft) / coverW * naturalW;
    const sy = (visTLy - imgTop) / coverH * naturalH;
    const sw = visSize / coverW * naturalW;
    const sh = visSize / coverH * naturalH;

    ctx.clearRect(0, 0, outputSize, outputSize);
    ctx.beginPath();
    ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(
      imgRef.current,
      sx, sy, sw, sh,
      0, 0, outputSize, outputSize,
    );

    onSave(canvas.toDataURL("image/webp", 0.9));
  }, [zoom, imgOffX, imgOffY, naturalW, naturalH, onSave]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col items-center gap-5 rounded-2xl border border-border bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X size={16} />
        </button>

        <h3 className="text-sm font-medium">Crop profile picture</h3>

        {/* Crop area — full image visible, circle cutout shows the kept region */}
        <div
          className="relative overflow-hidden rounded-xl bg-black"
          style={{
            width: CROP_SIZE,
            height: CROP_SIZE,
            cursor: dragging.current ? "grabbing" : "grab",
            touchAction: "none",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
        >
          {/* Full image — visible everywhere */}
          {naturalW > 0 && (
            <img
              src={src}
              alt=""
              className="pointer-events-none absolute select-none"
              draggable={false}
              style={{
                width: CROP_SIZE,
                height: CROP_SIZE,
                objectFit: "cover",
                transformOrigin: "center center",
                transform: `translate(${imgOffX}px, ${imgOffY}px) scale(${zoom})`,
              }}
            />
          )}
          {/* Dark overlay with circular cutout + border */}
          <svg className="pointer-events-none absolute inset-0" width={CROP_SIZE} height={CROP_SIZE}>
            <defs>
              <mask id="circle-cutout">
                <rect width="100%" height="100%" fill="white" />
                <circle cx="50%" cy="50%" r="49%" fill="black" />
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#circle-cutout)" />
            <circle cx="50%" cy="50%" r="49%" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
          </svg>
        </div>

        {/* Zoom slider */}
        <div className="flex w-full items-center gap-3 px-2">
          <ZoomOut size={14} className="shrink-0 text-muted-foreground" />
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => handleZoomSlider(parseFloat(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-foreground"
          />
          <ZoomIn size={14} className="shrink-0 text-muted-foreground" />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onUploadNew}
            className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Upload size={14} />
            Upload new
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-80",
              saving && "opacity-50",
            )}
          >
            {saving ? "Saving\u2026" : "Save"}
          </button>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
