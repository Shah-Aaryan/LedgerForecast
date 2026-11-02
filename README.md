# LedgerForecast

LedgerForecast is a full-stack sales forecasting application for exploring historical sales data, generating daily forecasts, and evaluating forecasting performance through an interactive dashboard.

The application is designed for retail and business users who need a simple way to upload transaction data, inspect sales trends, compare forecasting approaches, and review projected revenue.

## Overview

LedgerForecast provides:

- Interactive sales metrics and time-series visualizations
- User-controlled historical date-range selection
- CSV upload with automatic date and sales-column detection
- Daily sales aggregation and optional category and region filtering
- Multiple forecasting methods, including ARIMA
- Rolling-baseline anomaly detection for unusual sales spikes and drops
- Side-by-side model comparison using MAE, RMSE, and MAPE
- Actual-versus-forecast charts
- Forecast confidence intervals for ARIMA predictions
- MAE, RMSE, and MAPE evaluation metrics
- Metric interpretation, alerts, and planning recommendations
- In-app explanation of the forecasting problem and intended use
- A bundled sample dataset for immediate demonstration

> **Current scope:** LedgerForecast is a planning-support tool. Its alerts and recommendations are data-driven prompts, not financial, inventory, or operational guarantees.

## Technology Stack

### Frontend

- React
- Vite
- Recharts
- Axios

### Backend

- Node.js
- Express
- `csv-parse`
- `multer`
- Axios

### Forecasting service

- Python
- FastAPI
- pandas
- NumPy
- statsmodels
- Automatic ARIMA order selection using AIC

## Project Structure

```text
LedgerForecast/
├── backend/
│   ├── data/
│   │   ├── generate_sample.js
│   │   └── sample_sales.csv
│   ├── ml_service/
│   │   ├── main.py
│   │   └── requirements.txt
│   ├── utils/
│   │   ├── csvProcessor.js
│   │   └── forecasting.js
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ControlsPanel.jsx
│   │   │   ├── ForecastChart.jsx
│   │   │   ├── LedgerTable.jsx
│   │   │   ├── StatsCards.jsx
│   │   │   └── UploadPanel.jsx
│   │   ├── api.js
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## Requirements

Install the following before running the application:

- Node.js 18 or later
- npm
- Python 3.9 or later
- pip

The Python forecasting service is required only when using the ARIMA method. All other forecasting methods run inside the Node.js backend.

## Installation

### 1. Install backend dependencies

```bash
cd backend
npm install
```

### 2. Install frontend dependencies

```bash
cd frontend
npm install
```

### 3. Install Python dependencies

```bash
cd backend/ml_service
pip install -r requirements.txt
```

On systems that restrict global package installation, use a virtual environment:

```bash
python -m venv venv

# Windows PowerShell
venv\Scripts\Activate.ps1

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

## Running the Application

LedgerForecast uses three processes during local development.

### 1. Start the ARIMA service

From `backend/ml_service`:

```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8001
```

The service is available at `http://localhost:8001`.

On Windows PowerShell, activate the environment first:

```powershell
cd C:\Users\aaryan\OneDrive\Desktop\LedgerForecast\backend\ml_service
.\venv\Scripts\Activate.ps1
python -m uvicorn main:app --host 0.0.0.0 --port 8001
```

Using `python -m uvicorn` is intentional. Windows virtual-environment launcher files can retain an absolute path if the project directory is moved or renamed; invoking Uvicorn through Python avoids that stale-launcher problem.

### 2. Start the backend API

From `backend`:

```bash
npm start
```

The API is available at `http://localhost:5000`.

### 3. Start the frontend

From `frontend`:

```bash
npm run dev
```

Open `http://localhost:5173` in a browser.

If the ARIMA service is not running, the rest of the application remains available. Selecting ARIMA will display an error explaining that the service must be started.

## Using the Dashboard

### Load data

You can either:

1. Select **Use bundled sample** to load the included demonstration dataset.
2. Upload a CSV file containing a date column and a numeric sales or revenue column.

The backend attempts to detect common column names, including:

- Date: `Order Date`, `Date`, `Invoice Date`, `Sale Date`, `Transaction Date`
- Sales: `Sales`, `Amount`, `Revenue`, `Total`, `Order Amount`, `Total Sales`
- Category: `Category`, `Product Category`, `Segment`
- Region: `Region`, `State`, `Country`, `Market`

Rows with invalid dates or sales values are ignored during processing. The remaining records are aggregated into a daily time series, and missing dates are filled with zero sales.

### Configure a forecast

The dashboard supports:

- Forecast method selection
- Forecast horizon selection from 1 to 180 days
- Holt-Winters season length configuration
- Category filtering
- Region filtering

### Review results

The dashboard displays:

- Total sales for the selected period
- Average daily sales
- Growth between the first and second half of the period
- Highest-sales day
- Historical sales and projected sales
- ARIMA confidence intervals when available
- MAE, RMSE, and MAPE metrics

## Forecasting Methods

### Moving average

Produces a flat forecast based on the average of the most recent observations. This provides a simple baseline for comparison.

### Simple exponential smoothing

Assigns greater importance to recent observations and is suitable for series without a strong trend or seasonal pattern.

### Holt's linear trend

Extends exponential smoothing with a trend component to project upward or downward movement.

### Holt-Winters

Models both trend and seasonality. The default season length is seven days, making it suitable for daily sales with weekly patterns.

### Linear regression

Fits an ordinary least-squares line to historical sales and extrapolates that trend into the forecast period.

### ARIMA

ARIMA is implemented in the Python service using `statsmodels`. The service searches supported `(p, d, q)` combinations and selects the model with the lowest Akaike Information Criterion (AIC). It returns:

- Forecast values
- Fitted historical values
- Selected ARIMA order
- AIC
- 80% confidence intervals
- MAE, RMSE, and MAPE

ARIMA is a classical statistical forecasting method. It is not a deep-learning model such as an LSTM.

## API Reference

The backend exposes the following endpoints:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Returns service health and available methods |
| `GET` | `/api/sample` | Loads the bundled sample dataset |
| `POST` | `/api/upload` | Uploads and processes a CSV file |
| `GET` | `/api/meta` | Returns dataset metadata and available filters |
| `GET` | `/api/data` | Returns the aggregated daily series |
| `GET` | `/api/stats` | Returns summary statistics |
| `POST` | `/api/forecast` | Generates a forecast |
| `GET` | `/api/anomalies` | Detects unusual sales spikes and drops |
| `POST` | `/api/compare` | Compares multiple forecasting models |
| `POST` | `/api/insights` | Returns alerts, interpretation, and recommendations |

### Forecast request

```json
{
  "method": "holt_winters",
  "horizon": 30,
  "seasonLength": 7,
  "category": "Technology",
  "region": "West",
  "startDate": "2025-01-01",
  "endDate": "2025-12-31"
}
```

The `startDate` and `endDate` fields are optional and restrict the historical data used for statistics, anomaly detection, model fitting, and forecasting.

Supported methods:

```text
moving_average
ses
holt_linear
holt_winters
linear_regression
arima
```

## Data Format

A minimum CSV file must contain:

1. A recognizable date column
2. A recognizable numeric sales column

Example:

```csv
Order Date,Sales,Category,Region
2025-01-01,1250.50,Technology,West
2025-01-02,980.00,Office Supplies,East
```

The application is compatible with many retail and sales datasets, including common Kaggle Superstore-style datasets.

## Validation and Metrics

Forecast performance is evaluated against fitted historical values:

- **MAE:** Mean Absolute Error
- **RMSE:** Root Mean Squared Error
- **MAPE:** Mean Absolute Percentage Error

Lower values generally indicate a better fit. These metrics describe historical fit and should not be treated as a guarantee of future forecast accuracy.

The dashboard also interprets MAPE as:

- **Strong:** below 10%
- **Moderate:** 10% to 20%
- **Limited:** above 20%

Anomaly detection compares each day with a rolling seven-day baseline and flags observations whose z-score exceeds 2.5. The comparison view ranks models using their historical error metrics. Decision-support alerts identify unusual activity and forecast changes of at least 10%.

## Important Limitations

- The current dataset is stored in memory and is lost when the backend restarts.
- The application is intended for local demonstration and does not include authentication or multi-user data isolation.
- Forecasting quality depends on data quality, history length, seasonality, and outliers.
- Anomaly detection uses a rolling statistical baseline and may flag legitimate promotions, holidays, or data corrections.
- Model comparison ranks historical fit; it does not guarantee that the lowest-error model will perform best in the future.
- Alerts and recommendations are intentionally advisory and require domain review.
- ARIMA fitting may take longer for large datasets because it evaluates multiple candidate orders.

## Troubleshooting

### The frontend cannot reach the API

Confirm that the backend is running on port `5000` and that the frontend development server is running on port `5173`.

### ARIMA fails

Confirm that:

1. The Python dependencies are installed.
2. The ARIMA service is running on port `8001`.
3. The selected dataset contains at least ten daily observations.

If PowerShell reports `Fatal error in launcher` and references a different project directory, do not run `uvicorn` directly. From `backend/ml_service`, run:

```powershell
.\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8001
```

If the environment is no longer usable, recreate it:

```powershell
cd C:\Users\aaryan\OneDrive\Desktop\LedgerForecast\backend\ml_service
Remove-Item -Recurse -Force .\venv
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8001
```

### CSV upload fails

Check that the file:

- Is a valid CSV
- Contains a recognizable date column
- Contains a numeric sales or revenue column
- Contains at least one valid data row

## License

This project does not currently declare a formal open-source license. Add a license before distributing it outside the intended project or academic context.
