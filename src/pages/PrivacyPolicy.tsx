import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import logo from '@/assets/logo.png';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen gradient-navy">
      {/* Header */}
      <header className="border-b border-border/30">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Saltarelli Web Studio" className="h-10 w-10" />
            <span className="font-semibold text-white">Saltarelli Web Studio</span>
          </div>
          <Link
            to="/login"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-accent transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-8 w-8 text-accent" />
          <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
        </div>

        <div className="prose prose-invert max-w-none space-y-8">
          <div className="space-y-1">
            <p className="text-muted-foreground text-sm">
              <strong className="text-white">Effective Date:</strong> February 10, 2026
            </p>
            <p className="text-muted-foreground text-sm">
              <strong className="text-white">Last Updated:</strong> February 10, 2026
            </p>
          </div>

          <p className="text-muted-foreground leading-relaxed">
            Saltarelli Web Studio ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our services, including but not limited to our client dashboard platform, websites, AI voice agents, and business automation tools.
          </p>

          {/* Section 1 */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white border-b border-border/30 pb-2">
              1. Information We Collect
            </h2>

            <div className="space-y-4">
              <div>
                <h3 className="text-base font-medium text-white mb-2">Account & Contact Information</h3>
                <p className="text-muted-foreground leading-relaxed">
                  When your account is created or you engage our services, we may collect and store:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-2 ml-2">
                  <li>Full name, email address, and phone number</li>
                  <li>Business name, address, and contact details</li>
                  <li>Account credentials (passwords are securely hashed)</li>
                  <li>Team member information (if applicable)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-base font-medium text-white mb-2">Voice Call & Communication Data</h3>
                <p className="text-muted-foreground leading-relaxed">
                  If voice agent or communication services are enabled for your account, we may process and store:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-2 ml-2">
                  <li>Call recordings and audio files</li>
                  <li>Call transcripts (automatically generated)</li>
                  <li>Call summaries, metadata (duration, timestamps, caller/called numbers)</li>
                  <li>SMS/text message logs</li>
                  <li>Call status information (completed, missed, failed)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-base font-medium text-white mb-2">Business & Automation Data</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Through our automation and business services, we may collect:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-2 ml-2">
                  <li>Lead information (names, phone numbers, emails, inquiry details)</li>
                  <li>Booking and scheduling data</li>
                  <li>Workflow and automation event logs</li>
                  <li>Website analytics data (page views, visitor counts, traffic sources)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-base font-medium text-white mb-2">Support & Chat Data</h3>
                <p className="text-muted-foreground leading-relaxed">
                  When you interact with our support systems, we may store:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-2 ml-2">
                  <li>Support request subjects and messages</li>
                  <li>AI chat conversation logs</li>
                  <li>Any files or information you share during support interactions</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white border-b border-border/30 pb-2">
              2. Services We Provide
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              This Privacy Policy covers data collected through all of our services, including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
              <li>Custom websites designed and hosted on your behalf</li>
              <li>AI voice agents for inbound and outbound calls</li>
              <li>Business automations (lead capture, booking systems, SMS workflows)</li>
              <li>Client dashboard platform for monitoring and managing your services</li>
              <li>AI-powered support chat</li>
              <li>Analytics and reporting dashboards</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white border-b border-border/30 pb-2">
              3. How We Use Your Information
            </h2>
            <p className="text-muted-foreground leading-relaxed">We use the information we collect to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
              <li>Provide and maintain your dashboard, websites, and account access</li>
              <li>Process and display your voice call data, including recordings, transcripts, and summaries</li>
              <li>Run business automations and workflows on your behalf</li>
              <li>Generate analytics and statistics about your call activity, website traffic, and automations</li>
              <li>Manage team access and permissions within your workspace</li>
              <li>Provide AI-powered support and assistance</li>
              <li>Send important account notifications (e.g., sign-in links, password resets)</li>
              <li>Improve and optimize our platform and services</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white border-b border-border/30 pb-2">
              4. Third-Party Services
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              We use the following third-party services to operate our platform. Each service may store or process data in accordance with their own privacy policies:
            </p>

            <div className="space-y-4">
              <div className="bg-card/30 border border-border/30 rounded-lg p-4">
                <h3 className="text-base font-medium text-white mb-2">Retell AI</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Processes voice calls on our behalf. Call recordings, transcripts, and summaries are generated through their platform.{' '}
                  <a href="https://www.retellai.com/privacy" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    Retell AI Privacy Policy
                  </a>
                </p>
              </div>

              <div className="bg-card/30 border border-border/30 rounded-lg p-4">
                <h3 className="text-base font-medium text-white mb-2">Twilio</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Provides telephony infrastructure for voice and SMS services. Phone numbers and call/message data may be processed through Twilio's platform.{' '}
                  <a href="https://www.twilio.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    Twilio Privacy Policy
                  </a>
                </p>
              </div>

              <div className="bg-card/30 border border-border/30 rounded-lg p-4">
                <h3 className="text-base font-medium text-white mb-2">Stripe</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Handles payment processing and billing. Payment information is processed directly by Stripe and is not stored on our servers.{' '}
                  <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    Stripe Privacy Policy
                  </a>
                </p>
              </div>

              <div className="bg-card/30 border border-border/30 rounded-lg p-4">
                <h3 className="text-base font-medium text-white mb-2">Google Sheets</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  If configured for your account, call log and lead data may be synced to Google Sheets for your convenience.{' '}
                  <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    Google Privacy Policy
                  </a>
                </p>
              </div>

              <div className="bg-card/30 border border-border/30 rounded-lg p-4">
                <h3 className="text-base font-medium text-white mb-2">Vercel</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Hosts our dashboard platform and client websites. May collect basic analytics and access logs.{' '}
                  <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    Vercel Privacy Policy
                  </a>
                </p>
              </div>

              <div className="bg-card/30 border border-border/30 rounded-lg p-4">
                <h3 className="text-base font-medium text-white mb-2">Modal.com</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Used for running serverless compute workloads, including automation processing and AI tasks.
                </p>
              </div>

              <div className="bg-card/30 border border-border/30 rounded-lg p-4">
                <h3 className="text-base font-medium text-white mb-2">GitHub</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Used for source code management and deployment workflows. No client data is stored in repositories.
                </p>
              </div>
            </div>
          </section>

          {/* Section 5 */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white border-b border-border/30 pb-2">
              5. Data Storage and Security
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Your data is stored across secure, cloud-hosted infrastructure, including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
              <li><strong className="text-white">Supabase</strong> — Primary database and authentication</li>
              <li><strong className="text-white">Google Sheets</strong> — Optional data sync for call logs and leads</li>
              <li><strong className="text-white">Retell AI servers</strong> — Call recordings and transcripts</li>
              <li><strong className="text-white">Twilio</strong> — Telephony and messaging data</li>
              <li><strong className="text-white">Vercel</strong> — Application hosting and deployment</li>
              <li><strong className="text-white">GitHub</strong> — Source code (no client data)</li>
              <li><strong className="text-white">Modal.com</strong> — Serverless compute processing</li>
            </ul>

            <p className="text-muted-foreground leading-relaxed mt-4">
              We implement industry-standard security measures including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
              <li>Encrypted data transmission (HTTPS/TLS)</li>
              <li>Secure password hashing</li>
              <li>Row-level security policies to ensure data isolation between client accounts</li>
              <li>Role-based access controls</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              While we strive to protect your information, no method of electronic transmission or storage is 100% secure. We cannot guarantee absolute security.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white border-b border-border/30 pb-2">
              6. Cookies
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Our platform uses cookies strictly for authentication and session management purposes. Specifically, we use Supabase authentication session cookies to keep you signed in to your account. We do not use advertising or tracking cookies.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white border-b border-border/30 pb-2">
              7. Data Retention
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your account information and associated data for the duration of your active service agreement, plus a reasonable period afterward. Call recordings, transcripts, summaries, and automation logs are retained in accordance with your service agreement.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              When your account is deactivated or your service agreement ends, we will delete or anonymize your data within a reasonable timeframe, unless retention is required by law. To request early deletion of your data, please contact us via email at{' '}
              <a href="mailto:saltarelliwebstudio@gmail.com" className="text-accent hover:underline">
                saltarelliwebstudio@gmail.com
              </a>.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white border-b border-border/30 pb-2">
              8. Your Rights
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Depending on your jurisdiction, you may have the right to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict processing of your data</li>
              <li>Request a copy of your data in a portable format</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              To exercise any of these rights, please contact us using the information below.
            </p>
          </section>

          {/* Section 9 */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white border-b border-border/30 pb-2">
              9. Changes to This Policy
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any significant changes by posting the new policy on this page and updating the "Last Updated" date.
            </p>
          </section>

          {/* Section 10 */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white border-b border-border/30 pb-2">
              10. Contact Us
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <div className="bg-card/30 border border-border/30 rounded-lg p-4">
              <p className="text-white font-medium">Saltarelli Web Studio</p>
              <p className="text-muted-foreground text-sm mt-1">
                Email:{' '}
                <a href="mailto:saltarelliwebstudio@gmail.com" className="text-accent hover:underline">
                  saltarelliwebstudio@gmail.com
                </a>
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                Phone:{' '}
                <a href="tel:+12899314142" className="text-accent hover:underline">
                  289-931-4142
                </a>
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Saltarelli Web Studio. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
