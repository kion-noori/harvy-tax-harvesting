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
  const [connectedWalletType, setConnectedWalletType] = useState(''); // 'xverse' | 'unisat' | 'leather'

  // Simple handler - just update React state
  // No localStorage persistence for security (wallet handles persistence)
  const handleBitcoinConnect = (address, walletType) => {
    setBtcAddress(address || '');
    setConnectedWalletType(walletType || '');
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
              <h1 className="hero-title">Turn Ordinal Losses Into Tax Savings</h1>
              <p className="hero-subtitle">
                Instantly sell your underwater Bitcoin Ordinals to Harvy before year-end 2025.
                Realize losses to offset capital gains while keeping most of the tax savings.
              </p>

              {!btcAddress ? (
                <div className="cta-box">
                  <p className="cta-text">Connect your Bitcoin wallet to get started →</p>
                  <p className="cta-subtext">Supports Xverse, Unisat, and Leather. No signup required.</p>
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
                  <p>Connect your Bitcoin wallet (Xverse, Unisat, or Leather) to view your Ordinals.</p>
                </div>
                <div className="step-card">
                  <div className="step-number">2</div>
                  <h3>View Portfolio</h3>
                  <p>See your Ordinals with purchase prices, current values, and unrealized losses.</p>
                </div>
                <div className="step-card">
                  <div className="step-number">3</div>
                  <h3>Sell to Harvy</h3>
                  <p>Instantly sell your losing Ordinals to Harvy and harvest tax losses.</p>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="features-section">
              <h2 className="section-heading">Why Harvy?</h2>
              <div className="features-grid">
                <div className="feature-card">
                  <div className="feature-icon">⚡</div>
                  <h3>Instant Liquidity</h3>
                  <p>No need to find buyers or wait for sales. Sell your losing Ordinals instantly to Harvy.</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">💰</div>
                  <h3>Keep the Tax Savings</h3>
                  <p>Realize losses to offset capital gains. Our service fee is a small percentage of your tax savings.</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">🔒</div>
                  <h3>Secure & Trustless</h3>
                  <p>Atomic swaps via PSBT. Your wallet stays in your control. No custody, no risk.</p>
                </div>
              </div>
            </div>

            {/* FAQ Teaser */}
            <div className="faq-teaser">
              <h2 className="section-heading">FAQ</h2>
              <div className="faq-grid">
                <div className="faq-item">
                  <h4>How does Harvy make money?</h4>
                  <p>We charge a small service fee (5-15%) based on your tax savings. You keep the majority of the benefit.</p>
                </div>
                <div className="faq-item">
                  <h4>Is this safe?</h4>
                  <p>Yes. We use atomic swaps (PSBTs). Your private keys never leave your wallet. No custody required.</p>
                </div>
                <div className="faq-item">
                  <h4>What wallets are supported?</h4>
                  <p>Currently supporting Xverse, Unisat, and Leather wallets on Bitcoin testnet and mainnet.</p>
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
            <OrdinalList btcAddress={btcAddress} walletType={connectedWalletType} />
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
