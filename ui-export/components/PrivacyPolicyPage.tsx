import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function PrivacyPolicyPage() {
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
          Privacy Policy
        </h1>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            Data &amp; Trust
          </h2>
          <p>
            SquareShare stores the minimum data needed to run the service:
            your email address, username, profile picture, and the artifacts
            you upload. All data is stored in a secured Supabase-hosted
            PostgreSQL database and Supabase Storage.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            AI Processing
          </h2>
          <p>
            Uploaded images are sent to Google Gemini exclusively for content
            moderation — to verify they comply with our Community Guidelines.
            Gemini does not retain your images after analysis, and no image data
            is used for model training. No other AI service processes your
            content.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            Intellectual Property
          </h2>
          <p>
            You retain full ownership of every artifact you upload. SquareShare
            does not claim any rights over your content. We do not sell, license,
            or share your uploads with third parties.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            Public vs. Private
          </h2>
          <p>
            All collections and artifacts are <strong>private by default</strong>.
            Only you can see your grid unless you explicitly choose to share it.
            We will never change your visibility settings without your consent.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            Authentication
          </h2>
          <p>
            SquareShare uses Firebase Authentication. We never see or store your
            password — authentication tokens are managed entirely by Firebase.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            Data Deletion
          </h2>
          <p>
            You can delete individual artifacts or entire collections at any
            time. If you wish to delete your account and all associated data,
            contact us through the Help tab.
          </p>
        </section>
      </div>
    </div>
  );
}
