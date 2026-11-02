import React from 'react';

const LABELS = {
  moving_average: 'Moving average',
  ses: 'Exponential smoothing',
  holt_linear: "Holt's trend",
  holt_winters: 'Holt-Winters',
  linear_regression: 'Linear regression',
  arima: 'ARIMA',
};

export default function ModelComparison({ result, loading }) {
  if (loading) return <div className="panel"><p className="panel-label">05 — Model comparison</p><div className="loading-state">Comparing forecasting approaches…</div></div>;
  if (!result?.results?.length) return null;
  const valid = result.results.filter((item) => !item.error);
  return (
    <div className="panel">
      <p className="panel-label">05 — Model comparison</p>
      <p className="section-intro">Lower historical error is better. The best fit is highlighted for each metric.</p>
      <div className="comparison-table-wrap">
        <table className="ledger-table comparison-table">
          <thead><tr><th>Model</th><th>MAE</th><th>RMSE</th><th>MAPE</th><th>Next period average</th></tr></thead>
          <tbody>
            {result.results.map((item) => {
              const best = valid.length && item.metrics && item.metrics.mae === Math.min(...valid.map((row) => row.metrics.mae));
              return <tr key={item.method}>
                <td>{LABELS[item.method] || item.method}</td>
                <td className={best ? 'best-value' : ''}>{item.metrics ? `$${item.metrics.mae.toLocaleString()}` : item.error}</td>
                <td>{item.metrics ? `$${item.metrics.rmse.toLocaleString()}` : '—'}</td>
                <td>{item.metrics ? `${item.metrics.mape}%` : '—'}</td>
                <td>{item.forecast ? `$${Math.round(item.forecast.reduce((sum, point) => sum + point.value, 0) / item.forecast.length).toLocaleString()}` : '—'}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
