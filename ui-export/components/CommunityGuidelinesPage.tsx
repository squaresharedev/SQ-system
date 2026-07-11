import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function CommunityGuidelinesPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-8">
      <Link
        to="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={14} />
        Back
      </Link>

      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Community Guidelines
        </h1>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            The Rules of the Grid
          </h2>
          <p>
            SquareShare is a minimalist digital archive — a place to collect,
            organise, and display the things that matter to you. To keep the
            grid clean and safe for everyone, every item uploaded to SquareShare
            must follow the guidelines below.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            What's Not Allowed
          </h2>
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
          <h2 className="mb-2 text-base font-semibold text-foreground">
            AI Moderation
          </h2>
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
          <h2 className="mb-2 text-base font-semibold text-foreground">
            Hardware Exception
          </h2>
          <p>
            SquareShare is designed to archive physical and digital objects.
            Images of real-world hardware — tools, electronics, mechanical
            parts, collectibles — are always welcome, even if they look unusual.
            The moderation engine is tuned to allow hardware photography.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            Enforcement
          </h2>
          <p>
            Violations may result in content removal or account restriction.
            Repeated or severe violations lead to permanent suspension. If you
            believe a moderation decision was made in error, contact us through
            the Help tab.
          </p>
        </section>
      </div>
    </div>
  );
}
