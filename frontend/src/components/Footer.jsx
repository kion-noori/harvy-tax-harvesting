import React from 'react';

export default function Footer({ onNavigate }) {
  const currentYear = new Date().getFullYear();

  const handleLinkClick = (e, tab) => {
    e.preventDefault();
    if (typeof onNavigate === 'function') {
      onNavigate(tab);
    }
  };

  return (
    <footer className="site-footer">
      <div className="footer-content">
        {/* Brand Section */}
        <div className="footer-section">
          <h3 className="footer-brand">Harvy</h3>
          <p className="footer-tagline">
            Bitcoin Ordinals tax loss harvesting for 2025.
            Maximize your tax savings before year-end.
          </p>
        </div>

        {/* Legal Links */}
        <div className="footer-section">
          <h4 className="footer-heading">Legal</h4>
          <ul className="footer-links">
            <li>
              <a
                href="/terms-of-service"
                className="footer-link"
                onClick={(e) => handleLinkClick(e, 'terms')}
              >
                Terms of Service
              </a>
            </li>
            <li>
              <a
                href="/privacy-policy"
                className="footer-link"
                onClick={(e) => handleLinkClick(e, 'privacy')}
              >
                Privacy Policy
              </a>
            </li>
          </ul>
        </div>

        {/* Resources */}
        <div className="footer-section">
          <h4 className="footer-heading">Resources</h4>
          <ul className="footer-links">
            <li>
              <a
                href="https://www.irs.gov/forms-pubs/about-form-8949"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-link"
              >
                IRS Form 8949
              </a>
            </li>
            <li>
              <a
                href="https://www.irs.gov/forms-pubs/about-schedule-d-form-1040"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-link"
              >
                IRS Schedule D
              </a>
            </li>
          </ul>
        </div>

        {/* Contact */}
        <div className="footer-section">
          <h4 className="footer-heading">Contact</h4>
          <ul className="footer-links">
            <li className="footer-text">
              Questions? Reach out:
            </li>
            <li>
              <a href="mailto:hello@harvy.tax" className="footer-link">
                hello@harvy.tax
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Disclaimers */}
      <div className="footer-disclaimers">
        <div className="footer-disclaimer-box">
          <strong>Tax Disclaimer:</strong> Harvy provides informational tools only and does not provide tax,
          legal, or financial advice. Every tax situation is different. Please consult with a qualified tax
          professional before making any tax decisions. We are not responsible for any tax consequences
          resulting from the use of this service.
        </div>

        <div className="footer-disclaimer-box warning">
          <strong>Geographic Restriction:</strong> This service is not available to residents of New York State
          due to regulatory requirements. By using this service, you confirm you are not a New York resident.
        </div>

        <div className="footer-disclaimer-box">
          <strong>No Guarantees:</strong> Market data and tax loss calculations are estimates based on available
          information. Actual tax benefits may vary. We do not guarantee accuracy of third-party data from
          exchanges or marketplaces.
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="footer-bottom">
        <p className="footer-copyright">
          © {currentYear} Harvy. All rights reserved.
        </p>
        <p className="footer-credit">
          Built with Bitcoin Ordinals in mind
        </p>
      </div>
    </footer>
  );
}
