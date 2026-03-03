// frontend/src/App.js
import React, { useState } from 'react';
import './styles.css';

import BitcoinWalletButton from './components/BitcoinWalletButton';
import OrdinalList from './components/OrdinalList';
import Footer from './components/Footer';
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';

export default function App() {
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'ordinals' | 'terms' | 'privacy'
  const [btcAddress, setBtcAddress] = useState('');
  const [connectedWalletType, setConnectedWalletType] = useState(''); // 'xverse' | 'unisat' | 'leather'
  const [btcPublicKey, setBtcPublicKey] = useState('');

  // Simple handler - just update React state
  // No localStorage persistence for security (wallet handles persistence)
  const handleBitcoinConnect = (address, walletType, publicKey) => {
    setBtcAddress(address || '');
    setConnectedWalletType(walletType || '');
    setBtcPublicKey(publicKey || '');
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
        <div className="logo" onClick={() => setActiveTab('home')} style={{ cursor: 'pointer' }}>
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
              <p className="hero-eyebrow">Bitcoin Ordinals Tax Loss Harvesting</p>
              <h1 className="hero-title">Turn Ordinal Losses Into Tax Savings</h1>
              <p className="hero-subtitle">
                Sell your underwater Bitcoin Ordinals to Harvy. Realize capital losses
                to offset gains — instantly, securely, with no counterparty risk.
              </p>

              {!btcAddress ? (
                <div className="cta-box">
                  <p className="cta-text">Connect your wallet to get started</p>
                  <p className="cta-subtext">Xverse, Unisat, and Leather supported. No signup required.</p>
                </div>
              ) : (
                <div className="cta-box connected">
                  <p className="cta-text">Wallet connected</p>
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
              <h2 className="section-label">How it works</h2>
              <div className="steps-list">
                <div className="step-item">
                  <span className="step-num">01</span>
                  <div className="step-text">
                    <h3>Connect your wallet</h3>
                    <p>Link Xverse, Unisat, or Leather to view your Ordinals portfolio.</p>
                  </div>
                </div>
                <div className="step-item">
                  <span className="step-num">02</span>
                  <div className="step-text">
                    <h3>Review your positions</h3>
                    <p>See purchase prices, current values, and unrealized losses at a glance.</p>
                  </div>
                </div>
                <div className="step-item">
                  <span className="step-num">03</span>
                  <div className="step-text">
                    <h3>Harvest your losses</h3>
                    <p>Sell losing Ordinals to Harvy via atomic swap. Receive your tax loss receipt instantly.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="features-section">
              <h2 className="section-label">Why Harvy</h2>
              <div className="features-row">
                <div className="feature-item">
                  <h3>Instant liquidity</h3>
                  <p>No marketplace listings, no waiting for buyers. Sell directly to Harvy in one transaction.</p>
                </div>
                <div className="feature-divider"></div>
                <div className="feature-item">
                  <h3>You keep the savings</h3>
                  <p>Our fee is a small percentage of your realized tax benefit. You keep the majority.</p>
                </div>
                <div className="feature-divider"></div>
                <div className="feature-item">
                  <h3>Non-custodial</h3>
                  <p>Atomic swaps via PSBT. Your keys never leave your wallet. No trust required.</p>
                </div>
              </div>
            </div>

            {/* FAQ */}
            <div className="faq-section">
              <h2 className="section-label">Frequently asked questions</h2>
              <div className="faq-list">
                {[
                  {
                    q: "How does Harvy make money?",
                    a: "We charge a small service fee (5-15%) based on your realized tax savings. You keep the majority of the benefit."
                  },
                  {
                    q: "Is this safe?",
                    a: "Yes. We use atomic swaps (PSBTs) so your private keys never leave your wallet. There is no custody and no counterparty risk."
                  },
                  {
                    q: "Should I use Harvy for every loss?",
                    a: "Not necessarily. If you don't need an on-chain sale footprint for tax or recordkeeping purposes, you can often just consolidate UTXOs and reuse the sats as regular Bitcoin. Harvy is designed for situations where you and your tax advisor want a clear on-chain sale record for underwater Ordinals."
                  },
                  {
                    q: "What wallets are supported?",
                    a: "We currently support Xverse, Unisat, and Leather wallets on Bitcoin mainnet."
                  },
                  {
                    q: "Is this tax or legal advice?",
                    a: "No. Harvy does not provide tax, legal, or accounting advice. We generate on-chain transactions and a detailed receipt, but you are responsible for how you report these transactions. Always consult a qualified tax professional for advice specific to your situation."
                  }
                ].map((item, i) => (
                  <details key={i} className="faq-detail">
                    <summary className="faq-question">{item.q}</summary>
                    <p className="faq-answer">{item.a}</p>
                  </details>
                ))}
              </div>
            </div>

            {/* Final CTA */}
            {!btcAddress && (
              <div className="final-cta">
                <p className="final-cta-text">
                  Connect your wallet to see your Ordinals portfolio and potential tax savings.
                </p>
              </div>
            )}

          </section>
        )}

        {activeTab === 'ordinals' && (
          <section>
            <h2 className="section-title">Bitcoin Ordinals</h2>
            <OrdinalList btcAddress={btcAddress} walletType={connectedWalletType} btcPublicKey={btcPublicKey} />
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
