function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function filterDateRange(daily, startDate, endDate) {
  return daily.filter((point) => (!startDate || point.date >= startDate) && (!endDate || point.date <= endDate));
}

function detectAnomalies(daily, window = 7, threshold = 2.5) {
  const anomalies = daily.map((point, index) => {
    const history = daily.slice(Math.max(0, index - window), index).map((item) => item.sales);
    if (history.length < 3) return null;

    const mean = history.reduce((sum, value) => sum + value, 0) / history.length;
    const variance = history.reduce((sum, value) => sum + (value - mean) ** 2, 0) / history.length;
    const standardDeviation = Math.sqrt(variance);
    const zScore = standardDeviation === 0 ? 0 : (point.sales - mean) / standardDeviation;

    if (Math.abs(zScore) < threshold) return null;
    return {
      date: point.date,
      sales: point.sales,
      expected: round(mean),
      deviation: round(point.sales - mean),
      zScore: round(zScore),
      type: zScore > 0 ? 'spike' : 'drop',
    };
  }).filter(Boolean);

  return {
    anomalies,
    count: anomalies.length,
    spikes: anomalies.filter((item) => item.type === 'spike').length,
    drops: anomalies.filter((item) => item.type === 'drop').length,
    threshold,
    window,
  };
}

function buildInsights(daily, forecast, anomalyResult) {
  const historicalAverage = daily.length ? daily.reduce((sum, point) => sum + point.sales, 0) / daily.length : 0;
  const forecastAverage = forecast.length ? forecast.reduce((sum, point) => sum + point.value, 0) / forecast.length : 0;
  const forecastChange = historicalAverage ? ((forecastAverage - historicalAverage) / historicalAverage) * 100 : 0;
  const alerts = [];
  const recommendations = [];

  if (anomalyResult.count > 0) {
    alerts.push({
      level: anomalyResult.count >= 5 ? 'high' : 'medium',
      title: `${anomalyResult.count} unusual sales day${anomalyResult.count === 1 ? '' : 's'} detected`,
      detail: `${anomalyResult.spikes} spike${anomalyResult.spikes === 1 ? '' : 's'} and ${anomalyResult.drops} drop${anomalyResult.drops === 1 ? '' : 's'} exceed the rolling baseline.`,
    });
    recommendations.push('Review promotions, stock availability, pricing, and one-off transactions around the flagged dates.');
  }

  if (forecastChange >= 10) {
    alerts.push({ level: 'positive', title: 'Forecast indicates growth', detail: `Projected average sales are ${round(forecastChange)}% above the selected historical period.` });
    recommendations.push('Prepare inventory and staffing for the projected increase in demand.');
  } else if (forecastChange <= -10) {
    alerts.push({ level: 'high', title: 'Forecast indicates a decline', detail: `Projected average sales are ${Math.abs(round(forecastChange))}% below the selected historical period.` });
    recommendations.push('Investigate declining demand and consider targeted pricing or marketing actions.');
  } else {
    recommendations.push('Use the forecast as a planning baseline and monitor actual sales as new data becomes available.');
  }

  const mape = forecast.metrics?.mape;
  const accuracy = mape == null ? 'unavailable' : mape < 10 ? 'strong' : mape < 20 ? 'moderate' : 'limited';
  return {
    forecastChange: round(forecastChange),
    historicalAverage: round(historicalAverage),
    forecastAverage: round(forecastAverage),
    accuracy,
    alerts,
    recommendations,
  };
}

module.exports = { filterDateRange, detectAnomalies, buildInsights, round };
