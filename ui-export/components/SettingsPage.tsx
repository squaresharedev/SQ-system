import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { userApi } from "@/services/api";
import { CheckCircle2, XCircle, Camera } from "lucide-react";
import { ProfilePicCropModal } from "./ProfilePage";
import { useToast } from "@/components/Toast";

interface SettingsPageProps {
  userEmail: string;
  onLogout: () => void;
  initialTab?: Tab;
  cachedUsername?: string | null;
  cachedProfilePic?: string | null;
}

const TABS = [
  "Profile",
  "Achievements",
  "Appearance",
  "Notifications",
  "Security",
  "Help",
  "Advanced",
  "Community Guidelines",
  "Privacy Policy",
] as const;

type Tab = (typeof TABS)[number];

export function SettingsPage({ userEmail, onLogout, initialTab, cachedUsername, cachedProfilePic }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? "Profile");

  // Sync when parent changes initialTab
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <div className="w-full px-4 py-6 sm:px-8 sm:py-10">
      <h1 className="mb-6 text-2xl font-bold tracking-tight sm:mb-8 sm:text-3xl">Settings</h1>

      {/* ── Tab bar ──────────────────────────── */}
      <div className="border-b border-border">
        <nav className="-mb-px flex gap-1 overflow-x-auto pb-0 sm:gap-8">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "whitespace-nowrap px-2 pb-3 text-xs font-medium transition-colors sm:px-0 sm:text-sm",
                activeTab === tab
                  ? "border-b-2 border-foreground text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab content ─────────────────────── */}
      <div className="mt-8 w-full max-w-2xl">
        {activeTab === "Profile" && (
          <ProfileTab userEmail={userEmail} cachedUsername={cachedUsername} cachedProfilePic={cachedProfilePic} />
        )}
        {activeTab === "Achievements" && <AchievementsTab />}
        {activeTab === "Appearance" && <AppearanceTab />}
        {activeTab === "Notifications" && <NotificationsTab />}
        {activeTab === "Security" && (
          <SecurityTab onLogout={onLogout} />
        )}
        {activeTab === "Help" && <HelpTab />}
        {activeTab === "Advanced" && <AdvancedTab />}
        {activeTab === "Community Guidelines" && <CommunityGuidelinesTab />}
        {activeTab === "Privacy Policy" && <PrivacyPolicyTab />}
      </div>
    </div>
  );
}

// ─── Field helpers ─────────────────────────────────────────────────

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="h-10 w-full rounded-[--radius-card] border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-foreground disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-3">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-[--duration-fast]",
          checked ? "bg-foreground" : "bg-border",
        )}
      >
        <span
          className={cn(
            "block h-4 w-4 translate-x-0.5 rounded-full bg-white transition-transform duration-[--duration-fast]",
            checked && "translate-x-4",
          )}
        />
      </button>
      <div className="flex-1">
        <span className="text-sm font-medium">{label}</span>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </label>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-lg font-semibold">{children}</h2>;
}

function SaveButton({ onClick, label = "Save changes" }: { onClick: () => void; label?: string }) {
  const [saved, setSaved] = useState(false);

  const handleClick = () => {
    onClick();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <button
      onClick={handleClick}
      className="mt-2 h-10 rounded-[--radius-card] bg-foreground px-5 text-sm font-medium text-accent-foreground transition-all duration-[--duration-fast] hover:opacity-90 active:scale-[0.98]"
    >
      {saved ? "Saved ✓" : label}
    </button>
  );
}

// ─── Profile Tab ───────────────────────────────────────────────────

function ProfileTab({ userEmail, cachedUsername, cachedProfilePic }: { userEmail: string; cachedUsername?: string | null; cachedProfilePic?: string | null }) {
  const { toast } = useToast();
  const [currentUsername, setCurrentUsername] = useState(cachedUsername ?? "");
  const [newUsername, setNewUsername] = useState(cachedUsername ?? "");
  const [profilePic, setProfilePic] = useState<string | null>(cachedProfilePic ?? null);
  const [rawPicForCrop, setRawPicForCrop] = useState<string | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Only fetch from API if no cached data was provided
  useEffect(() => {
    if (cachedUsername && cachedUsername.length > 0) return;
    userApi.me().then((u) => {
      setCurrentUsername(u.username);
      setNewUsername(u.username);
      if (u.profilePicUrl) setProfilePic(u.profilePicUrl);
    }).catch(() => {});
  }, []);

  const handlePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast("Profile picture must be under 2 MB.", "error"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const raw = reader.result as string;
      setRawPicForCrop(raw);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCropSave = async (croppedDataUrl: string) => {
    setCropModalOpen(false);
    setProfilePic(croppedDataUrl);
    try { await userApi.updateProfilePic(croppedDataUrl); } catch {}
  };

  useEffect(() => {
    if (!newUsername || newUsername === currentUsername || newUsername.length < 3 || !/^[a-zA-Z0-9_]{3,30}$/.test(newUsername)) {
      setUsernameStatus("idle");
      return;
    }
    setUsernameStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await userApi.checkUsername(newUsername);
        setUsernameStatus(res.available ? "available" : "taken");
      } catch {
        setUsernameStatus("idle");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [newUsername, currentUsername]);

  const handleSave = async () => {
    if (newUsername === currentUsername) return;
    setSaving(true);
    setMessage(null);
    try {
      const isFirstTime = currentUsername.startsWith("user_") && currentUsername.length === 13;
      if (isFirstTime) {
        await userApi.setUsername(newUsername);
      } else {
        await userApi.updateUsername(newUsername);
      }
      setCurrentUsername(newUsername);
      setMessage({ type: "success", text: "Username updated!" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update username.";
      setMessage({ type: "error", text: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SectionHeading>Profile</SectionHeading>

      {/* Profile picture */}
      <div className="mb-6 flex items-center gap-4">
        <button
          type="button"
          onClick={() => {
            if (rawPicForCrop || profilePic) {
              setCropModalOpen(true);
            } else {
              fileRef.current?.click();
            }
          }}
          className="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted ring-2 ring-border transition-all hover:ring-foreground/30"
        >
          {profilePic ? (
            <img src={profilePic} alt="Profile" className="h-full w-full object-cover" />
          ) : (
            <span className="text-lg font-semibold text-muted-foreground">
              {(currentUsername || userEmail).slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <Camera size={16} className="text-white" />
          </div>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePicChange} />
        <div className="text-sm text-muted-foreground">Click to edit profile picture</div>
      </div>

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

      <FieldGroup label="Email">
        <TextInput value={userEmail} onChange={() => {}} disabled />
      </FieldGroup>
      <FieldGroup label="Username">
        <div className="relative">
          <input
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            maxLength={30}
            className={cn(
              "h-10 w-full rounded-[--radius-card] border bg-background px-3 pr-10 text-sm outline-none transition-colors focus:border-foreground",
              usernameStatus === "available" && "border-green-500",
              usernameStatus === "taken" && "border-destructive",
              usernameStatus !== "available" && usernameStatus !== "taken" && "border-border",
            )}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {usernameStatus === "checking" && (
              <div className="h-4 w-4 spinner rounded-full border-2 border-muted-foreground border-t-transparent" />
            )}
            {usernameStatus === "available" && <CheckCircle2 size={16} className="text-green-500" />}
            {usernameStatus === "taken" && <XCircle size={16} className="text-destructive" />}
            {usernameStatus === "idle" && newUsername === currentUsername && currentUsername.length > 0 && (
              <CheckCircle2 size={16} className="text-green-500" />
            )}
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          3-30 characters: letters, numbers, underscores. Can change once per month.
        </p>
      </FieldGroup>
      {message && (
        <p className={cn(
          "mb-4 text-sm",
          message.type === "success" ? "text-green-500" : "text-destructive",
        )}>
          {message.text}
        </p>
      )}
      <button
        onClick={handleSave}
        disabled={saving || newUsername === currentUsername || usernameStatus === "taken" || usernameStatus === "checking"}
        className="mt-2 h-10 rounded-[--radius-card] bg-foreground px-5 text-sm font-medium text-accent-foreground transition-all duration-[--duration-fast] hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? "Saving..." : "Save changes"}
      </button>
    </>
  );
}

// ─── Achievements Tab ──────────────────────────────────────────────

const ACHIEVEMENTS = [
  { name: "First Artifact", desc: "Add your first artifact to the grid", unlocked: true },
  { name: "Curator", desc: "Create 10 artifacts", unlocked: false },
  { name: "Collector", desc: "Create 5 collections", unlocked: false },
  { name: "Organizer", desc: "Resize an artifact", unlocked: true },
  { name: "Archivist", desc: "Reach 50 artifacts", unlocked: false },
  { name: "Minimalist", desc: "Keep all artifacts at 1×1 size", unlocked: false },
];

function AchievementsTab() {
  return (
    <>
      <SectionHeading>Achievements</SectionHeading>
      <p className="mb-6 text-sm text-muted-foreground">
        Track your progress as you curate your archive.
      </p>
      <div className="flex flex-col gap-3">
        {ACHIEVEMENTS.map((a) => (
          <div
            key={a.name}
            className={cn(
              "flex items-center gap-4 rounded-[--radius-card] border border-border p-4",
              a.unlocked ? "bg-background" : "opacity-50",
            )}
          >
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm",
                a.unlocked
                  ? "bg-foreground text-accent-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {a.unlocked ? "★" : "○"}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{a.name}</p>
              <p className="text-xs text-muted-foreground">{a.desc}</p>
            </div>
            {a.unlocked && (
              <span className="text-xs font-medium text-muted-foreground">Unlocked</span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Appearance Tab ────────────────────────────────────────────────

type ThemeOption = "light" | "dark" | "system";

function AppearanceTab() {
  const [theme, setTheme] = useState<ThemeOption>(() => {
    return (localStorage.getItem("allgrid-theme") as ThemeOption) || "light";
  });
  const [gridDensity, setGridDensity] = useState<"compact" | "comfortable" | "spacious">(() => {
    return (localStorage.getItem("allgrid-density") as any) || "comfortable";
  });
  const [showLabels, setShowLabels] = useState(true);
  const [animateTransitions, setAnimateTransitions] = useState(true);

  useEffect(() => {
    localStorage.setItem("allgrid-theme", theme);
    document.documentElement.classList.remove("light", "dark");
    if (theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.add(prefersDark ? "dark" : "light");
    } else {
      document.documentElement.classList.add(theme);
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("allgrid-density", gridDensity);
    const root = document.documentElement;
    const values = { compact: "8px", comfortable: "12px", spacious: "20px" };
    root.style.setProperty("--grid-gap", values[gridDensity]);
  }, [gridDensity]);

  return (
    <>
      <SectionHeading>Appearance</SectionHeading>

      {/* Theme */}
      <FieldGroup label="Theme">
        <div className="flex gap-3">
          {(["light", "dark", "system"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={cn(
                "flex-1 rounded-[--radius-card] border px-4 py-2.5 text-sm font-medium capitalize transition-all duration-[--duration-fast]",
                theme === t
                  ? "border-foreground bg-foreground text-accent-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/30",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </FieldGroup>

      {/* Grid density */}
      <FieldGroup label="Grid density">
        <div className="flex gap-3">
          {(["compact", "comfortable", "spacious"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setGridDensity(d)}
              className={cn(
                "flex-1 rounded-[--radius-card] border px-4 py-2.5 text-sm font-medium capitalize transition-all duration-[--duration-fast]",
                gridDensity === d
                  ? "border-foreground bg-foreground text-accent-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/30",
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </FieldGroup>

      <Toggle
        checked={showLabels}
        onChange={setShowLabels}
        label="Show artifact labels"
        description="Display title and description overlay on hover"
      />
      <Toggle
        checked={animateTransitions}
        onChange={setAnimateTransitions}
        label="Animate transitions"
        description="Smooth animations when dragging and resizing"
      />
    </>
  );
}

// ─── Notifications Tab ─────────────────────────────────────────────

function NotificationsTab() {
  const [emailNotifs, setEmailNotifs] = useState(
    () => localStorage.getItem("ss-notif-email") !== "false",
  );
  const [weeklyDigest, setWeeklyDigest] = useState(
    () => localStorage.getItem("ss-notif-digest") === "true",
  );
  const [achievementAlerts, setAchievementAlerts] = useState(
    () => localStorage.getItem("ss-notif-achievements") !== "false",
  );

  const save = () => {
    localStorage.setItem("ss-notif-email", String(emailNotifs));
    localStorage.setItem("ss-notif-digest", String(weeklyDigest));
    localStorage.setItem("ss-notif-achievements", String(achievementAlerts));
  };

  return (
    <>
      <SectionHeading>Notifications</SectionHeading>
      <p className="mb-4 text-sm text-muted-foreground">
        Choose what updates you want to receive.
      </p>
      <div className="flex flex-col divide-y divide-border">
        <Toggle
          checked={emailNotifs}
          onChange={setEmailNotifs}
          label="Email notifications"
          description="Receive email when important events occur"
        />
        <Toggle
          checked={weeklyDigest}
          onChange={setWeeklyDigest}
          label="Weekly digest"
          description="A summary of your archive activity each week"
        />
        <Toggle
          checked={achievementAlerts}
          onChange={setAchievementAlerts}
          label="Achievement alerts"
          description="Get notified when you unlock new achievements"
        />
      </div>
      <SaveButton onClick={save} />
    </>
  );
}

// ─── Security Tab ──────────────────────────────────────────────────

function SecurityTab({ onLogout }: { onLogout: () => void }) {
  const [currentPw, setCurrentPw] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [privacyLoading, setPrivacyLoading] = useState(true);

  useEffect(() => {
    userApi.me().then((u) => {
      setIsPublic(u.isPublic);
      setPrivacyLoading(false);
    }).catch(() => setPrivacyLoading(false));
  }, []);

  const togglePrivacy = async () => {
    const next = !isPublic;
    setIsPublic(next);
    try {
      await userApi.updatePrivacy(next);
    } catch {
      setIsPublic(!next); // revert on failure
    }
  };
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");

  const handleChangePw = () => {
    setError("");
    if (!currentPw || !newPw || !confirmPw) {
      setError("All fields are required.");
      return;
    }
    if (newPw.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setError("Passwords do not match.");
      return;
    }
    // Stub — would call Firebase reauthenticate + updatePassword
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
  };

  return (
    <>
      <SectionHeading>Security</SectionHeading>

      <p className="mb-6 text-sm text-muted-foreground">
        Manage your password and active sessions.
      </p>

      <h3 className="mb-3 text-sm font-semibold">Change password</h3>
      <div className="flex flex-col gap-3 mb-4">
        <TextInput
          value={currentPw}
          onChange={setCurrentPw}
          placeholder="Current password"
          type="password"
        />
        <TextInput
          value={newPw}
          onChange={setNewPw}
          placeholder="New password"
          type="password"
        />
        <TextInput
          value={confirmPw}
          onChange={setConfirmPw}
          placeholder="Confirm new password"
          type="password"
        />
      </div>
      {error && (
        <p className="mb-3 text-sm text-destructive">{error}</p>
      )}
      <SaveButton onClick={handleChangePw} label="Update password" />

      {/* ── Account privacy ───────────────────── */}
      <div className="mt-10 border-t border-border pt-6">
        <h3 className="mb-2 text-sm font-semibold">Account visibility</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          When your account is public, other users can find you and your
          public collections via search. Private accounts are hidden from search.
        </p>
        <button
          onClick={togglePrivacy}
          disabled={privacyLoading}
          className={cn(
            "flex w-full items-center gap-3 rounded-[--radius-card] border px-4 py-3 text-sm font-medium transition-all duration-[--duration-fast] sm:w-auto",
            isPublic
              ? "border-green-500/30 bg-green-500/10 text-green-500"
              : "border-border text-muted-foreground hover:text-foreground",
            privacyLoading && "opacity-50 cursor-not-allowed",
          )}
        >
          <span className={cn(
            "flex h-5 w-9 items-center rounded-full p-0.5 transition-colors",
            isPublic ? "bg-green-500" : "bg-muted",
          )}>
            <span className={cn(
              "h-4 w-4 rounded-full bg-white transition-transform",
              isPublic ? "translate-x-4" : "translate-x-0",
            )} />
          </span>
          {isPublic ? "Public — visible in search" : "Private — hidden from search"}
        </button>
      </div>

      <div className="mt-10 border-t border-border pt-6">
        <h3 className="mb-2 text-sm font-semibold">Sessions</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Sign out of all devices by logging out below.
        </p>
        <button
          onClick={onLogout}
          className="h-10 rounded-[--radius-card] border border-destructive px-5 text-sm font-medium text-destructive transition-all duration-[--duration-fast] hover:bg-destructive hover:text-white active:scale-[0.98]"
        >
          Log out everywhere
        </button>
      </div>
    </>
  );
}

// ─── Help Tab ──────────────────────────────────────────────────────

const FAQ = [
  {
    q: "How do I add an artifact?",
    a: "Click the + button in the sidebar or press the \"New Artifact\" button when the sidebar is expanded.",
  },
  {
    q: "How do I resize an artifact?",
    a: "Hover over an artifact and click the resize handle in the bottom-right corner. Choose a preset size from the popover.",
  },
  {
    q: "How do I create a collection?",
    a: "Open the sidebar and click the + button next to \"Collections\". Give your collection a name.",
  },
  {
    q: "How do I reorder artifacts?",
    a: "Drag and drop artifacts on the grid. They will automatically reflow to fill available space.",
  },
  {
    q: "Can I delete an artifact?",
    a: "Hover over an artifact and click the × button in the top-right corner.",
  },
];

function HelpTab() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <>
      <SectionHeading>Help & FAQ</SectionHeading>
      <div className="flex flex-col divide-y divide-border">
        {FAQ.map((item, i) => (
          <div key={i} className="py-4">
            <button
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              className="flex w-full items-center justify-between text-left text-sm font-medium"
            >
              {item.q}
              <span className="ml-4 shrink-0 text-muted-foreground">
                {openIdx === i ? "−" : "+"}
              </span>
            </button>
            {openIdx === i && (
              <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-[--radius-card] border border-border p-5">
        <h3 className="mb-1 text-sm font-semibold">Need more help?</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Reach out and we'll get back to you as soon as possible.
        </p>
        <a
          href="mailto:support@allgrid.app"
          className="inline-flex h-10 items-center rounded-[--radius-card] border border-border px-5 text-sm font-medium transition-all duration-[--duration-fast] hover:bg-muted"
        >
          Contact support
        </a>
      </div>
    </>
  );
}

// ─── Advanced Tab ──────────────────────────────────────────────────

function AdvancedTab() {
  const [gridColumns, setGridColumns] = useState("12");
  const [cellSize, setCellSize] = useState("120");
  const [exportMsg, setExportMsg] = useState("");

  const applyGridSettings = () => {
    const cols = parseInt(gridColumns, 10);
    const size = parseInt(cellSize, 10);
    if (!isNaN(cols) && cols >= 4 && cols <= 24) {
      document.documentElement.style.setProperty("--grid-columns", String(cols));
    }
    if (!isNaN(size) && size >= 60 && size <= 300) {
      document.documentElement.style.setProperty("--grid-cell-size", `${size}px`);
    }
  };

  const handleExport = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      artifacts: "[]",
      collections: "[]",
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "allgrid-export.json";
    a.click();
    URL.revokeObjectURL(url);
    setExportMsg("Exported!");
    setTimeout(() => setExportMsg(""), 2000);
  };

  const handleClearLocal = () => {
    localStorage.clear();
    setExportMsg("Local storage cleared.");
    setTimeout(() => setExportMsg(""), 2000);
  };

  return (
    <>
      <SectionHeading>Advanced</SectionHeading>

      <h3 className="mb-3 text-sm font-semibold">Grid configuration</h3>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:gap-4">
        <FieldGroup label="Columns">
          <TextInput
            value={gridColumns}
            onChange={setGridColumns}
            placeholder="4–24"
          />
        </FieldGroup>
        <FieldGroup label="Cell size (px)">
          <TextInput
            value={cellSize}
            onChange={setCellSize}
            placeholder="60–300"
          />
        </FieldGroup>
      </div>
      <SaveButton onClick={applyGridSettings} label="Apply grid settings" />

      <div className="mt-10 border-t border-border pt-6">
        <h3 className="mb-3 text-sm font-semibold">Data</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExport}
            className="h-10 rounded-[--radius-card] border border-border px-5 text-sm font-medium transition-all duration-[--duration-fast] hover:bg-muted active:scale-[0.98]"
          >
            Export data
          </button>
          <button
            onClick={handleClearLocal}
            className="h-10 rounded-[--radius-card] border border-destructive px-5 text-sm font-medium text-destructive transition-all duration-[--duration-fast] hover:bg-destructive hover:text-white active:scale-[0.98]"
          >
            Clear local storage
          </button>
        </div>
        {exportMsg && (
          <p className="mt-3 text-sm text-muted-foreground">{exportMsg}</p>
        )}
      </div>
    </>
  );
}

// ─── Community Guidelines ──────────────────────────────────────────

function CommunityGuidelinesTab() {
  return (
    <>
      <SectionHeading>Community Guidelines</SectionHeading>

      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h3 className="mb-2 text-base font-semibold text-foreground">
            The Rules of the Grid
          </h3>
          <p>
            SquareShare is a minimalist digital archive — a place to collect,
            organise, and display the things that matter to you. To keep the
            grid clean and safe for everyone, every item uploaded to SquareShare
            must follow the guidelines below.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-base font-semibold text-foreground">
            What's Not Allowed
          </h3>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Nudity &amp; sexual content</strong> — Explicit or
              suggestive imagery of any kind.
            </li>
            <li>
              <strong>Graphic violence</strong> — Gore, graphic injury, or
              content that glorifies violence.
            </li>
            <li>
              <strong>Hate speech &amp; harassment</strong> — Slurs, threats,
              or content targeting individuals or groups based on race,
              ethnicity, religion, gender, sexual orientation, or disability.
            </li>
            <li>
              <strong>Illegal items &amp; activity</strong> — Weapons, drugs,
              counterfeit goods, or anything that promotes illegal activity.
            </li>
            <li>
              <strong>Spam &amp; misleading content</strong> — Mass-uploaded
              junk, scams, or deceptive artifacts.
            </li>
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-base font-semibold text-foreground">
            AI Moderation
          </h3>
          <p>
            Every image uploaded to SquareShare is automatically analysed by our
            AI moderation engine (powered by Google Gemini). The AI checks for
            violations against the categories listed above and may reject an
            upload before it reaches the grid. This process is instant,
            automated, and exists solely to enforce these guidelines — the AI
            does not store, learn from, or share your images.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-base font-semibold text-foreground">
            Hardware Exception
          </h3>
          <p>
            SquareShare is designed to archive physical and digital objects.
            Images of real-world hardware — tools, electronics, mechanical
            parts, collectibles — are always welcome, even if they look unusual.
            The moderation engine is tuned to allow hardware photography.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-base font-semibold text-foreground">
            Enforcement
          </h3>
          <p>
            Violations may result in content removal or account restriction.
            Repeated or severe violations lead to permanent suspension. If you
            believe a moderation decision was made in error, contact us through
            the Help tab.
          </p>
        </section>
      </div>
    </>
  );
}

// ─── Privacy Policy ────────────────────────────────────────────────

function PrivacyPolicyTab() {
  return (
    <>
      <SectionHeading>Privacy Policy</SectionHeading>

      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h3 className="mb-2 text-base font-semibold text-foreground">
            Data &amp; Trust
          </h3>
          <p>
            SquareShare stores the minimum data needed to run the service:
            your email address, username, profile picture, and the artifacts
            you upload. All data is stored in a secured Supabase-hosted
            PostgreSQL database and Supabase Storage.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-base font-semibold text-foreground">
            AI Processing
          </h3>
          <p>
            Uploaded images are sent to Google Gemini exclusively for content
            moderation — to verify they comply with our Community Guidelines.
            Gemini does not retain your images after analysis, and no image data
            is used for model training. No other AI service processes your
            content.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-base font-semibold text-foreground">
            Intellectual Property
          </h3>
          <p>
            You retain full ownership of every artifact you upload. SquareShare
            does not claim any rights over your content. We do not sell, license,
            or share your uploads with third parties.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-base font-semibold text-foreground">
            Public vs. Private
          </h3>
          <p>
            All collections and artifacts are <strong>private by default</strong>.
            Only you can see your grid unless you explicitly choose to share it.
            We will never change your visibility settings without your consent.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-base font-semibold text-foreground">
            Authentication
          </h3>
          <p>
            SquareShare uses Firebase Authentication. We never see or store your
            password — authentication tokens are managed entirely by Firebase.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-base font-semibold text-foreground">
            Data Deletion
          </h3>
          <p>
            You can delete individual artifacts or entire collections at any
            time. If you wish to delete your account and all associated data,
            contact us through the Help tab.
          </p>
        </section>
      </div>
    </>
  );
}
