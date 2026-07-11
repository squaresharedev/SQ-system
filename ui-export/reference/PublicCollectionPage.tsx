import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { GridLoader } from "@/components/GridLoader";
import { ArtifactDetailModal } from "@/components/ArtifactDetailModal";
import { userApi, type PublicProfile, type PublicProfileArtifact } from "@/services/api";
import { transformImage, buildSrcSet } from "@/lib/image";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { useDocumentMeta } from "@/lib/seo";

interface PublicCollectionPageProps {
  username: string;
  collectionSlug: string;
}

export function PublicCollectionPage({ username, collectionSlug }: PublicCollectionPageProps) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(100);
  const [gap, setGap] = useState(12);
  const [cols, setCols] = useState(12);
  const [selectedArtifact, setSelectedArtifact] = useState<PublicProfileArtifact | null>(null);

  useEffect(() => {
    setLoaded(false);
    setProfile(null);
    setError(null);
    userApi.publicProfile(username)
      .then(setProfile)
      .catch(() => setError("User not found"))
      .finally(() => setLoaded(true));
  }, [username]);

  // Find the collection early so it's available to the meta hook
  const collectionForMeta = profile?.collections.find(
    (c) => c.name.toLowerCase() === collectionSlug.toLowerCase(),
  );
  const firstImage = collectionForMeta?.artifacts[0]?.imageUrl;
  useDocumentMeta({
    title: collectionForMeta
      ? `${collectionForMeta.name} · @${username}`
      : collectionSlug,
    description: collectionForMeta
      ? `${collectionForMeta.artifacts.length} artifact${collectionForMeta.artifacts.length === 1 ? "" : "s"} curated by @${username} on SquareShare.`
      : undefined,
    image: firstImage,
    type: "article",
  });

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const compute = () => {
      const style = getComputedStyle(document.documentElement);
      const c = parseInt(style.getPropertyValue("--grid-columns")) || 12;
      const g = parseInt(style.getPropertyValue("--grid-gap")) || 12;
      setCols(c);
      setGap(g);
      const w = el.clientWidth;
      setCellSize((w - (c - 1) * g) / c);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loaded]);

  if (!loaded) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <GridLoader />
      </div>
    );
  }

  if (error || !profile) {
    return <NotFoundPage message={`@${username} doesn't exist`} />;
  }

  const collection = profile.collections.find(
    (c) => c.name.toLowerCase() === collectionSlug.toLowerCase(),
  );

  if (!collection) {
    return <NotFoundPage message={`Collection "${collectionSlug}" not found`} />;
  }

  const arts = collection.artifacts;
  const maxRow = arts.length > 0
    ? arts.reduce((max, a) => Math.max(max, a.gridY + a.spanH - 1), 0)
    : 0;
  const gridRows = Math.max(6, maxRow + 2);

  return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4 sm:mb-8">
        <button
          onClick={() => navigate(`/${username}`)}
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">@{username}</span>
        </button>
        <h1 className="min-w-0 flex-1 truncate text-xl font-medium tracking-tight sm:text-2xl">
          {collection.name}
        </h1>
        <CopyLinkButton url={window.location.href} />
      </div>

      {/* Read-only grid */}
      {arts.length === 0 ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-muted-foreground">No artifacts in this collection.</p>
        </div>
      ) : (
        <div
          ref={gridRef}
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows: `repeat(${gridRows}, ${cellSize}px)`,
            gap: `${gap}px`,
          }}
        >
          {/* Background grid cells */}
          {Array.from({ length: gridRows * cols }, (_, i) => {
            const c = (i % cols) + 1;
            const r = Math.floor(i / cols) + 1;
            return (
              <div
                key={`cell-${c}-${r}`}
                style={{ gridColumn: c, gridRow: r }}
                className="rounded-[--radius-card] border border-dashed border-border/30 bg-muted/10"
              />
            );
          })}

          {/* Artifacts */}
          {arts.map((art) => (
            <ArtifactReadOnly key={art.id} artifact={art} onClick={() => setSelectedArtifact(art)} />
          ))}
        </div>
      )}

      {/* Artifact detail modal (viewer mode) */}
      {selectedArtifact && (
        <ArtifactDetailModal
          artifact={selectedArtifact}
          isOwner={false}
          onClose={() => setSelectedArtifact(null)}
        />
      )}
    </div>
  );
}

function ArtifactReadOnly({ artifact, onClick }: { artifact: PublicProfileArtifact; onClick?: () => void }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className={cn(
        "group relative z-10 cursor-pointer overflow-hidden rounded-[--radius-card] border border-border bg-muted shadow-[--shadow-card]",
      )}
      style={{
        gridColumn: `${artifact.gridX} / span ${artifact.spanW}`,
        gridRow: `${artifact.gridY} / span ${artifact.spanH}`,
      }}
      onClick={onClick}
    >
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-muted" aria-hidden />
      )}
      <img
        src={transformImage(artifact.imageUrl, { width: 640 })}
        srcSet={buildSrcSet(artifact.imageUrl, 640)}
        alt={artifact.title}
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-200",
          loaded ? "opacity-100" : "opacity-0",
        )}
        style={{
          transformOrigin: `${artifact.imgOffsetX}% ${artifact.imgOffsetY}%`,
          transform: "scale(1.5)",
        }}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
      />
      {/* Hover metadata overlay */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 flex flex-col justify-end px-4 pb-3 pt-10",
          "bg-gradient-to-t from-black/80 to-transparent",
          "translate-y-2 opacity-0 transition-all duration-[--duration-normal] group-hover:translate-y-0 group-hover:opacity-100",
        )}
      >
        <span className="truncate text-sm font-medium text-white">{artifact.title}</span>
        {artifact.description && (
          <span className="truncate text-xs text-white/70">{artifact.description}</span>
        )}
      </div>
    </div>
  );
}

function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available — graceful no-op
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "flex h-9 shrink-0 items-center gap-2 rounded-[--radius-card] border border-border px-3 text-sm transition-all duration-150",
        copied
          ? "border-foreground/30 bg-muted text-foreground"
          : "text-muted-foreground hover:border-foreground/20 hover:text-foreground active:scale-95",
      )}
      aria-label="Copy link"
    >
      {copied ? <Check size={14} /> : <Link2 size={14} />}
      <span className="hidden sm:inline">{copied ? "Copied!" : "Share"}</span>
    </button>
  );
}
