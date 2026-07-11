import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { X, CheckCircle2, AlertCircle } from "lucide-react";

type ToastVariant = "default" | "error" | "success" | "progress";

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
  /** Show a progress toast, returns an object to resolve/reject it */
  progressToast: (message: string) => {
    success: (msg: string) => void;
    error: (msg: string) => void;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const toast = useCallback((message: string, variant: ToastVariant = "default") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, variant }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateToast = useCallback((id: number, message: string, variant: ToastVariant) => {
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, message, variant } : t));
  }, []);

  const progressToast = useCallback((message: string) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, variant: "progress" }]);
    return {
      success: (msg: string) => updateToast(id, msg, "success"),
      error: (msg: string) => updateToast(id, msg, "error"),
    };
  }, [updateToast]);

  return (
    <ToastContext.Provider value={{ toast, progressToast }}>
      {children}

      {/* Toast container */}
      <div className="fixed bottom-6 left-1/2 z-[9999] flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [visible, setVisible] = useState(false);
  const prevVariant = useRef(toast.variant);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Auto-dismiss after variant changes from progress to success/error, or for non-progress toasts
  useEffect(() => {
    if (toast.variant === "progress") {
      prevVariant.current = "progress";
      return;
    }

    // If it was progress and now resolved, or it was never progress
    const delay = prevVariant.current === "progress" ? 3000 : 3000;
    prevVariant.current = toast.variant;

    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(toast.id), 200);
    }, delay);

    return () => clearTimeout(timer);
  }, [toast.variant, toast.id, onDismiss]);

  return (
    <div
      className={cn(
        "flex min-w-[220px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border shadow-lg backdrop-blur-sm transition-all duration-200 sm:min-w-[260px]",
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        toast.variant === "error"
          ? "border-red-500/30 bg-red-500/10 text-red-400"
          : toast.variant === "success"
            ? "border-green-500/30 bg-green-500/10 text-green-400"
            : toast.variant === "progress"
              ? "border-border bg-background/95 text-foreground"
              : "border-border bg-background/95 text-foreground",
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3 text-sm">
        {toast.variant === "progress" && (
          <span className="btn-upload-loader shrink-0" />
        )}
        {toast.variant === "success" && (
          <CheckCircle2 size={16} className="shrink-0" />
        )}
        {toast.variant === "error" && (
          <AlertCircle size={16} className="shrink-0" />
        )}
        <span className="flex-1">{toast.message}</span>
        {toast.variant !== "progress" && (
          <button
            onClick={() => {
              setVisible(false);
              setTimeout(() => onDismiss(toast.id), 200);
            }}
            className="shrink-0 text-current opacity-50 transition-opacity hover:opacity-100"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {toast.variant === "progress" && (
        <div className="h-1 w-full bg-foreground/10">
          <div className="h-full animate-progress-bar bg-foreground/40" />
        </div>
      )}
    </div>
  );
}
