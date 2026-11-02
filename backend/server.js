const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const { processCsv, aggregateDaily } = require('./utils/csvProcessor');
const { runForecast, METHODS } = require('./utils/forecasting');
const { filterDateRange, detectAnomalies, buildInsights, round } = require('./utils/analytics');

const app = express();
const PORT = process.env.PORT || 5000;
const ARIMA_SERVICE_URL = process.env.ARIMA_SERVICE_URL || 'http://localhost:8001';

app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.csv')) {
      return cb(new Error('Only .csv files are supported'));
    }
    cb(null, true);
  },
});

// In-memory dataset store (single-user demo app)
let currentDataset = null; // { rows, detectedColumns, categories, regions, sourceName }

function loadSample() {
  const csvPath = path.join(__dirname, 'data', 'sample_sales.csv');
  const csvText = fs.readFileSync(csvPath, 'utf-8');
  const parsed = processCsv(csvText);
  currentDataset = { ...parsed, sourceName: 'Sample Superstore-style dataset (bundled)' };
}
loadSample(); // load on boot so the app is usable immediately

// --- Routes ---

app.get('/api/health', async (req, res) => {
  let arimaAvailable = false;
  try {
    await axios.get(`${ARIMA_SERVICE_URL}/health`, { timeout: 1500 });
    arimaAvailable = true;
  } catch (_) {
    arimaAvailable = false;
  }
  res.json({
    status: 'ok',
    datasetLoaded: !!currentDataset,
    methods: [...METHODS, 'arima'],
    arimaServiceAvailable: arimaAvailable,
  });
});

app.get('/api/sample', (req, res) => {
  try {
    loadSample();
    res.json({
      message: 'Sample dataset loaded',
      sourceName: currentDataset.sourceName,
      rowCount: currentDataset.rows.length,
      categories: currentDataset.categories,
      regions: currentDataset.regions,
      detectedColumns: currentDataset.detectedColumns,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded. Field name must be "file".' });
    const csvText = req.file.buffer.toString('utf-8');
    const parsed = processCsv(csvText);
    currentDataset = { ...parsed, sourceName: req.file.originalname };
    const daily = aggregateDaily(currentDataset.rows);
    res.json({
      message: 'File uploaded and processed successfully',
      sourceName: currentDataset.sourceName,
      rowCount: currentDataset.rows.length,
      categories: currentDataset.categories,
      regions: currentDataset.regions,
      dateRange: daily.length ? { start: daily[0].date, end: daily[daily.length - 1].date } : null,
      detectedColumns: currentDataset.detectedColumns,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/meta', (req, res) => {
  if (!currentDataset) return res.status(404).json({ error: 'No dataset loaded' });
  const daily = aggregateDaily(currentDataset.rows);
  res.json({
    sourceName: currentDataset.sourceName,
    rowCount: currentDataset.rows.length,
    categories: currentDataset.categories,
    regions: currentDataset.regions,
    dateRange: daily.length ? { start: daily[0].date, end: daily[daily.length - 1].date } : null,
    detectedColumns: currentDataset.detectedColumns,
  });
});

app.get('/api/data', (req, res) => {
  if (!currentDataset) return res.status(404).json({ error: 'No dataset loaded' });
  const { category, region, startDate, endDate } = req.query;
  const daily = filterDateRange(aggregateDaily(currentDataset.rows, { category, region }), startDate, endDate);
  res.json({ series: daily });
});

async function createForecast({ method = 'holt_winters', horizon = 30, seasonLength = 7, alpha, beta, gamma, window, category, region, startDate, endDate }) {
    const daily = filterDateRange(aggregateDaily(currentDataset.rows, { category, region }), startDate, endDate);
    if (daily.length < 3) {
      throw new Error('Not enough data points to forecast (need at least 3 days).');
    }

    const series = daily.map((d) => d.sales);

    // Build forecast dates continuing from the last historical date
    const lastDate = new Date(daily[daily.length - 1].date);
    const forecastDates = [];
    for (let h = 1; h <= Number(horizon); h++) {
      const d = new Date(lastDate);
      d.setDate(d.getDate() + h);
      forecastDates.push(d.toISOString().slice(0, 10));
    }

    if (method === 'arima') {
      // Delegate to the Python ARIMA microservice (real statistical/ML forecasting)
      if (series.length < 10) {
          throw new Error('Need at least 10 days of data to fit an ARIMA model.');
      }
      let arimaResult;
      try {
        const response = await axios.post(
          `${ARIMA_SERVICE_URL}/forecast`,
          { series, horizon: Number(horizon), fit_window: 365 },
          { timeout: 60000 }
        );
        arimaResult = response.data;
      } catch (err) {
        const detail = err.response?.data?.detail || err.message;
        throw new Error(`ARIMA service unavailable or errored: ${detail}. Make sure it's running (see backend/ml_service, "uvicorn main:app --port 8001").`);
      }

      // The Python service fits on the last `fit_window` points; align fitted dates accordingly
      const fitLength = arimaResult.fitted.length;
      const fittedDates = daily.slice(-fitLength).map((d) => d.date);

      return {
        method,
        historical: daily,
        fitted: fittedDates.map((date, i) => ({ date, value: arimaResult.fitted[i] })),
        forecast: forecastDates.map((date, i) => ({
          date,
          value: arimaResult.forecast[i],
          lower: arimaResult.lower[i],
          upper: arimaResult.upper[i],
        })),
        metrics: arimaResult.metrics,
        modelInfo: { order: arimaResult.order, aic: arimaResult.aic },
      };
    }

    // Otherwise use the in-process JS forecasting engine
    const result = runForecast(series, method, Number(horizon), {
      seasonLength: Number(seasonLength),
      alpha: alpha !== undefined ? Number(alpha) : undefined,
      beta: beta !== undefined ? Number(beta) : undefined,
      gamma: gamma !== undefined ? Number(gamma) : undefined,
      window: window !== undefined ? Number(window) : undefined,
    });

    return {
      method,
      historical: daily,
      fitted: result.fitted.map((v, i) => ({ date: daily[i].date, value: Math.round(v * 100) / 100 })),
      forecast: result.forecast.map((v, i) => ({
        date: forecastDates[i],
        value: Math.round(Math.max(0, v) * 100) / 100,
      })),
      metrics: {
        mae: Math.round(result.metrics.mae * 100) / 100,
        rmse: Math.round(result.metrics.rmse * 100) / 100,
        mape: Math.round(result.metrics.mape * 100) / 100,
      },
    };
}

app.post('/api/forecast', async (req, res) => {
  if (!currentDataset) return res.status(404).json({ error: 'No dataset loaded' });
  try {
    res.json(await createForecast(req.body));
  } catch (err) {
    res.status(err.message.startsWith('ARIMA service') ? 502 : 400).json({ error: err.message });
  }
});

app.post('/api/compare', async (req, res) => {
  if (!currentDataset) return res.status(404).json({ error: 'No dataset loaded' });
  const methods = req.body.methods || ['moving_average', 'ses', 'holt_linear', 'holt_winters', 'linear_regression', 'arima'];
  const results = await Promise.all(methods.map(async (method) => {
    try {
      const forecast = await createForecast({ ...req.body, method });
      return { method, metrics: forecast.metrics, modelInfo: forecast.modelInfo || null, forecast: forecast.forecast };
    } catch (err) {
      return { method, error: err.message };
    }
  }));
  res.json({ results });
});

app.get('/api/anomalies', (req, res) => {
  if (!currentDataset) return res.status(404).json({ error: 'No dataset loaded' });
  const { category, region, startDate, endDate, window = 7, threshold = 2.5 } = req.query;
  const daily = filterDateRange(aggregateDaily(currentDataset.rows, { category, region }), startDate, endDate);
  res.json(detectAnomalies(daily, Number(window), Number(threshold)));
});

app.post('/api/insights', async (req, res) => {
  if (!currentDataset) return res.status(404).json({ error: 'No dataset loaded' });
  try {
    const forecast = await createForecast(req.body);
    const daily = filterDateRange(aggregateDaily(currentDataset.rows, { category: req.body.category, region: req.body.region }), req.body.startDate, req.body.endDate);
    const anomalies = detectAnomalies(daily);
    res.json(buildInsights(daily, forecast, anomalies));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/stats', (req, res) => {
  if (!currentDataset) return res.status(404).json({ error: 'No dataset loaded' });
  const { category, region, startDate, endDate } = req.query;
  const daily = filterDateRange(aggregateDaily(currentDataset.rows, { category, region }), startDate, endDate);
  const total = daily.reduce((a, b) => a + b.sales, 0);
  const avgDaily = total / (daily.length || 1);

  const half = Math.floor(daily.length / 2);
  const firstHalfAvg = avg(daily.slice(0, half).map((d) => d.sales));
  const secondHalfAvg = avg(daily.slice(half).map((d) => d.sales));
  const growthRate = firstHalfAvg ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0;

  const best = daily.reduce((m, d) => (d.sales > m.sales ? d : m), daily[0] || { sales: 0, date: null });

  res.json({
    totalSales: round(total),
    avgDailySales: round(avgDaily),
    growthRate: round(growthRate),
    bestDay: best,
    numDays: daily.length,
  });
});

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Sales Forecast API running on http://localhost:${PORT}`);
});
