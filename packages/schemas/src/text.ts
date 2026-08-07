// The plain-text gates shared by every free-text field in every contract
// (storefront text blocks + header, artifact title + description).
//
// ONE definition, deliberately: these previously existed as byte-identical
// copies in storefront-validation.ts and app.ts. Two copies of a security
// regex is how they drift, and drift is exactly what let the artifact
// imageKey gate go missing. Anything needing a text gate imports it here.
//
// Control characters are rejected outright; the multiline variant re-admits
// newline only. Text is ALWAYS rendered as React text nodes, never markup.

/** Shared Zod error for a field that failed a text gate. */
export const TEXT_ERROR = { error: "Text contains unsupported characters." };

/** Any text except control characters; newline permitted. */
export const MULTILINE_TEXT_PATTERN = /^(?:[^\u0000-\u001f\u007f]|\n)*$/;

/** Any text except control characters; newline NOT permitted. */
export const SINGLE_LINE_TEXT_PATTERN = /^[^\u0000-\u001f\u007f]*$/;
