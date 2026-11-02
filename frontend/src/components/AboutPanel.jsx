import React from 'react';

export default function AboutPanel() {
  return (
    <div className="panel about-panel">
      <p className="panel-label">About this workspace</p>
      <h2>Turn transaction history into a planning signal.</h2>
      <p>
        LedgerForecast aggregates sales transactions into a daily time series, identifies unusual activity,
        and projects likely future sales. Use it to support inventory, staffing, and campaign planning—not as
        a substitute for business judgment.
      </p>
    </div>
  );
}
