/**
 * Tax Report Generator for Bitcoin Ordinals (Form 8949 Compatible)
 *
 * Generates CSV reports suitable for IRS Form 8949 - Sales and Other Dispositions of Capital Assets
 * https://www.irs.gov/forms-pubs/about-form-8949
 */

/**
 * Format date as MM/DD/YYYY for IRS forms
 */
function formatIRSDate(timestamp) {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Format BTC amount to 8 decimal places (satoshi precision)
 */
function formatBTC(value) {
  if (value === null || value === undefined) return '0.00000000';
  return Number(value).toFixed(8);
}

/**
 * Calculate holding period in days
 */
function calculateHoldingPeriod(acquiredDate, disposedDate) {
  if (!acquiredDate || !disposedDate) return 'Unknown';
  const acquired = new Date(acquiredDate);
  const disposed = new Date(disposedDate);
  const diffTime = Math.abs(disposed - acquired);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Determine if holding period is short-term or long-term
 * Short-term: <= 365 days
 * Long-term: > 365 days
 */
function getHoldingPeriodType(acquiredDate, disposedDate) {
  const days = calculateHoldingPeriod(acquiredDate, disposedDate);
  if (days === 'Unknown') return 'Unknown';
  return days > 365 ? 'Long-term' : 'Short-term';
}

/**
 * Prepare ordinal data for Form 8949
 *
 * Form 8949 requires:
 * - (a) Description of property
 * - (b) Date acquired
 * - (c) Date sold or disposed
 * - (d) Proceeds (sales price)
 * - (e) Cost or other basis
 * - (f) Code(s) from instructions (if any)
 * - (g) Amount of adjustment (if any)
 * - (h) Gain or (loss)
 */
export function prepareForm8949Data(ordinals, activityData, valueData) {
  const reportData = [];

  ordinals.forEach((ordinal) => {
    const activity = activityData?.[ordinal.id];
    const value = valueData?.[ordinal.id];

    // Only include ordinals with both purchase price and current value
    const purchasePrice = activity?.lastPurchasePrice;
    const hasPurchasePrice = purchasePrice !== null && purchasePrice !== undefined;

    const currentPrice = value?.currentPrice || value?.floorPrice;
    const hasCurrentPrice = currentPrice !== null && currentPrice !== undefined;

    if (!hasPurchasePrice || !hasCurrentPrice) {
      return; // Skip if we don't have complete data
    }

    const gainLoss = currentPrice - purchasePrice;

    // Only include losses (negative gain/loss)
    if (gainLoss >= 0) {
      return; // Skip gains - we're focused on tax loss harvesting
    }

    const acquiredDate = activity?.lastPurchaseDate;
    const disposedDate = new Date().toISOString(); // Hypothetical disposal date (today)
    const holdingPeriodType = getHoldingPeriodType(acquiredDate, disposedDate);

    reportData.push({
      // Column A: Description of property
      description: `Bitcoin Ordinal ${ordinal.id.substring(0, 8)}...`,
      fullInscriptionId: ordinal.id,

      // Column B: Date acquired
      dateAcquired: formatIRSDate(acquiredDate),
      dateAcquiredRaw: acquiredDate,

      // Column C: Date sold or disposed (hypothetical - for planning purposes)
      dateDisposed: formatIRSDate(disposedDate),
      dateDisposedRaw: disposedDate,

      // Column D: Proceeds (sales price)
      proceeds: formatBTC(currentPrice),
      proceedsRaw: currentPrice,

      // Column E: Cost or other basis
      costBasis: formatBTC(purchasePrice),
      costBasisRaw: purchasePrice,

      // Column F: Code(s) - leave blank for standard transactions
      adjustmentCode: '',

      // Column G: Amount of adjustment - leave blank
      adjustmentAmount: '',

      // Column H: Gain or (loss)
      gainLoss: formatBTC(gainLoss),
      gainLossRaw: gainLoss,

      // Additional helpful information (not on Form 8949)
      holdingPeriodDays: calculateHoldingPeriod(acquiredDate, disposedDate),
      holdingPeriodType: holdingPeriodType,
      collectionId: value?.collectionId || 'Unknown',
      isListed: value?.isListed || false,
    });
  });

  // Sort by largest losses first
  reportData.sort((a, b) => a.gainLossRaw - b.gainLossRaw);

  return reportData;
}

/**
 * Generate CSV content for Form 8949
 */
export function generateForm8949CSV(reportData) {
  if (!reportData || reportData.length === 0) {
    return null;
  }

  // CSV Header (Form 8949 columns)
  const headers = [
    '(a) Description of property',
    '(b) Date acquired',
    '(c) Date sold or disposed',
    '(d) Proceeds',
    '(e) Cost or other basis',
    '(f) Code(s)',
    '(g) Amount of adjustment',
    '(h) Gain or (loss)',
    'Holding Period Type',
    'Holding Period (Days)',
    'Inscription ID'
  ];

  // Build CSV rows
  const rows = reportData.map(item => [
    `"${item.description}"`,
    item.dateAcquired,
    item.dateDisposed,
    item.proceeds,
    item.costBasis,
    item.adjustmentCode,
    item.adjustmentAmount,
    item.gainLoss,
    item.holdingPeriodType,
    item.holdingPeriodDays,
    `"${item.fullInscriptionId}"`
  ]);

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  return csvContent;
}

/**
 * Calculate total losses and statistics
 */
export function calculateTaxSummary(reportData) {
  if (!reportData || reportData.length === 0) {
    return {
      totalLosses: 0,
      totalShortTermLosses: 0,
      totalLongTermLosses: 0,
      numberOfLosses: 0,
      averageLoss: 0,
    };
  }

  const shortTermLosses = reportData
    .filter(item => item.holdingPeriodType === 'Short-term')
    .reduce((sum, item) => sum + Math.abs(item.gainLossRaw), 0);

  const longTermLosses = reportData
    .filter(item => item.holdingPeriodType === 'Long-term')
    .reduce((sum, item) => sum + Math.abs(item.gainLossRaw), 0);

  const totalLosses = shortTermLosses + longTermLosses;
  const numberOfLosses = reportData.length;
  const averageLoss = numberOfLosses > 0 ? totalLosses / numberOfLosses : 0;

  return {
    totalLosses,
    totalShortTermLosses: shortTermLosses,
    totalLongTermLosses: longTermLosses,
    numberOfLosses,
    averageLoss,
  };
}

/**
 * Download CSV file
 */
export function downloadCSV(csvContent, filename = 'harvy-tax-report.csv') {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Generate filename with current date
 */
export function generateFilename(prefix = 'harvy-tax-report') {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${prefix}-${year}-${month}-${day}.csv`;
}
