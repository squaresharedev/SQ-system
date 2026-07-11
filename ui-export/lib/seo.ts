import { useEffect } from "react";

interface DocumentMeta {
  /** Browser tab + og:title. */
  title?: string;
  /** og:description + <meta name="description">. */
  description?: string;
  /** og:image. Should be an absolute URL. */
  image?: string;
  /** og:type. Default: website. */
  type?: "website" | "profile" | "article";
  /** canonical URL. Defaults to window.location.href. */
  url?: string;
}

const DEFAULT_TITLE = "SquareShare";
const DEFAULT_DESCRIPTION = "Curate the things you love on a personal grid.";

function setMetaTag(attr: "name" | "property", key: string, value: string | undefined) {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!value) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

function setCanonical(url: string | undefined) {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!url) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", url);
}

/**
 * useDocumentMeta — imperatively sync <title> + open-graph + twitter
 * meta tags for the page that calls it. Resets to sensible defaults
 * when the component unmounts.
 *
 * No external dependency (no react-helmet). Crawlers that execute JS
 * (Google, Twitterbot via JS fallback, modern previewers) will pick
 * the values up; legacy crawlers still see the defaults from
 * `index.html`. For full link-preview support across every chat app
 * we'd later need SSR/prerendering — see AGENTS.md.
 */
export function useDocumentMeta(meta: DocumentMeta) {
  useEffect(() => {
    const previousTitle = document.title;
    const fullTitle = meta.title
      ? `${meta.title} · ${DEFAULT_TITLE}`
      : DEFAULT_TITLE;
    document.title = fullTitle;

    const description = meta.description ?? DEFAULT_DESCRIPTION;
    const url = meta.url ?? (typeof window !== "undefined" ? window.location.href : undefined);

    setMetaTag("name", "description", description);
    setMetaTag("property", "og:title", fullTitle);
    setMetaTag("property", "og:description", description);
    setMetaTag("property", "og:type", meta.type ?? "website");
    setMetaTag("property", "og:url", url);
    setMetaTag("property", "og:image", meta.image);
    setMetaTag("property", "og:site_name", DEFAULT_TITLE);

    setMetaTag("name", "twitter:card", meta.image ? "summary_large_image" : "summary");
    setMetaTag("name", "twitter:title", fullTitle);
    setMetaTag("name", "twitter:description", description);
    setMetaTag("name", "twitter:image", meta.image);

    setCanonical(url);

    return () => {
      document.title = previousTitle;
    };
  }, [meta.title, meta.description, meta.image, meta.type, meta.url]);
}
