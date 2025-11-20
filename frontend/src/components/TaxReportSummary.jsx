import React, { useMemo } from 'react';
import {
  prepareForm8949Data,
  generateForm8949CSV,
  calculateTaxSummary,
  downloadCSV,
  generateFilename,
} from '../utils/taxReportGenerator';

/**
 * Tax Report Summary Component
 *
 * Shows users their potential tax losses and allows them to export
 * Form 8949-compatible CSV for their accountant or tax software
 */
export default function TaxReportSummary({ ordinals, activityData, valueData }) {
  // Prepare Form 8949 data
  const reportData = useMemo(() => {
    if (!ordinals || ordinals.length === 0) return [];
    return prepareForm8949Data(ordinals, activityData, valueData);
  }, [ordinals, activityData, valueData]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    return calculateTaxSummary(reportData);
  }, [reportData]);

  // Handle CSV export
  const handleExportCSV = () => {
    const csvContent = generateForm8949CSV(reportData);
    if (!csvContent) {
      alert('No tax loss data available to export.');
      return;
    }

    const filename = generateFilename('harvy-tax-loss-report');
    downloadCSV(csvContent, filename);

    if (process.env.NODE_ENV === 'development') {
      console.log('Tax report exported:', filename);
    }
  };

  // Don't render if no losses found
  if (!reportData || reportData.length === 0) {
    return (
      <div className="tax-summary-empty">
        <div className="tax-summary-icon">📊</div>
        <h3>No Tax Losses Found</h3>
        <p>
          None of your Ordinals currently have unrealized losses.
          Check back later if market conditions change!
        </p>
      </div>
    );
  }

  // Calculate estimated tax savings (assumes 30% tax rate as example)
  const estimatedSavings30 = summary.totalLosses * 0.30;
  const estimatedSavings37 = summary.totalLosses * 0.37; // Top federal rate

  return (
    <div className="tax-report-summary">
      {/* Header */}
      <div className="tax-summary-header">
        <h2 className="tax-summary-title">Your Tax Loss Harvesting Opportunities</h2>
        <p className="tax-summary-subtitle">
          Based on your current Ordinals portfolio, here's your potential tax savings for 2025
        </p>
      </div>

      {/* Main Stats */}
      <div className="tax-stats-grid">
        <div className="tax-stat-card primary">
          <div className="tax-stat-label">Total Unrealized Losses</div>
          <div className="tax-stat-value">
            {summary.totalLosses.toFixed(8)} BTC
          </div>
          <div className="tax-stat-subtext">
            Across {summary.numberOfLosses} Ordinal{summary.numberOfLosses !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="tax-stat-card">
          <div className="tax-stat-label">Short-Term Losses</div>
          <div className="tax-stat-value">
            {summary.totalShortTermLosses.toFixed(8)} BTC
          </div>
          <div className="tax-stat-subtext">Held ≤ 365 days</div>
        </div>

        <div className="tax-stat-card">
          <div className="tax-stat-label">Long-Term Losses</div>
          <div className="tax-stat-value">
            {summary.totalLongTermLosses.toFixed(8)} BTC
          </div>
          <div className="tax-stat-subtext">Held &gt; 365 days</div>
        </div>
      </div>

      {/* Estimated Savings */}
      <div className="tax-savings-estimate">
        <h3>Estimated Tax Savings</h3>
        <p className="tax-savings-description">
          These losses can offset capital gains. Depending on your tax bracket, you could save:
        </p>
        <div className="tax-savings-range">
          <div className="tax-savings-item">
            <span className="tax-savings-label">At 30% tax rate:</span>
            <span className="tax-savings-amount">
              {estimatedSavings30.toFixed(8)} BTC saved
            </span>
          </div>
          <div className="tax-savings-item">
            <span className="tax-savings-label">At 37% tax rate:</span>
            <span className="tax-savings-amount">
              {estimatedSavings37.toFixed(8)} BTC saved
            </span>
          </div>
        </div>
        <p className="tax-savings-disclaimer">
          * Estimates only. Actual savings depend on your total income, other capital gains/losses,
          and applicable tax laws. Consult a tax professional for personalized advice.
        </p>
      </div>

      {/* Export Button */}
      <div className="tax-export-section">
        <button className="tax-export-button" onClick={handleExportCSV}>
          <span className="tax-export-icon">📄</span>
          <span className="tax-export-text">
            <strong>Export Tax Report (CSV)</strong>
            <small>Form 8949 compatible format</small>
          </span>
        </button>
        <p className="tax-export-description">
          Download a CSV file formatted for IRS Form 8949. Share this with your accountant
          or import it into tax software like TurboTax or TaxAct.
        </p>
      </div>

      {/* Information Box */}
      <div className="tax-info-box">
        <h4>What's Included in Your Report:</h4>
        <ul>
          <li>
            <strong>Form 8949 Columns:</strong> Description, date acquired, date disposed,
            proceeds, cost basis, and gain/loss
          </li>
          <li>
            <strong>Holding Periods:</strong> Short-term vs. long-term classification for each asset
          </li>
          <li>
            <strong>Inscription IDs:</strong> Full ordinal identifiers for record-keeping
          </li>
          <li>
            <strong>Sorted by Loss:</strong> Largest losses appear first for easy prioritization
          </li>
        </ul>
        <p className="tax-info-note">
          <strong>Note:</strong> The "Date Disposed" is hypothetical (today's date) for planning purposes.
          Actual losses are only realized when you sell or transfer the ordinals.
        </p>
      </div>

      {/* Deadline Reminder */}
      <div className="tax-deadline-reminder">
        <div className="deadline-icon">⏰</div>
        <div className="deadline-content">
          <h4>Important Deadline</h4>
          <p>
            To offset 2025 capital gains, losses must be <strong>realized by December 31, 2025</strong>.
            Don't wait until the last minute!
          </p>
        </div>
      </div>
    </div>
  );
}
