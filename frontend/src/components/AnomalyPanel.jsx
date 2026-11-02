import React from 'react';

export default function AnomalyPanel({ result }) {
  if (!result) return null;
  return (
    <div className="panel">
      <p className="panel-label">04 — Anomaly watch</p>
      {result.count === 0 ? (
        <p className="status-message positive-text">No unusual days detected in the selected range.</p>
      ) : (
        <>
          <p className="status-message">
            {result.count} unusual day{result.count === 1 ? '' : 's'} detected using a {result.window}-day rolling baseline.
          </p>
          <div className="anomaly-list">
            {result.anomalies.slice(-8).reverse().map((item) => (
              <div className={`anomaly-item ${item.type}`} key={item.date}>
                <b>{item.date}</b>
                <span>{item.type === 'spike' ? 'Spike' : 'Drop'} · ${item.sales.toLocaleString()}</span>
                <small>Expected ${item.expected.toLocaleString()} · z-score {item.zScore}</small>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
