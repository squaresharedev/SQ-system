import { useState, useRef, useEffect, type FormEvent } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  linkWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { Link } from "react-router-dom";
import { auth } from "@/lib/firebase";
import type { AuthFormState } from "@/types";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { userApi, authApi, setAuthToken } from "@/services/api";

interface AuthPageProps {
  onAuth: (email: string, idToken: string) => void;
}

/**
 * AuthPage — Minimalist login / signup switch.
 *
 * Single page with a toggle between Login and Sign Up.
 * Uses basic HTML form validation; Firebase integration
 * will replace the stub `onAuth` callback.
 */
export function AuthPage({ onAuth }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [form, setForm] = useState<AuthFormState>({
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const checkTimer = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (checkTimer.current) clearTimeout(checkTimer.current);
    if (!username || username.length < 3 || !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      setUsernameStatus("idle");
      return;
    }
    setUsernameStatus("checking");
    checkTimer.current = setTimeout(async () => {
      try {
        const res = await userApi.checkUsername(username);
        setUsernameStatus(res.available ? "available" : "taken");
      } catch {
        setUsernameStatus("idle");
      }
    }, 400);
    return () => { if (checkTimer.current) clearTimeout(checkTimer.current); };
  }, [username]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.email || !form.password) {
      setError("All fields are required.");
      return;
    }
    if (mode === "signup" && form.password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (mode === "signup" && !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      setError("Username must be 3-30 characters: letters, numbers, underscores.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      // Resolve username to email for login
      let loginEmail = form.email;
      if (mode === "login" && !form.email.includes("@")) {
        try {
          const resolved = await authApi.resolveUsername(form.email);
          loginEmail = resolved.email;
        } catch {
          setError("Invalid credentials.");
          setLoading(false);
          return;
        }
      }

      const fn = mode === "login"
        ? signInWithEmailAndPassword
        : createUserWithEmailAndPassword;
      const cred = await fn(auth, loginEmail, form.password);
      const idToken = await cred.user.getIdToken();
      // Set token so API calls work
      setAuthToken(idToken);
      // Set chosen username for new signups
      if (mode === "signup" && username) {
        try {
          await userApi.setUsername(username);
        } catch {
          // Non-fatal — user gets random username, can change later
        }
      }
      onAuth(cred.user.email ?? form.email, idToken);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      // For username logins, always show generic error to prevent enumeration
      const usedUsername = mode === "login" && !form.email.includes("@");
      if (usedUsername && (message.includes("auth/invalid-credential") || message.includes("auth/wrong-password") || message.includes("auth/user-not-found"))) {
        setError("Invalid credentials.");
      } else if (message.includes("auth/email-already-in-use")) {
        setError("An account with this email already exists. Try signing in with Google.");
      } else if (message.includes("auth/invalid-credential") || message.includes("auth/wrong-password")) {
        setError("Invalid email or password. If you signed up with Google, use the Google button below.");
      } else if (message.includes("auth/user-not-found")) {
        setError("No account found with this email.");
      } else if (message.includes("auth/weak-password")) {
        setError("Password is too weak. Use at least 6 characters.");
      } else if (message.includes("auth/too-many-requests")) {
        setError("Too many attempts. Please try again later.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);

      // If the user had typed a password, link email/password provider
      // so they can also log in with email + password in the future.
      if (form.password && form.password.length >= 8) {
        try {
          const emailCred = EmailAuthProvider.credential(
            cred.user.email!,
            form.password,
          );
          await linkWithCredential(cred.user, emailCred);
        } catch {
          // Already linked or other non-fatal error — ignore
        }
      }

      const idToken = await cred.user.getIdToken();
      setAuthToken(idToken);
      onAuth(cred.user.email ?? "", idToken);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Google sign-in failed";
      if (message.includes("auth/popup-closed-by-user")) {
        // User closed the popup — don't show an error
      } else if (message.includes("auth/cancelled-popup-request")) {
        // Duplicate popup — ignore
      } else {
        setError("Google sign-in failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        {/* ── Brand mark ──────────────────────── */}
        <h1 className="mb-1 text-center text-3xl font-medium tracking-tighter">
          SquareShare
        </h1>
        <p className="mb-8 text-center text-sm text-muted-foreground">
          Your minimalist artifact archive.
        </p>

        {/* ── Mode toggle ─────────────────────── */}
        <div className="mb-6 flex rounded-[--radius-pill] border border-border p-0.5">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError(null);
                setConfirmPassword("");
                setUsername("");
                setUsernameStatus("idle");
              }}
              className={cn(
                "h-10 flex-1 rounded-[--radius-pill] text-sm font-medium transition-colors",
                mode === m
                  ? "bg-foreground text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "login" ? "Log In" : "Sign Up"}
            </button>
          ))}
        </div>

        {/* ── Form ────────────────────────────── */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder={mode === "login" ? "Email or username" : "Email"}
            value={form.email}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, email: e.target.value }))
            }
            className={cn(
              "h-11 w-full rounded-[--radius-card] border border-border bg-background",
              "px-3 text-base placeholder:text-muted-foreground sm:text-sm",
              "outline-none transition-colors focus:border-foreground",
            )}
            autoFocus
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={form.password}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, password: e.target.value }))
              }
              className={cn(
                "h-11 w-full rounded-[--radius-card] border border-border bg-background",
                "px-3 pr-10 text-base placeholder:text-muted-foreground sm:text-sm",
                "outline-none transition-colors focus:border-foreground",
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[--radius-card] text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {mode === "signup" && (
            <>
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={cn(
                  "h-11 w-full rounded-[--radius-card] border border-border bg-background",
                  "px-3 text-base placeholder:text-muted-foreground sm:text-sm",
                  "outline-none transition-colors focus:border-foreground",
                )}
              />
              <div className="relative">
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={cn(
                    "h-11 w-full rounded-[--radius-card] border bg-background",
                    "px-3 pr-10 text-base placeholder:text-muted-foreground sm:text-sm",
                    "outline-none transition-colors focus:border-foreground",
                    usernameStatus === "available" && "border-green-500",
                    usernameStatus === "taken" && "border-destructive",
                    usernameStatus !== "available" && usernameStatus !== "taken" && "border-border",
                  )}
                  maxLength={30}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {usernameStatus === "checking" && (
                    <div className="h-4 w-4 spinner rounded-full border-2 border-muted-foreground border-t-transparent" />
                  )}
                  {usernameStatus === "available" && <CheckCircle2 size={16} className="text-green-500" />}
                  {usernameStatus === "taken" && <XCircle size={16} className="text-destructive" />}
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-[--radius-card] border border-destructive/30 bg-destructive/5 px-3 py-2.5">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={cn(
              "mt-1 h-11 w-full rounded-[--radius-pill] bg-foreground px-5",
              "text-sm font-medium text-accent-foreground",
              "transition-all duration-[--duration-fast]",
              "hover:opacity-80 hover:scale-[1.01] active:scale-[0.98]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {loading ? "…" : mode === "login" ? "Log In" : "Create Account"}
          </button>
        </form>

        {/* ── Divider ─────────────────────────── */}
        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* ── Google sign-in ──────────────────── */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className={cn(
            "flex h-11 w-full items-center justify-center gap-3 rounded-[--radius-pill] border border-border px-5",
            "text-sm font-medium transition-all duration-[--duration-fast]",
            "hover:bg-muted active:scale-[0.98]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.04 24.04 0 0 0 0 21.56l7.98-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continue with Google
        </button>

        {/* ── Legal links ─────────────────────── */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <Link to="/community-guidelines" className="underline transition-colors hover:text-foreground">Community Guidelines</Link>
          {" "}and{" "}
          <Link to="/privacy-policy" className="underline transition-colors hover:text-foreground">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
