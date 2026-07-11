import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, Image as ImageIcon, Check, Link2, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { userApi, type PublicProfile } from "@/services/api";
import { CollectionGridPreview } from "@/components/CollectionGridPreview";
import { GridLoader } from "@/components/GridLoader";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { useDocumentMeta } from "@/lib/seo";
import { useToast } from "@/components/Toast";

interface PublicProfilePageProps {
  username: string;
}

export function PublicProfilePage({ username }: PublicProfilePageProps) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setProfile(null);
    setError(null);
    userApi.publicProfile(username)
      .then(setProfile)
      .catch(() => setError("User not found"))
      .finally(() => setLoaded(true));
  }, [username]);

  // SEO / link-preview meta — uses profile's avatar as the OG image
  // and falls back to a generic description while loading.
  useDocumentMeta({
    title: profile ? `@${profile.username}` : `@${username}`,
    description: profile
      ? profile.isPublic
        ? `Explore @${profile.username}'s public collections on SquareShare.`
        : `@${profile.username} on SquareShare.`
      : undefined,
    image: profile?.profilePicUrl ?? undefined,
    type: "profile",
  });

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

  const initials = profile.username.slice(0, 2).toUpperCase();

  return (
    <div className="w-full px-4 py-4 sm:px-8 sm:py-6">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="mb-6 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      {/* Profile header — matches ProfilePage layout */}
      <div className="mb-10 flex items-center gap-5">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted ring-2 ring-border">
          {profile.profilePicUrl ? (
            <img src={profile.profilePicUrl} alt={profile.username} className="h-full w-full object-cover" />
          ) : (
            <span className="text-xl font-semibold text-muted-foreground">{initials}</span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="text-lg font-semibold tracking-tight">@{profile.username}</h1>
          {!profile.isPublic && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock size={12} />
              <span>Private account</span>
            </div>
          )}
        </div>
        {profile.isPublic && (
          <div className="flex shrink-0 items-center gap-2">
            <FollowButton />
            <CopyLinkButton url={window.location.href} />
          </div>
        )}
      </div>

      {/* Private account message */}
      {!profile.isPublic && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Lock size={32} className="mb-3 text-muted-foreground" />
          <p className="text-lg font-medium">This account is private</p>
          <p className="mt-1 text-sm text-muted-foreground">Their collections are not visible.</p>
        </div>
      )}

      {/* Collections — matches ProfilePage grid layout */}
      {profile.isPublic && (
        <div>
          <h2 className="mb-4 text-lg font-medium tracking-tight">Collections</h2>
          {profile.collections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No public collections yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {profile.collections.map((col) => (
                <div
                  key={col.id}
                  className={cn(
                    "group relative flex cursor-pointer flex-col overflow-hidden rounded-[--radius-card] border",
                    "border-border transition-colors duration-[--duration-fast] hover:border-foreground/15",
                  )}
                  onClick={() => navigate(`/${profile.username}/${encodeURIComponent(col.name)}`)}
                >
                  <CollectionGridPreview artifacts={col.artifacts} />
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{col.name}</span>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <ImageIcon size={10} />
                          {col.artifacts.length} artifact{col.artifacts.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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

function FollowButton() {
  const { toast } = useToast();
  const [following, setFollowing] = useState(false);

  const handleClick = () => {
    // Backend not wired yet — local-only optimistic toggle + toast.
    setFollowing((v) => !v);
    toast(following ? "Unfollowed" : "Following", "success");
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex h-9 shrink-0 items-center gap-1.5 rounded-[--radius-pill] px-4 text-xs font-medium transition-all duration-150 active:scale-95",
        following
          ? "border border-border text-foreground hover:bg-muted"
          : "bg-foreground text-accent-foreground hover:opacity-80",
      )}
    >
      <UserPlus size={14} />
      {following ? "Following" : "Follow"}
    </button>
  );
}
