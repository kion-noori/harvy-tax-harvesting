import React from 'react';

export default function TermsOfService({ onNavigate }) {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1 className="legal-title">Terms of Service</h1>
        <p className="legal-updated">Last Updated: October 27, 2025</p>

        <div className="legal-content">
          <section className="legal-section">
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or using Harvy ("the Service"), you agree to be bound by these Terms of Service
              ("Terms"). If you do not agree to these Terms, you may not use the Service.
            </p>
            <p>
              Harvy is a tool that helps Bitcoin Ordinals holders identify unrealized losses in their
              portfolios for tax planning purposes. We provide informational services only and do not
              provide tax, legal, or financial advice.
            </p>
          </section>

          <section className="legal-section">
            <h2>2. Geographic Restrictions</h2>
            <p>
              <strong>New York Residents:</strong> This Service is NOT available to residents of New York
              State. By using this Service, you represent and warrant that you are not a resident of
              New York State.
            </p>
            <p>
              If you are found to be a New York resident using this Service, your access will be
              immediately terminated, and we reserve the right to refuse service.
            </p>
          </section>

          <section className="legal-section">
            <h2>3. Description of Service</h2>
            <p>Harvy provides the following features:</p>
            <ul>
              <li>Display of Bitcoin Ordinals held in your connected wallet</li>
              <li>Purchase price information from Magic Eden marketplace activity data</li>
              <li>Current market value estimates from Magic Eden marketplace data</li>
              <li>Calculation of unrealized gains and losses</li>
              <li>Export of tax loss information in IRS Form 8949 compatible format</li>
            </ul>
            <p>
              <strong>Important:</strong> Harvy does NOT execute any transactions on your behalf. We do not
              buy, sell, or transfer any assets. We only provide read-only information about your holdings.
            </p>
          </section>

          <section className="legal-section">
            <h2>4. No Tax, Legal, or Financial Advice</h2>
            <p>
              <strong>Harvy is not a tax advisor, CPA, attorney, or financial advisor.</strong> The
              information provided by the Service is for informational purposes only and should not be
              construed as tax, legal, or financial advice.
            </p>
            <p>
              Every individual's tax situation is unique. You must consult with a qualified tax professional
              before making any tax decisions. We are not responsible for any tax consequences, penalties,
              or liabilities resulting from your use of this Service or reliance on the information provided.
            </p>
          </section>

          <section className="legal-section">
            <h2>5. Data Accuracy and Third-Party Sources</h2>
            <p>
              Harvy aggregates data from third-party sources including Magic Eden, Hiro API, and the
              Bitcoin blockchain. While we strive for accuracy, we do not guarantee:
            </p>
            <ul>
              <li>The accuracy, completeness, or timeliness of third-party data</li>
              <li>That market prices reflect actual realizable value</li>
              <li>That purchase prices are complete or accurate</li>
              <li>That tax calculations are error-free</li>
            </ul>
            <p>
              <strong>You are responsible for verifying all information</strong> before relying on it for
              tax or financial decisions.
            </p>
          </section>

          <section className="legal-section">
            <h2>6. Wallet Connection and Security</h2>
            <p>
              When you connect your Bitcoin wallet (e.g., Xverse), Harvy only requests <strong>read-only
              permissions</strong>. We never request transaction signing permissions or access to your
              private keys.
            </p>
            <p>
              However, you are responsible for:
            </p>
            <ul>
              <li>The security of your wallet and private keys</li>
              <li>Any transactions you authorize through your wallet</li>
              <li>Verifying that you are connecting to the legitimate Harvy website</li>
            </ul>
            <p>
              <strong>Never share your private keys or seed phrase with anyone, including Harvy.</strong>
              We will never ask for this information.
            </p>
          </section>

          <section className="legal-section">
            <h2>7. No Warranties</h2>
            <p>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS
              OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
              PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
            </p>
            <p>
              We do not warrant that:
            </p>
            <ul>
              <li>The Service will be uninterrupted or error-free</li>
              <li>Data will be accurate, complete, or up-to-date</li>
              <li>The Service will meet your specific requirements</li>
              <li>Any errors or bugs will be corrected</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>8. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, HARVY AND ITS OPERATORS SHALL NOT BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO:
            </p>
            <ul>
              <li>Tax penalties or liabilities</li>
              <li>Lost profits or revenue</li>
              <li>Loss of data or information</li>
              <li>Business interruption</li>
              <li>Any other financial losses</li>
            </ul>
            <p>
              Our total liability to you for any claims arising from use of the Service shall not exceed
              the amount you paid to use the Service (if any).
            </p>
          </section>

          <section className="legal-section">
            <h2>9. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless Harvy and its operators from any claims,
              liabilities, damages, losses, or expenses (including legal fees) arising from:
            </p>
            <ul>
              <li>Your use of the Service</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any applicable laws or regulations</li>
              <li>Any tax decisions you make based on information from the Service</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>10. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. Changes will be effective immediately
              upon posting to this page. The "Last Updated" date at the top will reflect the most recent
              changes.
            </p>
            <p>
              Your continued use of the Service after changes are posted constitutes acceptance of the
              modified Terms.
            </p>
          </section>

          <section className="legal-section">
            <h2>11. Termination</h2>
            <p>
              We reserve the right to terminate or suspend your access to the Service at any time, with
              or without cause, and with or without notice.
            </p>
            <p>
              You may stop using the Service at any time by disconnecting your wallet and closing the website.
            </p>
          </section>

          <section className="legal-section">
            <h2>12. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the State of
              New York, without regard to its conflict of law provisions.
            </p>
            <p>
              Any disputes arising from these Terms or use of the Service shall be resolved in the courts
              located in New York, NY.
            </p>
          </section>

          <section className="legal-section">
            <h2>13. Entire Agreement</h2>
            <p>
              These Terms, together with our Privacy Policy, constitute the entire agreement between you
              and Harvy regarding use of the Service.
            </p>
          </section>

          <section className="legal-section">
            <h2>14. Contact Information</h2>
            <p>
              If you have questions about these Terms, please contact us at:
            </p>
            <p>
              <strong>Email:</strong> <a href="mailto:hello@harvy.tax">hello@harvy.tax</a>
            </p>
          </section>

          <section className="legal-section">
            <h2>15. Acknowledgment</h2>
            <p>
              BY USING HARVY, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY
              THESE TERMS OF SERVICE.
            </p>
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
