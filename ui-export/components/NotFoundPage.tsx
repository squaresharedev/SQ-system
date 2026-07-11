import { useNavigate } from "react-router-dom";
import { useDocumentMeta } from "@/lib/seo";

interface NotFoundPageProps {
  /** Optional custom message (e.g. "Collection not found"). */
  message?: string;
}

export function NotFoundPage({ message }: NotFoundPageProps) {
  const navigate = useNavigate();
  useDocumentMeta({
    title: "Not found",
    description: "The page you're looking for doesn't exist.",
  });

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="font-mono text-6xl font-medium tracking-tight">404</div>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-medium tracking-tight">
          {message ?? "We couldn't find that page"}
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The link may be broken, or the page may have been moved.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => navigate(-1)}
          className="rounded-[--radius-card] border border-border px-4 py-2 text-sm transition-colors hover:bg-muted"
        >
          Go back
        </button>
        <button
          onClick={() => navigate("/")}
          className="rounded-[--radius-card] bg-foreground px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          Go home
        </button>
      </div>
    </div>
  );
}
