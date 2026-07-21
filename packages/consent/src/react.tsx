"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  NON_ESSENTIAL_CATEGORIES,
  type ConsentCategory,
  type ConsentRecord,
  type NonEssentialCategory,
} from "./types.js";
import {
  acceptAll,
  configureConsent,
  getConsentRecord,
  needsConsent,
  onConsentChange,
  onOpenSettings,
  rejectAll,
  saveConsent,
} from "./store.js";

// The React banner binding — a thin UI over the framework-agnostic core.
// Non-React surfaces rebuild this exact banner from the replication spec in
// docs/CONSENT_INTEGRATION.md (same markup classes, same rules) on top of
// the same core, so every SquareShare surface shows an identical banner.
//
// Compliance-critical invariants (do not weaken):
// - Layer 1 shows THREE equally prominent actions — Accept all / Reject all /
//   Manage settings — all wearing the SAME .sq-consent-action class. Reject
//   is one click, identical visual weight to Accept.
// - Settings toggles are OFF by default for a first choice (no pre-ticked
//   boxes); Strictly Necessary is rendered always-on and disabled.
// - Escape/dismiss NEVER counts as consent: on layer 1 Escape is a no-op
//   (the banner persists until an explicit choice); on the settings layer it
//   goes back (or closes only when a valid choice already exists).
// - Nothing renders during SSR; the banner mounts client-side after
//   hydration, and hosts gate all non-essential scripts on the core, so
//   nothing non-essential runs before an explicit choice.

export interface ConsentCategoryLabels {
  name: string;
  description: string;
}

export interface ConsentBannerLabels {
  title: string;
  /** 1-2 sentence purpose statement. Shown with the controller identity. */
  description: string;
  cookiePolicyLinkText: string;
  acceptAll: string;
  rejectAll: string;
  manageSettings: string;
  settingsTitle: string;
  settingsDescription: string;
  save: string;
  back: string;
  alwaysOn: string;
  categories: Record<ConsentCategory, ConsentCategoryLabels>;
}

const DEFAULT_CATEGORY_LABELS: Record<ConsentCategory, ConsentCategoryLabels> =
  {
    necessary: {
      name: "Strictly necessary",
      description:
        "Required for the site to work: signing you in, keeping your session across Square Share subdomains, secure checkout and fraud prevention, security, and remembering this consent choice. These cannot be switched off.",
    },
    functional: {
      name: "Functional",
      description:
        "Remembers preferences you set, like theme and layout density, so the site looks the way you left it.",
    },
    analytics: {
      name: "Analytics",
      description:
        "Helps us understand how Square Share is used (pages visited, features used) so we can improve it. Off means we collect no analytics from your device.",
    },
    personalization: {
      name: "Personalization",
      description:
        "Allows your activity on Square Share to tailor what you see, such as recommended items. Off means no personalization based on device tracking.",
    },
  };

function defaultLabels(controllerName: string): ConsentBannerLabels {
  return {
    title: "Cookies on Square Share",
    description: `${controllerName} uses cookies and similar technologies for sign-in, security and payments, and — only with your consent — for analytics and personalization. You can change your choice at any time.`,
    cookiePolicyLinkText: "Cookie Policy",
    acceptAll: "Accept all",
    rejectAll: "Reject all",
    manageSettings: "Manage settings",
    settingsTitle: "Cookie settings",
    settingsDescription:
      "Choose which categories you allow. Strictly necessary items are always on; everything else is off unless you switch it on.",
    save: "Save settings",
    back: "Back",
    alwaysOn: "Always on",
    categories: DEFAULT_CATEGORY_LABELS,
  };
}

// ── Context ─────────────────────────────────────────────────────────────

export interface ConsentContextValue {
  /** The current valid consent record, or null if none yet. */
  record: ConsentRecord | null;
  /** Open the settings layer (same as core openConsentSettings()). */
  openSettings: () => void;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

/** Access the live consent record + settings opener from React. */
export function useConsent(): ConsentContextValue {
  const value = useContext(ConsentContext);
  if (value === null) {
    throw new Error("useConsent must be used inside <ConsentProvider>");
  }
  return value;
}

// ── Provider + banner ───────────────────────────────────────────────────

export interface ConsentProviderProps {
  children?: ReactNode;
  /** Current Cookie Policy / banner version. Bump to re-prompt everyone. */
  policyVersion?: string;
  /** Cookie Domain override (see configureConsent). */
  cookieDomain?: string | null;
  /** Href of the Cookie Policy page (linked from layer 1). */
  cookiePolicyHref: string;
  /** Controller identity shown in the banner text. Pass the legal entity
   *  name once known; defaults to the trade name. */
  controllerName?: string;
  /** Partial label overrides (i18n). Categories merge per-category. */
  labels?: Partial<Omit<ConsentBannerLabels, "categories">> & {
    categories?: Partial<Record<ConsentCategory, ConsentCategoryLabels>>;
  };
}

type BannerLayer = "choices" | "settings";

export function ConsentProvider({
  children,
  policyVersion,
  cookieDomain,
  cookiePolicyHref,
  controllerName = "Square Share",
  labels: labelOverrides,
}: ConsentProviderProps) {
  // Configure the core before the first read below.
  if (policyVersion !== undefined || cookieDomain !== undefined) {
    configureConsent({
      ...(policyVersion !== undefined ? { policyVersion } : {}),
      ...(cookieDomain !== undefined ? { cookieDomain } : {}),
    });
  }

  const [record, setRecord] = useState<ConsentRecord | null>(null);
  const [visible, setVisible] = useState(false);
  const [layer, setLayer] = useState<BannerLayer>("choices");
  const [draft, setDraft] = useState<Record<NonEssentialCategory, boolean>>({
    functional: false,
    analytics: false,
    personalization: false,
  });

  const openSettings = useCallback(() => {
    const current = getConsentRecord();
    // Re-opening shows the user's ACTUAL current state (stored choices);
    // a first-ever prompt shows everything off — never pre-ticked.
    setDraft({
      functional: current?.choices.functional === true,
      analytics: current?.choices.analytics === true,
      personalization: current?.choices.personalization === true,
    });
    setLayer("settings");
    setVisible(true);
  }, []);

  // Mount: read the stored record, show the banner if a choice is needed,
  // and subscribe to core events. All client-side only (SSR renders nothing).
  useEffect(() => {
    setRecord(getConsentRecord());
    if (needsConsent()) {
      setLayer("choices");
      setVisible(true);
    }
    const offChange = onConsentChange((next) => setRecord(next));
    const offOpen = onOpenSettings(openSettings);
    return () => {
      offChange();
      offOpen();
    };
  }, [openSettings]);

  const close = useCallback(() => setVisible(false), []);

  const labels: ConsentBannerLabels = {
    ...defaultLabels(controllerName),
    ...labelOverrides,
    categories: {
      ...DEFAULT_CATEGORY_LABELS,
      ...(labelOverrides?.categories as
        | Record<ConsentCategory, ConsentCategoryLabels>
        | undefined),
    },
  };

  return (
    <ConsentContext.Provider value={{ record, openSettings }}>
      {children}
      {visible ? (
        <ConsentBannerDialog
          layer={layer}
          setLayer={setLayer}
          draft={draft}
          setDraft={setDraft}
          labels={labels}
          cookiePolicyHref={cookiePolicyHref}
          onClose={close}
        />
      ) : null}
    </ConsentContext.Provider>
  );
}

// ── The banner dialog (internal) ────────────────────────────────────────

function ConsentBannerDialog({
  layer,
  setLayer,
  draft,
  setDraft,
  labels,
  cookiePolicyHref,
  onClose,
}: {
  layer: BannerLayer;
  setLayer: (layer: BannerLayer) => void;
  draft: Record<NonEssentialCategory, boolean>;
  setDraft: (draft: Record<NonEssentialCategory, boolean>) => void;
  labels: ConsentBannerLabels;
  cookiePolicyHref: string;
  onClose: () => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Focus management: move focus to the layer title whenever the dialog
  // opens or switches layers, so keyboard/AT users land in context.
  useEffect(() => {
    titleRef.current?.focus();
  }, [layer]);

  // Escape never counts as consent. Settings layer: go back to layer 1 when
  // no valid choice exists yet (the banner must persist), close otherwise.
  // Choices layer: no-op — an explicit button press is the only way out.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    if (layer === "settings") {
      event.stopPropagation();
      if (needsConsent()) setLayer("choices");
      else onClose();
    }
  };

  const choose = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div className="sq-consent" onKeyDown={handleKeyDown}>
      <div
        className="sq-consent-panel"
        role="dialog"
        aria-modal="false"
        aria-labelledby="sq-consent-title"
        aria-describedby="sq-consent-desc"
      >
        {layer === "choices" ? (
          <>
            <h2
              id="sq-consent-title"
              className="sq-consent-title"
              tabIndex={-1}
              ref={titleRef}
            >
              {labels.title}
            </h2>
            <p id="sq-consent-desc" className="sq-consent-text">
              {labels.description}{" "}
              <a className="sq-consent-link" href={cookiePolicyHref}>
                {labels.cookiePolicyLinkText}
              </a>
            </p>
            {/* THREE equally prominent actions — identical class, identical
                weight. Reject all is one click. Do not restyle any of these
                individually. */}
            <div className="sq-consent-actions">
              <button
                type="button"
                className="sq-consent-action"
                onClick={() => choose(acceptAll)}
              >
                {labels.acceptAll}
              </button>
              <button
                type="button"
                className="sq-consent-action"
                onClick={() => choose(rejectAll)}
              >
                {labels.rejectAll}
              </button>
              <button
                type="button"
                className="sq-consent-action"
                onClick={() => setLayer("settings")}
              >
                {labels.manageSettings}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2
              id="sq-consent-title"
              className="sq-consent-title"
              tabIndex={-1}
              ref={titleRef}
            >
              {labels.settingsTitle}
            </h2>
            <p id="sq-consent-desc" className="sq-consent-text">
              {labels.settingsDescription}{" "}
              <a className="sq-consent-link" href={cookiePolicyHref}>
                {labels.cookiePolicyLinkText}
              </a>
            </p>
            <ul className="sq-consent-categories">
              <li className="sq-consent-category">
                <div className="sq-consent-category-info">
                  <span className="sq-consent-category-name">
                    {labels.categories.necessary.name}
                    <span className="sq-consent-badge">{labels.alwaysOn}</span>
                  </span>
                  <span className="sq-consent-category-desc">
                    {labels.categories.necessary.description}
                  </span>
                </div>
                <button
                  type="button"
                  className="sq-consent-switch"
                  role="switch"
                  aria-checked="true"
                  disabled
                  aria-label={labels.categories.necessary.name}
                >
                  <span className="sq-consent-switch-knob" aria-hidden="true" />
                </button>
              </li>
              {NON_ESSENTIAL_CATEGORIES.map((category) => (
                <li className="sq-consent-category" key={category}>
                  <div className="sq-consent-category-info">
                    <span className="sq-consent-category-name">
                      {labels.categories[category].name}
                    </span>
                    <span className="sq-consent-category-desc">
                      {labels.categories[category].description}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="sq-consent-switch"
                    role="switch"
                    aria-checked={draft[category]}
                    aria-label={labels.categories[category].name}
                    onClick={() =>
                      setDraft({ ...draft, [category]: !draft[category] })
                    }
                  >
                    <span
                      className="sq-consent-switch-knob"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ul>
            <div className="sq-consent-actions">
              <button
                type="button"
                className="sq-consent-action"
                onClick={() => choose(() => saveConsent(draft))}
              >
                {labels.save}
              </button>
              <button
                type="button"
                className="sq-consent-back"
                onClick={() => {
                  if (needsConsent()) setLayer("choices");
                  else onClose();
                }}
              >
                {labels.back}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
