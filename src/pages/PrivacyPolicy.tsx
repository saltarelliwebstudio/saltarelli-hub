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
          <p className="text-muted-foreground text-sm">
            Last updated: February 8, 2026
          </p>

          <p className="text-muted-foreground leading-relaxed">
            Saltarelli Web Studio ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our client dashboard platform.
          </p>

          {/* Section 1 */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white border-b border-border/30 pb-2">
              1. Information We Collect
            </h2>

            <div className="space-y-4">
              <div>
                <h3 className="text-base font-medium text-white mb-2">Account Information</h3>
                <p className="text-muted-foreground leading-relaxed">
                  When your account is created by an administrator, we collect and store:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-2 ml-2">
                  <li>Full name and email address</li>
                  <li>Company name and contact details</li>
                  <li>Account credentials (passwords are securely hashed)</li>
                  <li>Team member information (if applicable)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-base font-medium text-white mb-2">Voice Call Data</h3>
                <p className="text-muted-foreground leading-relaxed">
                  If voice services are enabled for your account, we process and store:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-2 ml-2">
                  <li>Call recordings and audio files</li>
                  <li>Call transcripts (automatically generated)</li>
                  <li>Call summaries and metadata (duration, timestamps, caller/called numbers)</li>
                  <li>Call status information (completed, missed, failed)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white border-b border-border/30 pb-2">
              2. How We Use Your Information
            </h2>
            <p className="text-muted-foreground leading-relaxed">We use the information we collect to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
              <li>Provide and maintain your dashboard and account access</li>
              <li>Process and display your voice call data, including recordings, transcripts, and summaries</li>
              <li>Generate analytics and statistics about your call activity</li>
              <li>Manage team access and permissions within your workspace</li>
              <li>Send important account notifications (e.g., magic link sign-ins, password resets)</li>
              <li>Improve and optimize our platform and services</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white border-b border-border/30 pb-2">
              3. Third-Party Services
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              We use the following third-party services to operate our platform:
            </p>

            <div className="space-y-4">
              <div className="bg-card/30 border border-border/30 rounded-lg p-4">
                <h3 className="text-base font-medium text-white mb-2">Retell AI</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Retell AI processes voice calls on our behalf. Call recordings, transcripts, and summaries are generated through their platform. Retell AI may store call data on their servers as part of their service. For more information, refer to{' '}
                  <a
                    href="https://www.retellai.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    Retell AI's Privacy Policy
                  </a>.
                </p>
              </div>

              <div className="bg-card/30 border border-border/30 rounded-lg p-4">
                <h3 className="text-base font-medium text-white mb-2">Google Sheets</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  If configured for your account, call log data may be synced to a Google Sheets spreadsheet for your convenience. This is an optional feature and can be enabled or disabled by your administrator. Data shared with Google Sheets is subject to{' '}
                  <a
                    href="https://policies.google.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    Google's Privacy Policy
                  </a>.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white border-b border-border/30 pb-2">
              4. Data Storage and Security
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Your data is stored on secure, cloud-hosted infrastructure. We implement industry-standard security measures including:
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

          {/* Section 5 */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white border-b border-border/30 pb-2">
              5. Data Retention
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your account information for as long as your account is active. Call recordings, transcripts, and summaries are retained in accordance with your service agreement. When your account is deactivated, we will delete or anonymize your data within a reasonable timeframe, unless retention is required by law.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white border-b border-border/30 pb-2">
              6. Your Rights
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

          {/* Section 7 */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white border-b border-border/30 pb-2">
              7. Changes to This Policy
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any significant changes by posting the new policy on this page and updating the "Last updated" date.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white border-b border-border/30 pb-2">
              8. Contact Us
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
            © {new Date().getFullYear()} Saltarelli Web Studio. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
