import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Sri Srinivasa Secure Logistics",
  description:
    "Privacy policy for the Sri Srinivasa Secure Logistics (SSLogistics) web operations portal and mobile app.",
};

const EFFECTIVE_DATE = "17 August 2026";
const CONTACT_EMAIL = "srisrinivasasecurelogistics@gmail.com";

export default function PrivacyPolicyPage() {
  return (
    <div className="h-full overflow-y-auto bg-muted/50">
      <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
        <Link
          href="/"
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Back to Home
        </Link>

        <div className="mt-6 bg-card rounded-[var(--modal-radius)] shadow-[var(--card-shadow)] border border-border p-8 md:p-10">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Effective date: {EFFECTIVE_DATE}
          </p>

          <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground">
            <section>
              <p>
                This policy describes how Sri Srinivasa Secure Logistics
                (&ldquo;SSLogistics&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;)
                handles data in the SSLogistics operations portal (web) and the
                SSLogistics mobile app (Android/iOS). Both are internal
                business tools used by our employees, drivers, and authorized
                staff to manage fleet, loan, and logistics operations — they
                are not directed at the general public, and we do not sell or
                use personal data for advertising.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">
                Information we collect
              </h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <span className="font-medium">Account &amp; authentication data</span>
                  {" "}— name, email address, phone number, and role, used to
                  create your account and sign you in. Authentication is
                  handled by Supabase using secure session cookies; we do not
                  store your password.
                </li>
                <li>
                  <span className="font-medium">Operational business data</span>
                  {" "}— vehicles, drivers, trips, loans, fundings, and client
                  records entered by staff in the course of business. This is
                  company operational data, not data collected from your
                  device.
                </li>
                <li>
                  <span className="font-medium">Push notification token</span>
                  {" "}— the mobile app registers a device token with Firebase
                  Cloud Messaging so we can deliver operational alerts (e.g.
                  loan reminders). We do not use this token for advertising.
                </li>
                <li>
                  <span className="font-medium">Crash &amp; diagnostic data</span>
                  {" "}— we use Sentry to capture crash reports and errors. Our
                  configuration disables default PII collection and scrubs
                  cookies, auth headers, and request bodies before sending;
                  only your internal user ID and role are attached, never your
                  name or email.
                </li>
                <li>
                  <span className="font-medium">Basic usage logs</span>
                  {" "}— an internal activity log records actions taken in the
                  portal (e.g. who created or edited a record) for audit
                  purposes.
                </li>
              </ul>
              <p className="mt-3">
                The app does not access your device&rsquo;s location, camera,
                microphone, or contacts.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">
                How we use this information
              </h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>To authenticate you and maintain a secure session.</li>
                <li>
                  To operate core features: fleet, loan, funding, and client
                  management, and related notifications.
                </li>
                <li>To diagnose crashes and fix bugs.</li>
                <li>
                  To maintain an audit trail of who took what action, for
                  security and accountability.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">
                Sharing
              </h2>
              <p>
                We do not sell your data or share it with third parties for
                advertising. We share data only with the service providers
                that host and run the app on our behalf: Supabase (database
                and authentication), Firebase (push notifications), and
                Sentry (crash reporting). Each processes data only as needed
                to provide their service to us.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">
                Data retention
              </h2>
              <p>
                Account and operational data is retained while your account is
                active and as required for our business and legal records.
                Activity log entries are retained for a minimum of 60 days and
                may be purged by an administrator after that.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">
                Security
              </h2>
              <p>
                Sessions use secure, cookie-based authentication with a
                single-active-session policy — signing in on a new device
                signs you out of others. Data is stored in a Postgres database
                with row-level security enabled, and access outside the app is
                restricted to service-role credentials on our servers.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">
                Your choices
              </h2>
              <p>
                To access, correct, or request deletion of your account data,
                or to ask us anything about this policy, contact{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-primary underline underline-offset-2"
                >
                  {CONTACT_EMAIL}
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">
                Children&rsquo;s privacy
              </h2>
              <p>
                This app is a workplace tool for employees, drivers, and
                authorized staff. It is not directed at children, and we do
                not knowingly collect data from anyone under 18.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">
                Changes to this policy
              </h2>
              <p>
                We may update this policy as the app changes. We&rsquo;ll
                update the effective date above when we do.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
