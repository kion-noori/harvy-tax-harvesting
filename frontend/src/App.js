// frontend/src/App.js
import React, { useState } from 'react';
import './styles.css';

import BitcoinWalletButton from './components/BitcoinWalletButton';
import OrdinalList from './components/OrdinalList';
import TestServerConnection from './components/TestServerConnection';
import Footer from './components/Footer';
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';

export default function App() {
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'ordinals' | 'terms' | 'privacy'
  const [btcAddress, setBtcAddress] = useState('');

  // Simple handler - just update React state
  // No localStorage persistence for security (wallet handles persistence)
  const handleBitcoinConnect = (address) => {
    setBtcAddress(address || '');
  };

  // Handle navigation
  const handleNavigation = (tab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="logo">
          <h1 className="gradient-text">Harvy</h1>
        </div>

        <div className="wallet-container">
          {/* IMPORTANT: use onAddressChange (component expects this prop) */}
          <BitcoinWalletButton onAddressChange={handleBitcoinConnect} />
        </div>

        <nav className="nav-tabs">
          <button
            className={`tab-button ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            Home
          </button>
          <button
            className={`tab-button ${activeTab === 'ordinals' ? 'active' : ''}`}
            onClick={() => setActiveTab('ordinals')}
          >
            Ordinals
          </button>
        </nav>
      </header>

      {/* Main */}
      <main className="main-content">
        {activeTab === 'home' && (
          <section className="hero-section">
            {/* Hero */}
            <div className="hero-content">
              <h1 className="hero-title">Turn Ordinal Losses Into Tax Savings</h1>
              <p className="hero-subtitle">
                Identify unrealized losses in your Bitcoin Ordinals portfolio before year-end 2025.
                Harvest losses to offset capital gains and reduce your tax bill.
              </p>

              {!btcAddress ? (
                <div className="cta-box">
                  <p className="cta-text">Connect your Xverse wallet to get started →</p>
                  <p className="cta-subtext">View your portfolio in seconds. No signup required.</p>
                </div>
              ) : (
                <div className="cta-box connected">
                  <p className="cta-text">✓ Wallet Connected</p>
                  <button
                    className="view-ordinals-btn"
                    onClick={() => setActiveTab('ordinals')}
                  >
                    View My Ordinals
                  </button>
                </div>
              )}
            </div>

            {/* How It Works */}
            <div className="how-it-works">
              <h2 className="section-heading">How It Works</h2>
              <div className="steps-grid">
                <div className="step-card">
                  <div className="step-number">1</div>
                  <h3>Connect Wallet</h3>
                  <p>Connect your Xverse Bitcoin wallet securely. We only read data - never request transaction permissions.</p>
                </div>
                <div className="step-card">
                  <div className="step-number">2</div>
                  <h3>View Portfolio</h3>
                  <p>See all your Ordinals with purchase prices, current values, and unrealized gains/losses.</p>
                </div>
                <div className="step-card">
                  <div className="step-number">3</div>
                  <h3>Identify Losses</h3>
                  <p>Instantly spot which Ordinals have unrealized losses that can offset your 2025 capital gains.</p>
                </div>
                <div className="step-card">
                  <div className="step-number">4</div>
                  <h3>Harvest & Save</h3>
                  <p>Generate tax reports and realize losses before December 31st to maximize tax savings.</p>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="features-section">
              <h2 className="section-heading">Why Use Harvy?</h2>
              <div className="features-grid">
                <div className="feature-card">
                  <div className="feature-icon">📊</div>
                  <h3>Real-Time Pricing</h3>
                  <p>Live data from Magic Eden shows current market values vs. your purchase prices.</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">💰</div>
                  <h3>Maximize Savings</h3>
                  <p>Find hidden losses across your entire Ordinals portfolio in one view.</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">🔒</div>
                  <h3>Secure & Private</h3>
                  <p>No account required. We never ask for transaction permissions or private keys.</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">⚡</div>
                  <h3>Built for 2025</h3>
                  <p>Purpose-built for year-end tax planning. Don't leave money on the table.</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">📄</div>
                  <h3>Tax Reports</h3>
                  <p>Export formatted reports for your accountant or tax software.</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">🎯</div>
                  <h3>Simple Pricing</h3>
                  <p>Pay only when you harvest. Fees scale with your tax savings.</p>
                </div>
              </div>
            </div>

            {/* FAQ Teaser */}
            <div className="faq-teaser">
              <h2 className="section-heading">Common Questions</h2>
              <div className="faq-grid">
                <div className="faq-item">
                  <h4>What is tax loss harvesting?</h4>
                  <p>It's selling assets at a loss to offset capital gains and reduce your tax bill. If your Ordinals dropped in value, you can turn that into tax savings.</p>
                </div>
                <div className="faq-item">
                  <h4>When should I harvest losses?</h4>
                  <p>Before December 31, 2025. Losses must be realized in the same tax year as the gains you want to offset.</p>
                </div>
                <div className="faq-item">
                  <h4>Is this safe?</h4>
                  <p>Yes. We only request read permissions from your wallet. We never ask for transaction signing or access to your private keys.</p>
                </div>
                <div className="faq-item">
                  <h4>Do I need an account?</h4>
                  <p>No. Connect your wallet and start viewing your portfolio immediately. No email, no signup.</p>
                </div>
              </div>
            </div>

            {/* Final CTA */}
            {!btcAddress && (
              <div className="final-cta">
                <h2>Ready to maximize your tax savings?</h2>
                <p>Connect your wallet to view your Ordinals portfolio</p>
              </div>
            )}

            {process.env.NODE_ENV === 'development' && (
              <div style={{ marginTop: '3rem', opacity: 0.5 }}>
                <TestServerConnection />
              </div>
            )}
          </section>
        )}

        {activeTab === 'ordinals' && (
          <section>
            <h2 className="section-title">Bitcoin Ordinals</h2>
            <OrdinalList btcAddress={btcAddress} />
          </section>
        )}

        {activeTab === 'terms' && <TermsOfService onNavigate={handleNavigation} />}

        {activeTab === 'privacy' && <PrivacyPolicy onNavigate={handleNavigation} />}
      </main>

      {/* Footer - show on all pages except legal pages (they have their own back links) */}
      {activeTab !== 'terms' && activeTab !== 'privacy' && (
        <Footer onNavigate={handleNavigation} />
      )}
    </div>
  );
}
