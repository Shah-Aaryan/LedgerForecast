import React from 'react';

export default function InsightsPanel({ insights }) {
  if (!insights) return null;
  return (
    <div className="panel">
      <p className="panel-label">06 — Decision support</p>
      <div className="insight-summary">
        <strong>{insights.forecastChange >= 0 ? '+' : ''}{insights.forecastChange}%</strong>
        <span>projected average change · {insights.accuracy} historical fit</span>
      </div>
      <div className="insight-grid">
        <div><h3>Alerts</h3>{insights.alerts.length ? insights.alerts.map((alert) => <div className={`alert-card ${alert.level}`} key={alert.title}><b>{alert.title}</b><span>{alert.detail}</span></div>) : <p>No active alerts.</p>}</div>
        <div><h3>Recommendations</h3><ul>{insights.recommendations.map((item) => <li key={item}>{item}</li>)}</ul></div>
      </div>
    </div>
  );
}
