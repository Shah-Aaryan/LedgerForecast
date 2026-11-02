import React, { useEffect, useState, useCallback } from 'react';
import UploadPanel from './components/UploadPanel.jsx';
import StatsCards from './components/StatsCards.jsx';
import ControlsPanel from './components/ControlsPanel.jsx';
import ForecastChart from './components/ForecastChart.jsx';
import LedgerTable from './components/LedgerTable.jsx';
import AboutPanel from './components/AboutPanel.jsx';
import AnomalyPanel from './components/AnomalyPanel.jsx';
import ModelComparison from './components/ModelComparison.jsx';
import InsightsPanel from './components/InsightsPanel.jsx';
import { getMeta, getStats, getAnomalies, runForecast, compareForecasts, getInsights } from './api';

const DEFAULT_PARAMS = {
  method: 'holt_winters',
  horizon: 30,
  seasonLength: 7,
  category: 'All',
  region: 'All',
  startDate: '',
  endDate: '',
};

export default function App() {
  const [meta, setMeta] = useState(null);
  const [stats, setStats] = useState(null);
  const [forecastResult, setForecastResult] = useState(null);
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [anomalies, setAnomalies] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [insights, setInsights] = useState(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  const loadEverything = useCallback(async (currentParams) => {
    setLoading(true);
    setError(null);
    try {
      const metaData = await getMeta();
      setMeta(metaData);

      const filterParams = {
        category: currentParams.category !== 'All' ? currentParams.category : undefined,
        region: currentParams.region !== 'All' ? currentParams.region : undefined,
        startDate: currentParams.startDate || undefined,
        endDate: currentParams.endDate || undefined,
      };
      const [statsData, forecastData, anomalyData, insightData] = await Promise.all([
        getStats(filterParams),
        runForecast({ ...currentParams, ...filterParams }),
        getAnomalies(filterParams),
        getInsights({ ...currentParams, ...filterParams }),
      ]);
      setStats(statsData);
      setForecastResult(forecastData);
      setAnomalies(anomalyData);
      setInsights(insightData);
      setComparisonLoading(true);
      compareForecasts({ ...currentParams, ...filterParams })
        .then(setComparison)
        .catch(() => setComparison(null))
        .finally(() => setComparisonLoading(false));
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong talking to the API.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEverything(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleParamsChange = (newParams) => {
    setParams(newParams);
    loadEverything(newParams);
  };

  const handleDatasetChange = (result) => {
    const freshParams = { ...DEFAULT_PARAMS };
    setParams(freshParams);
    setMeta({
      sourceName: result.sourceName,
      rowCount: result.rowCount,
      categories: result.categories,
      regions: result.regions,
    });
    loadEverything(freshParams);
  };

  return (
    <div className="app">
      <header className="masthead">
        <div>
          <h1 className="masthead-title">
            Ledger<span className="mark">.</span>Forecast
          </h1>
          <div className="masthead-sub">Daily sales forecasting</div>
        </div>
        <div className="masthead-meta">
          {meta?.dateRange ? (
            <>
              Book covers <strong>{meta.dateRange.start}</strong> → <strong>{meta.dateRange.end}</strong>
              <br />
              {meta.rowCount?.toLocaleString()} transactions on record
            </>
          ) : (
            <>No ledger loaded yet</>
          )}
        </div>
      </header>

      <UploadPanel meta={meta} onDatasetChange={handleDatasetChange} />
      <AboutPanel />

      {error && <div className="error-banner" style={{ marginBottom: 20 }}>{error}</div>}

      <StatsCards stats={stats} />

      <ControlsPanel
        params={params}
        onChange={handleParamsChange}
        categories={meta?.categories}
        regions={meta?.regions}
        dateRange={meta?.dateRange}
      />

      <div className="panel">
        <p className="panel-label">Sales trend & projection</p>
        {loading && !forecastResult ? (
          <div className="loading-state">Reading the ledger…</div>
        ) : (
          forecastResult && <ForecastChart historical={forecastResult.historical} forecast={forecastResult.forecast} />
        )}
      </div>

      {forecastResult && (
        <LedgerTable forecast={forecastResult.forecast} metrics={forecastResult.metrics} modelInfo={forecastResult.modelInfo} />
      )}

      <AnomalyPanel result={anomalies} />
      <ModelComparison result={comparison} loading={comparisonLoading} />
      <InsightsPanel insights={insights} />
    </div>
  );
}
