import React from 'react';

export default function PrivacyPolicy({ onNavigate }) {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1 className="legal-title">Privacy Policy</h1>
        <p className="legal-updated">Last Updated: October 27, 2025</p>

        <div className="legal-content">
          <section className="legal-section">
            <h2>1. Introduction</h2>
            <p>
              Harvy ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy
              explains how we collect, use, and safeguard information when you use our Bitcoin Ordinals
              tax loss harvesting service ("the Service").
            </p>
            <p>
              <strong>TL;DR:</strong> We don't require accounts, we don't store your wallet data, and we
              don't track you beyond basic analytics. Your privacy is important to us.
            </p>
          </section>

          <section className="legal-section">
            <h2>2. Information We Collect</h2>

            <h3>2.1 Wallet Address (Read-Only)</h3>
            <p>
              When you connect your Bitcoin wallet (e.g., Xverse), we temporarily access your public
              wallet address to fetch your Bitcoin Ordinals holdings. This is read-only access - we
              never request transaction signing permissions or access to your private keys.
            </p>
            <p>
              <strong>What we do NOT collect:</strong>
            </p>
            <ul>
              <li>Private keys or seed phrases</li>
              <li>Transaction signing permissions</li>
              <li>Personal identifying information (name, email, phone, etc.)</li>
              <li>Payment information (we don't process payments currently)</li>
            </ul>

            <h3>2.2 Blockchain Data</h3>
            <p>
              We fetch publicly available blockchain data about your Ordinals from third-party services:
            </p>
            <ul>
              <li><strong>Hiro API:</strong> Ordinal inscription data and metadata</li>
              <li><strong>Magic Eden API:</strong> Purchase history and current market prices</li>
            </ul>
            <p>
              This data is publicly available on the Bitcoin blockchain and is not considered private
              or confidential.
            </p>

            <h3>2.3 Usage Analytics</h3>
            <p>
              We may collect basic, anonymized usage data to improve the Service:
            </p>
            <ul>
              <li>Pages visited</li>
              <li>Time spent on the Service</li>
              <li>Device type and browser information</li>
              <li>General geographic location (country/region, not precise location)</li>
            </ul>
            <p>
              We do not use invasive tracking technologies. We do not sell, rent, or share analytics
              data with third parties for advertising purposes.
            </p>
          </section>

          <section className="legal-section">
            <h2>3. How We Use Your Information</h2>
            <p>We use the collected information solely to:</p>
            <ul>
              <li>Display your Bitcoin Ordinals holdings</li>
              <li>Calculate purchase prices and current market values</li>
              <li>Calculate unrealized gains and losses</li>
              <li>Generate tax loss reports in Form 8949 format</li>
              <li>Improve the Service and fix bugs</li>
              <li>Understand how users interact with the Service</li>
            </ul>
            <p>
              <strong>We do NOT:</strong>
            </p>
            <ul>
              <li>Sell your data to third parties</li>
              <li>Use your data for advertising or marketing</li>
              <li>Share your wallet address with anyone</li>
              <li>Store your wallet data in our databases</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>4. Data Storage and Retention</h2>

            <h3>4.1 No Account Required</h3>
            <p>
              Harvy does not require account creation. You do not provide an email, username, or password.
              When you disconnect your wallet, all session data is cleared.
            </p>

            <h3>4.2 Local Storage Only</h3>
            <p>
              Your wallet connection state is stored only in your browser's local storage. This data
              never leaves your device and is cleared when you:
            </p>
            <ul>
              <li>Disconnect your wallet</li>
              <li>Clear your browser cache</li>
              <li>Close the browser (depending on wallet settings)</li>
            </ul>

            <h3>4.3 Server-Side Caching</h3>
            <p>
              To improve performance and reduce API rate limits, we temporarily cache blockchain data
              fetched from third-party APIs (Hiro, Magic Eden) for up to 5 minutes. This cached data
              is anonymized and not linked to your identity.
            </p>
            <p>
              Cached data is automatically deleted after the cache expires.
            </p>
          </section>

          <section className="legal-section">
            <h2>5. Third-Party Services</h2>
            <p>
              Harvy relies on third-party services to function. These services have their own privacy
              policies:
            </p>

            <h3>5.1 Hiro API</h3>
            <p>
              We fetch Bitcoin Ordinals data from Hiro's public API. When you use Harvy, your wallet
              address is sent to Hiro to retrieve your inscriptions.
            </p>
            <p>
              <a href="https://www.hiro.so/privacy" target="_blank" rel="noopener noreferrer">
                View Hiro's Privacy Policy
              </a>
            </p>

            <h3>5.2 Magic Eden API</h3>
            <p>
              We fetch marketplace data (purchase history, current prices) from Magic Eden's API.
              Your wallet address is sent to Magic Eden to retrieve activity data.
            </p>
            <p>
              <a href="https://magiceden.io/privacy-policy" target="_blank" rel="noopener noreferrer">
                View Magic Eden's Privacy Policy
              </a>
            </p>

            <h3>5.3 Xverse Wallet</h3>
            <p>
              If you use Xverse wallet to connect, Xverse's privacy policy applies to your wallet
              interactions.
            </p>
            <p>
              <a href="https://www.xverse.app/privacy-policy" target="_blank" rel="noopener noreferrer">
                View Xverse's Privacy Policy
              </a>
            </p>
          </section>

          <section className="legal-section">
            <h2>6. Cookies and Tracking</h2>
            <p>
              Harvy uses minimal cookies and tracking:
            </p>

            <h3>6.1 Essential Cookies</h3>
            <p>
              We may use essential cookies to maintain your session and wallet connection state.
              These are necessary for the Service to function.
            </p>

            <h3>6.2 Analytics Cookies</h3>
            <p>
              We may use privacy-focused analytics (e.g., Plausible Analytics) that do not track
              individual users or use invasive cookies.
            </p>

            <h3>6.3 No Advertising Cookies</h3>
            <p>
              We do not use advertising cookies or third-party advertising trackers.
            </p>
          </section>

          <section className="legal-section">
            <h2>7. Data Security</h2>
            <p>
              We implement reasonable security measures to protect the Service:
            </p>
            <ul>
              <li>HTTPS encryption for all connections</li>
              <li>Security headers (CSP, HSTS, etc.) to prevent XSS and other attacks</li>
              <li>Rate limiting to prevent abuse</li>
              <li>Read-only wallet permissions (no transaction signing)</li>
            </ul>
            <p>
              However, no method of transmission over the Internet is 100% secure. You are responsible
              for the security of your wallet and private keys.
            </p>
          </section>

          <section className="legal-section">
            <h2>8. Your Rights and Choices</h2>

            <h3>8.1 Disconnect Your Wallet</h3>
            <p>
              You can disconnect your wallet at any time by clicking the "Disconnect" button in the
              wallet dropdown. This will clear all session data.
            </p>

            <h3>8.2 Clear Browser Data</h3>
            <p>
              You can clear your browser's local storage and cookies to remove all Harvy-related data
              from your device.
            </p>

            <h3>8.3 Opt Out of Analytics</h3>
            <p>
              If we implement analytics in the future, we will provide an opt-out mechanism or use
              privacy-focused analytics that respect Do Not Track (DNT) browser settings.
            </p>
          </section>

          <section className="legal-section">
            <h2>9. Children's Privacy</h2>
            <p>
              Harvy is not intended for use by individuals under the age of 18. We do not knowingly
              collect information from children. If you believe a child has provided us with information,
              please contact us immediately.
            </p>
          </section>

          <section className="legal-section">
            <h2>10. International Users</h2>
            <p>
              Harvy is operated in the United States. If you access the Service from outside the United
              States, your information may be transferred to, stored, and processed in the United States.
            </p>
            <p>
              <strong>Note:</strong> Residents of New York State are prohibited from using this Service.
              See our Terms of Service for details.
            </p>
          </section>

          <section className="legal-section">
            <h2>11. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Changes will be posted on this page
              with an updated "Last Updated" date.
            </p>
            <p>
              Your continued use of the Service after changes are posted constitutes acceptance of the
              updated Privacy Policy.
            </p>
          </section>

          <section className="legal-section">
            <h2>12. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or how we handle your data, please contact us:
            </p>
            <p>
              <strong>Email:</strong> <a href="mailto:hello@harvy.tax">hello@harvy.tax</a>
            </p>
          </section>

          <section className="legal-section">
            <h2>13. Summary</h2>
            <p>
              <strong>In plain English:</strong>
            </p>
            <ul>
              <li>✅ We only read your public wallet address (read-only)</li>
              <li>✅ We don't store your data in databases</li>
              <li>✅ We don't require accounts or emails</li>
              <li>✅ We don't sell your data</li>
              <li>✅ We use minimal, privacy-focused analytics</li>
              <li>✅ You can disconnect anytime</li>
              <li>❌ We never access your private keys</li>
              <li>❌ We never request transaction permissions</li>
              <li>❌ We don't use invasive tracking</li>
            </ul>
          </section>
        </div>

        <div className="legal-back-link">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              if (typeof onNavigate === 'function') {
                onNavigate('home');
              }
            }}
          >
            &larr; Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
