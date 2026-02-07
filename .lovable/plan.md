

## Privacy Policy Page

### What This Does

Creates a privacy policy page for Saltarelli Web Studio that clearly explains:
- What data is collected (client account information, voice call recordings, transcripts, and summaries)
- How data is processed and stored
- Third-party services involved (Retell AI for call processing, Google Sheets for optional call log sharing)
- User rights and data protection measures
- Contact information for privacy inquiries

The policy will be accessible from two places: a link on the login page and from within the dashboard.

---

### Technical Details

**New File: `src/pages/PrivacyPolicy.tsx`**
- A standalone public page (no login required) at `/privacy`
- Styled to match the existing dark navy design system used on the login page
- Clean, readable typography with proper headings and sections
- Includes a "Back to Login" link for easy navigation
- Sections will cover:
  - Information We Collect (account data, call data)
  - How We Use Your Information
  - Third-Party Services (Retell AI, Google Sheets)
  - Data Storage and Security (hosted on Lovable Cloud infrastructure)
  - Data Retention
  - Your Rights (access, correction, deletion requests)
  - Contact Information (placeholder email for you to fill in)

**Modified File: `src/App.tsx`**
- Add a new public route: `<Route path="/privacy" element={<PrivacyPolicy />} />`

**Modified File: `src/pages/Login.tsx`**
- Add a "Privacy Policy" link in the footer text at the bottom of the login page (next to the copyright line)

**Modified File: `src/components/layout/DashboardLayout.tsx`**
- Add a small footer link to "/privacy" at the bottom of the main content area, so logged-in users can access the policy from within the dashboard

### Notes
- The privacy policy text will be hardcoded in the component (no database needed)
- You can edit the text directly in the file after it is created to customize wording, add your contact email, or adjust any section
- The page is publicly accessible so search engines and users can reach it without logging in

