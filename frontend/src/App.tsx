import React, { useState } from 'react';
import axios from 'axios';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer
} from 'recharts';


interface Article {
  title: string;
}

interface HistoricalDataPoint {
  date: string;
  actual: number;
  predicted: number;
}

interface PredictionResult {
  symbol: string;
  predicted_next_day_close: number;
  actual_last_close: number;
  margin_of_error: number;
  current_price?: number;
  historical?: HistoricalDataPoint[];
  articles?: Article[];
  summary?: string;
  sentiment?: string;
  sentiment_summary?: string;
  news_sources?: string[];
}

type Page = 'home' | 'about' | 'news' | 'howitworks';
// Helper to format date from yyyy-mm-dd to mm/dd/yyyy
function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  return `${m}/${d}/${y}`;
}

// Spinner component (smaller, for inline use)
const Spinner = () => (
  <div style={{
    width: 16,
    height: 16,
    border: '2.5px solid #23263a',
    borderTop: '2.5px solid #00bcd4',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginLeft: 8,
    display: 'inline-block',
    verticalAlign: 'middle',
  }}>
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

// Move HomePage outside App
const HomePage = ({ query, setQuery, handleSearch, loading, error, result, sentiment }: {
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  handleSearch: () => void;
  loading: boolean;
  error: string;
  result: PredictionResult | null;
  sentiment: 'positive' | 'negative' | 'neutral';
}) => {
  const [windowStart, setWindowStart] = useState(0);
  // Removed zoomed state (no longer used)
  const [zoomRange, setZoomRange] = useState<{start: number, end: number} | null>(null);
  const monthsToShow = 4;
  let historical = result?.historical || [];
  // Group by month, get unique months
  const months = Array.from(new Set(historical.map(d => d.date.slice(0, 7))));
  const totalWindows = Math.max(1, months.length - monthsToShow + 1);
  // Default window: show the most recent 4 months
  const defaultWindow = Math.max(0, months.length - monthsToShow);
  // Start at the most recent window
  React.useEffect(() => { setWindowStart(defaultWindow); }, [result]);
  const currentWindow = Math.min(windowStart, totalWindows - 1);
  // Get the months to show
  const visibleMonths = months.slice(currentWindow, currentWindow + monthsToShow);
  // Filter data to visible months
  let visibleData: HistoricalDataPoint[];
  if (zoomRange && zoomRange.start >= 0 && zoomRange.end > zoomRange.start) {
    // When zoomed, always show the week from the full historical data
    visibleData = historical.slice(zoomRange.start, zoomRange.end);
  } else {
    // Not zoomed: show the windowed months
    visibleData = historical.filter(d => visibleMonths.includes(d.date.slice(0, 7)));
  }
  // Y axis min/max with $15 margin (or tighter if zoomed)
  let yMin = Math.min(...visibleData.map(d => Math.min(d.actual, d.predicted)));
  let yMax = Math.max(...visibleData.map(d => Math.max(d.actual, d.predicted)));
  if (isFinite(yMin) && isFinite(yMax)) {
    if (zoomRange) {
      // Zoom: tighter fit
      const yRange = yMax - yMin;
      yMin = yMin - yRange * 0.05;
      yMax = yMax + yRange * 0.05;
    } else {
      yMin = Math.floor(yMin - 15);
      yMax = Math.ceil(yMax + 15);
    }
  }

  return (
    <div style={{
      maxWidth: 800,
      margin: '0 auto',
      padding: '0 2rem 2.5rem 2rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '0', // Remove forced tall minHeight
      boxSizing: 'border-box',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #181c2f 0%, #23263a 100%)',
        padding: '2.5rem',
        borderRadius: '20px',
        boxShadow: sentiment === 'positive'
          ? '0 0 60px 10px rgba(76, 175, 80, 0.45)'
          : sentiment === 'negative'
          ? '0 0 60px 10px rgba(244, 67, 54, 0.45)'
          : '0 8px 32px rgba(0, 188, 212, 0.15)',
        border: `4px solid ${sentiment === 'positive' ? '#4caf50' : sentiment === 'negative' ? '#f44336' : '#00bcd4'}`,
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        maxWidth: 600,
        transition: 'box-shadow 0.4s, border 0.4s',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '0', // Remove forced tall minHeight
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2 style={{
              color: '#00bcd4',
              fontSize: '2.2rem',
              marginBottom: '0.5rem',
              fontWeight: 700,
              letterSpacing: 1
            }}>
              Aniee AI Stock Price Predictor
            </h2>
            <p style={{ color: '#e8f1f9', fontSize: '1.05rem', opacity: 0.85, marginBottom: 0 }}>
              Enter a stock symbol or company name to get a <b>next day closing price prediction</b> powered by AI.
            </p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
            <input
              type="text"
              placeholder="e.g. Apple, AAPL, GOOGL, TSLA"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                width: 340,
                padding: '1rem 1.5rem',
                borderRadius: '12px',
                border: '1.5px solid #00bcd4',
                background: '#181c2f',
                color: '#e8f1f9',
                fontSize: '1.08rem',
                outline: 'none',
                transition: 'all 0.3s ease',
                boxShadow: '0 2px 8px rgba(0, 188, 212, 0.08)',
                marginRight: 0
              }}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem', gap: 0 }}>
            <button
              onClick={handleSearch}
              style={{
                width: '100%',
                padding: '1rem',
                background: 'linear-gradient(135deg, #00bcd4 0%, #82ca9d 100%)',
                color: '#181c2f',
                borderRadius: '12px',
                fontSize: '1.15rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                transition: 'all 0.3s ease',
                boxShadow: '0 2px 8px rgba(0, 188, 212, 0.10)',
                letterSpacing: 0.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              disabled={loading}
            >
              {loading ? (
                <>
                  Predicting<Spinner />
                </>
              ) : 'Get Prediction'}
            </button>
          </div>
          {/* Show error if present */}
          {error && (
            <div style={{ color: '#f44336', textAlign: 'center', marginBottom: '1rem' }}>{error}</div>
          )}

          {/* Stock Symbol Heading centered between button and chart */}
          {result && result.symbol && result.historical && result.historical.length > 0 && (
            <>
              {/* Ticker Symbol Heading centered between Get Prediction and summary boxes */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: 50,
                margin: '1.5rem 0 1.2rem 0',
                width: '100%',
              }}>
                <span style={{
                  color: '#00bcd4',
                  fontSize: '2.2rem',
                  fontWeight: 700,
                  letterSpacing: 2,
                  textShadow: '0 0 8px #00bcd4, 0 0 2px #23263a',
                  fontFamily: 'Times New Roman, Times, serif',
                  textTransform: 'uppercase',
                  background: 'none',
                  WebkitBackgroundClip: 'initial',
                  WebkitTextFillColor: 'initial',
                  backgroundClip: 'initial',
                  margin: 0,
                  padding: 0,
                  lineHeight: 1.1,
                  textAlign: 'center',
                  width: '100%',
                  display: 'block',
                  position: 'relative',
                  top: '-7px',
                }}>{result.symbol}</span>
              </div>
              {/* Four-color, evenly split summary boxes in a 2x2 grid, dark and non-overlapping */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '1.2rem',
                  margin: '0.5rem 0 2.2rem 0',
                  width: '100%',
                  maxWidth: 600,
                  alignSelf: 'center',
                  zIndex: 1,
                  position: 'relative',
                }}
              >
                {/* Predicted Close */}
                <div style={{
                  background: 'linear-gradient(135deg, #1e2a38 0%, #233447 100%)',
                  border: '1.5px solid #00bcd4',
                  borderRadius: '15px',
                  padding: '1.3rem 1rem',
                  minWidth: 140,
                  minHeight: 70,
                  maxWidth: 260,
                  flex: '1 1 220px',
                  boxShadow: '0 2px 10px 0 rgba(0,188,212,0.08)',
                  fontWeight: 700,
                  fontSize: '1.13rem',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(3px)',
                  transition: 'box-shadow 0.3s',
                }}>
                  <span style={{ color: '#00bcd4', fontWeight: 600, fontSize: '1.05rem', marginBottom: 6, opacity: 0.92 }}>Predicted Close</span>
                  <span style={{ fontSize: '2.1rem', color: '#e8f1f9', fontWeight: 800, letterSpacing: 1 }}>
                    ${result.predicted_next_day_close?.toFixed(2) ?? '--'}
                  </span>
                </div>
                {/* Actual Last Close */}
                <div style={{
                  background: 'linear-gradient(135deg, #1e3832 0%, #2a4d43 100%)',
                  border: '1.5px solid #43e97b',
                  borderRadius: '15px',
                  padding: '1.3rem 1rem',
                  minWidth: 140,
                  minHeight: 70,
                  maxWidth: 260,
                  flex: '1 1 220px',
                  boxShadow: '0 2px 10px 0 rgba(67,233,123,0.08)',
                  fontWeight: 700,
                  fontSize: '1.13rem',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(3px)',
                  transition: 'box-shadow 0.3s',
                }}>
                  <span style={{ color: '#43e97b', fontWeight: 600, fontSize: '1.05rem', marginBottom: 6, opacity: 0.92 }}>Actual Last Close</span>
                  <span style={{ fontSize: '2.1rem', color: '#e8f1f9', fontWeight: 800, letterSpacing: 1 }}>
                    ${result.actual_last_close?.toFixed(2) ?? '--'}
                  </span>
                </div>
                {/* Today's Price */}
                <div style={{
                  background: 'linear-gradient(135deg, #3a2a1e 0%, #473c2a 100%)',
                  border: '1.5px solid #ffd200',
                  borderRadius: '15px',
                  padding: '1.3rem 1rem',
                  minWidth: 140,
                  minHeight: 70,
                  maxWidth: 260,
                  flex: '1 1 220px',
                  boxShadow: '0 2px 10px 0 rgba(255,210,0,0.08)',
                  fontWeight: 700,
                  fontSize: '1.13rem',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(3px)',
                  transition: 'box-shadow 0.3s',
                }}>
                  <span style={{ color: '#ffd200', fontWeight: 600, fontSize: '1.05rem', marginBottom: 6, opacity: 0.92 }}>Today's Price</span>
                  <span style={{ fontSize: '2.1rem', color: '#e8f1f9', fontWeight: 800, letterSpacing: 1 }}>
                    {result.current_price !== undefined ? `$${result.current_price.toFixed(2)}` : '--'}
                  </span>
                </div>
                {/* Margin of Error */}
                <div style={{
                  background: 'linear-gradient(135deg, #3a1e2a 0%, #472a3c 100%)',
                  border: '1.5px solid #f857a6',
                  borderRadius: '15px',
                  padding: '1.3rem 1rem',
                  minWidth: 140,
                  minHeight: 70,
                  maxWidth: 260,
                  flex: '1 1 220px',
                  boxShadow: '0 2px 10px 0 rgba(248,87,166,0.08)',
                  fontWeight: 700,
                  fontSize: '1.13rem',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(3px)',
                  transition: 'box-shadow 0.3s',
                }}>
                  <span style={{ color: '#f857a6', fontWeight: 600, fontSize: '1.05rem', marginBottom: 6, opacity: 0.92 }}>Margin of Error</span>
                  <span style={{ fontSize: '2.1rem', color: '#e8f1f9', fontWeight: 800, letterSpacing: 1 }}>
                    {result.predicted_next_day_close !== undefined && result.margin_of_error !== undefined
                      ? `$${(result.predicted_next_day_close * result.margin_of_error / 100).toFixed(2)}`
                      : '--'}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Show chart if result and historical data exist */}
          {result && result.historical && result.historical.length > 0 && (
            <div
              style={{
                position: 'relative',
                margin: '2rem 0',
              }}
            >
              {/* ← Left Arrow */}
              <button
                onClick={() => setWindowStart(Math.max(0, currentWindow - 1))}
                disabled={currentWindow === 0}
                style={{
                  position: 'absolute',
                  left: -20,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: 'none',
                  border: 'none',
                  cursor: currentWindow === 0 ? 'not-allowed' : 'pointer',
                  opacity: currentWindow === 0 ? 0.3 : 1,
                  width: 32,
                  height: 32,
                  padding: 0,
                  zIndex: 2
                }}
                aria-label="Scroll left"
              >
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <circle
                    cx="16"
                    cy="16"
                    r="14"
                    stroke="#00bcd4"
                    strokeWidth="3"
                    fill="none"
                  />
                  <polyline
                    points="20,10 12,16 20,22"
                    stroke="#00bcd4"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {/* Chart Container + Zoom Button */}
              <div
                style={{
                  background: 'rgba(24, 28, 47, 0.92)',
                  borderRadius: '12px',
                  border: '1px solid #00bcd4',
                  padding: '1.5rem',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '0.7rem', marginTop: '-1.4rem' }}>
                  <h3
                    style={{
                      color: '#00bcd4',
                      textAlign: 'center',
                      marginBottom: 2,
                      fontWeight: 600,
                      fontSize: '1.25rem',
                      letterSpacing: 0.2,
                      position: 'relative',
                      top: '-5px',
                    }}
                  >
                    Historical vs Predicted Prices
                  </h3>
                  <span
                    style={{
                      color: '#b2e0f7',
                      fontSize: '0.98rem',
                      opacity: 0.82,
                      marginTop: 2,
                      textAlign: 'center',
                      fontWeight: 400,
                      fontStyle: 'italic',
                      letterSpacing: 0.01,
                      position: 'relative',
                      top: '-5px',
                    }}
                  >
                    Click any point to zoom in on a week. Click again to zoom out.
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={zoomRange ? 440 : 320}>
                  <LineChart
                    data={visibleData}
                    onClick={(e: any) => {
                      if (!e || !e.activeLabel) return;
                      if (!zoomRange) {
                        // Find the index of the clicked point in the full historical data
                        const idx = historical.findIndex((d: HistoricalDataPoint) => formatDate(d.date) === e.activeLabel);
                        if (idx === -1) return;
                        // Zoom in: show 7 days centered on the clicked point
                        let start = Math.max(0, idx - 3);
                        let end = Math.min(historical.length, start + 7);
                        if (end - start < 7) start = Math.max(0, end - 7);
                        setZoomRange({ start, end });
                      } else {
                        // Reset zoom on any click
                        setZoomRange(null);
                      }
                    }}
                  >
                    <XAxis
                      dataKey={(d: HistoricalDataPoint) => formatDate(d.date)}
                      stroke="#8884d8"
                      tick={{ fontSize: zoomRange ? 15 : 12 }}
                      interval={zoomRange ? 0 : Math.max(0, Math.floor(visibleData.length / 6) - 1)}
                    />
                    <YAxis
                      stroke="#8884d8"
                      domain={[yMin, yMax]}
                      tickFormatter={(v: number) => `$${Math.round(v)}`}
                      tick={{ fontSize: zoomRange ? 15 : 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#1a1d2b',
                        border: '1px solid #00bcd4',
                        borderRadius: '8px'
                      }}
                      labelFormatter={(v: any) => v}
                      formatter={(v: number) => v.toFixed(3)}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      stroke="#00bcd4"
                      name="Actual Price"
                      strokeWidth={3}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="predicted"
                      stroke="#82ca9d"
                      name="Predicted Price"
                      strokeWidth={3}
                      dot={false}
                    />
              </LineChart>
            </ResponsiveContainer>
          </div>
              {/* → Right Arrow */}
              <button
                onClick={() => setWindowStart(Math.min(totalWindows - 1, currentWindow + 1))}
                disabled={currentWindow >= totalWindows - 1}
                style={{
                  position: 'absolute',
                  right: -20,
                  top: '50%',
                  transform: 'translate(50%, -50%)',
                  background: 'none',
                  border: 'none',
                  cursor:
                    currentWindow >= totalWindows - 1 ? 'not-allowed' : 'pointer',
                  opacity: currentWindow >= totalWindows - 1 ? 0.3 : 1,
                  width: 32,
                  height: 32,
                  padding: 0,
                  zIndex: 2
                }}
                aria-label="Scroll right"
              >
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <circle
                    cx="16"
                    cy="16"
                    r="14"
                    stroke="#00bcd4"
                    strokeWidth="3"
                    fill="none"
                  />
                  <polyline
                    points="12,10 20,16 12,22"
                    stroke="#00bcd4"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
        {/* Disclaimer as a single line, absolutely at the bottom of the main container */}
        <div
          style={{
            width: '100%',
            position: 'absolute',
            left: 0,
            bottom: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-end',
            pointerEvents: 'none',
            paddingBottom: '8px',
          }}
        >
          <span
            style={{
              fontSize: '0.89rem',
              color: '#b2e0f7',
              textAlign: 'center',
              fontWeight: 400,
              letterSpacing: 0.01,
              fontStyle: 'italic',
              fontFamily: 'Segoe UI, system-ui, -apple-system, sans-serif',
              opacity: 0.93,
              background: 'none',
              border: 'none',
              boxShadow: 'none',
              padding: 0,
              margin: 0,
              whiteSpace: 'normal',
              pointerEvents: 'auto',
            }}
          >
            This tool is AI-driven and provided for informational purposes only.
            <br />
            We assume no responsibility for any purchases made or financial losses incurred.
          </span>
        </div>
      </div>
    </div>
  );
};
// How It Works Page (now correctly outside HomePage)
const HowItWorksPage = () => (
  <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 2rem', paddingBottom: '3.5rem' }}>
    <div style={{
      background: 'linear-gradient(135deg, #1a1d2b 0%, #23263a 100%)',
      padding: '3rem',
      borderRadius: '20px',
      boxShadow: '0 8px 32px rgba(0, 188, 212, 0.3)',
      border: '1px solid #00bcd4',
      color: '#e8f1f9',
    }}>
      <h2 style={{
        color: '#00bcd4',
        fontSize: '2.5rem',
        textAlign: 'center',
        marginBottom: '2rem',
        textShadow: '0 0 15px rgba(0, 188, 212, 0.5)'
      }}>
        How It Works: Our LSTM Stock Prediction Model
      </h2>
      <p style={{ fontSize: '1.18rem', lineHeight: 1.7, marginBottom: '2rem', textAlign: 'center' }}>
        Our AI-powered stock predictor uses a type of neural network called a <b>Long Short-Term Memory (LSTM)</b> model. LSTMs are designed to recognize patterns in sequences of data, making them ideal for analyzing stock prices over time.
      </p>
      <div style={{ background: 'rgba(35, 38, 58, 0.85)', borderRadius: '15px', padding: '2rem', marginBottom: '2rem', border: '1px solid #00bcd4' }}>
        <h3 style={{ color: '#00bcd4', fontSize: '1.4rem', marginBottom: '1rem' }}>Why LSTM?</h3>
        <ul style={{ fontSize: '1.08rem', lineHeight: 1.7, color: '#e8f1f9', paddingLeft: '1.2rem' }}>
          <li><b>Remembers trends:</b> LSTMs can learn from both recent and older price movements, capturing long-term dependencies in stock data.</li>
          <li><b>Handles noisy data:</b> Stock prices are unpredictable and noisy. LSTMs are robust to such fluctuations.</li>
          <li><b>Sequential learning:</b> LSTMs process data in order, just like how stock prices change over time.</li>
        </ul>
      </div>
      <div style={{ background: 'rgba(35, 38, 58, 0.85)', borderRadius: '15px', padding: '2rem', border: '1px solid #00bcd4' }}>
        <h3 style={{ color: '#00bcd4', fontSize: '1.4rem', marginBottom: '1rem' }}>How Our Model Works</h3>
        <ol style={{ fontSize: '1.08rem', lineHeight: 1.7, color: '#e8f1f9', paddingLeft: '1.2rem' }}>
          <li><b>Data Collection:</b> We gather historical stock prices and technical indicators (like moving averages, RSI, and MACD) from Yahoo Finance.</li>
          <li><b>Feature Engineering:</b> The model uses not just prices, but also technical indicators and market sentiment to improve accuracy.</li>
          <li><b>Model Training:</b> The LSTM is trained on sequences of past stock data to predict the next day's closing price. It learns to recognize patterns and trends over time.</li>
          <li><b>Prediction:</b> For a given stock, the model analyzes recent data and outputs a predicted closing price for the next trading day.</li>
        </ol>
        <div style={{ marginTop: '1.5rem', color: '#b2e0f7', fontStyle: 'italic', fontSize: '1.05rem', textAlign: 'center' }}>
          <b>Note:</b> While our LSTM model is powerful, stock prediction is inherently uncertain. Please use predictions as informational guidance, not financial advice.
        </div>
      </div>
    </div>
  </div>
);
// End HowItWorksPage

// Move AboutPage outside App
const AboutPage = () => (
  <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 2rem', paddingBottom: '3.5rem' }}>
    <div style={{
      background: 'linear-gradient(135deg, #1a1d2b 0%, #2d3748 100%)',
      padding: '3rem',
      borderRadius: '20px',
      boxShadow: '0 8px 32px rgba(0, 188, 212, 0.3)',
      border: '1px solid #00bcd4'
    }}>
      <h2 style={{ 
        color: '#00bcd4', 
        fontSize: '3rem', 
        textAlign: 'center',
        marginBottom: '2rem',
        textShadow: '0 0 15px rgba(0, 188, 212, 0.5)'
      }}>
        About Our Team
      </h2>
      
      <p style={{ 
        color: '#e8f1f9', 
        fontSize: '1.2rem', 
        textAlign: 'center', 
        marginBottom: '3rem',
        lineHeight: '1.6'
      }}>
        We are high school students passionate about technology and finance, building this AI-powered stock prediction platform to help investors make informed decisions using cutting-edge machine learning technology.
      </p>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '2rem',
        marginBottom: '3rem'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #00bcd4 0%, #4dd0e1 100%)',
          padding: '2rem',
          borderRadius: '20px',
          textAlign: 'center',
          color: '#000',
          boxShadow: '0 8px 25px rgba(0, 188, 212, 0.4)'
        }}>
          <h3 style={{ fontSize: '1.8rem', marginBottom: '1rem', fontWeight: 'bold' }}>Aniket</h3>
          <p style={{ fontSize: '1.1rem', lineHeight: '1.6' }}>
            Aspiring full-stack developer and AI enthusiast. High school student passionate about machine learning and data science applications.
          </p>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #82ca9d 0%, #a8e6cf 100%)',
          padding: '2rem',
          borderRadius: '20px',
          textAlign: 'center',
          color: '#000',
          boxShadow: '0 8px 25px rgba(130, 202, 157, 0.4)'
        }}>
          <h3 style={{ fontSize: '1.8rem', marginBottom: '1rem', fontWeight: 'bold' }}>Eeshan</h3>
          <p style={{ fontSize: '1.1rem', lineHeight: '1.6' }}>
            Aspiring machine learning engineer and data analyst. High school student with a keen interest in predictive modeling and financial algorithms.
          </p>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)',
          padding: '2rem',
          borderRadius: '20px',
          textAlign: 'center',
          color: '#000',
          boxShadow: '0 8px 25px rgba(251, 194, 235, 0.4)'
        }}>
          <h3 style={{ fontSize: '1.8rem', marginBottom: '1rem', fontWeight: 'bold' }}>Anishkumar</h3>
          <p style={{ fontSize: '1.1rem', lineHeight: '1.6' }}>
            Aspiring software engineer and finance enthusiast. High school student dedicated to bridging technology and business.
          </p>
        </div>
      </div>

      <div style={{
        background: 'rgba(35, 38, 58, 0.8)',
        padding: '2rem',
        borderRadius: '15px',
        border: '1px solid #00bcd4'
      }}>
        <h3 style={{ color: '#00bcd4', fontSize: '1.8rem', marginBottom: '1rem' }}>
          🛠️ Our Technology Stack
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ color: '#e8f1f9', fontSize: '1.1rem' }}>• React & TypeScript</div>
          <div style={{ color: '#e8f1f9', fontSize: '1.1rem' }}>• Python Flask</div>
          <div style={{ color: '#e8f1f9', fontSize: '1.1rem' }}>• TensorFlow & Keras</div>
          <div style={{ color: '#e8f1f9', fontSize: '1.1rem' }}>• Yahoo Finance API</div>
          <div style={{ color: '#e8f1f9', fontSize: '1.1rem' }}>• Recharts</div>
          <div style={{ color: '#e8f1f9', fontSize: '1.1rem' }}>• Technical Analysis</div>
        </div>
      </div>
    </div>
  </div>
);

// Market News Page
const MarketNewsPage = ({ query, result, sentiment, setSentiment }: { query: string; result: PredictionResult | null; sentiment: 'positive' | 'negative' | 'neutral'; setSentiment: (s: any) => void }) => {
  const [news, setNews] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (!query) return;
    setLoading(true);
    setError('');
    setNews(null);
    axios.post('https://finance-backend.onrender.com/predict', { stock: query })
      .then(res => {
        setNews(res.data);
        setSentiment(res.data.sentiment || 'neutral');
      })
      .catch(() => setError('Could not fetch news/sentiment.'))
      .finally(() => setLoading(false));
  }, [query, setSentiment]);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem', minHeight: '80vh' }}>
      <h2 style={{ textAlign: 'center', color: '#00bcd4', fontSize: '2.2rem', fontWeight: 700, marginBottom: '2rem' }}>
        Market News & Sentiment
      </h2>
      {loading && <div style={{ color: '#00bcd4', textAlign: 'center' }}>Loading news and sentiment...</div>}
      {error && <div style={{ color: '#f44336', textAlign: 'center' }}>{error}</div>}
      {news && (
        <div style={{
          background: 'rgba(24, 28, 47, 0.97)',
          borderRadius: '18px',
          boxShadow: '0 8px 32px rgba(0, 188, 212, 0.10)',
          border: `2.5px solid ${sentiment === 'positive' ? '#4caf50' : sentiment === 'negative' ? '#f44336' : '#00bcd4'}`,
          padding: '2rem',
          marginBottom: '2rem',
        }}>
          <div style={{ textAlign: 'center', fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>
            {news.symbol}
          </div>
          <div style={{ fontWeight: 600, fontSize: '1.15rem', marginBottom: '1rem' }}>
            Market Sentiment: {news.sentiment}
          </div>
          <div style={{ marginBottom: '1.5rem', fontStyle: 'italic', color: '#e8f1f9', fontSize: '1.1rem', textAlign: 'center' }}>{news.summary}</div>
          <div>
            <h4 style={{ color: '#00bcd4', marginBottom: '0.5rem' }}>Related News Articles</h4>
            <ul style={{ paddingLeft: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
              {news.articles && news.articles.map((a: any, i: number) => (
                <li key={i} style={{ marginBottom: 0, flex: '1 1 45%' }}>
                  <a href={a.url} target="_blank" rel="noopener noreferrer" style={{
                    display: 'block',
                    background: 'linear-gradient(135deg, #23263a 0%, #181c2f 100%)',
                    color: '#82ca9d',
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: '1.08rem',
                    borderRadius: '10px',
                    padding: '1rem',
                    boxShadow: '0 2px 8px rgba(130, 202, 157, 0.15)',
                    transition: 'box-shadow 0.2s, background 0.2s',
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = 'linear-gradient(135deg, #82ca9d 0%, #a8e6cf 100%)')}
                  onMouseOut={e => (e.currentTarget.style.background = 'linear-gradient(135deg, #23263a 0%, #181c2f 100%)')}
                  >{a.title}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

function App() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [sentiment, setSentiment] = useState<'positive' | 'negative' | 'neutral'>('neutral');

  const handleSearch = async () => {
    if (!query.trim()) {
      setError('Please enter a stock name or symbol.');
      return;
    }

    setError('');
    setResult(null);
    setLoading(true);

    try {
      const response = await axios.post('http://localhost:8001/predict', {
        stock: query.trim(),
        range: '1_day'
      });

      setResult(response.data);
      setSentiment(response.data.sentiment || 'neutral');
    } catch (err: any) {
      console.error(err);
      setError('❌ Could not fetch prediction.');
    } finally {
      setLoading(false);
    }
  };

  const Navigation = () => (
    <nav style={{
      background: 'linear-gradient(135deg, #1a1d2b 0%, #2d3748 100%)',
      padding: '1rem 2rem',
      marginBottom: '2rem',
      borderRadius: 0, // Remove rounded corners
      boxShadow: '0 4px 20px rgba(0, 188, 212, 0.3)',
      borderBottom: '2px solid #00bcd4'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h1 style={{ 
            color: '#00bcd4', 
            margin: 0, 
            fontSize: '1.8rem',
            fontWeight: 'bold',
            textShadow: '0 0 10px rgba(0, 188, 212, 0.5)'
          }}>
            📈 Aniee AI Stock Predictor
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => setCurrentPage('home')}
            style={{
              background: currentPage === 'home' ? '#00bcd4' : 'transparent',
              color: currentPage === 'home' ? '#000' : '#00bcd4',
              border: '2px solid #00bcd4',
              padding: '0.5rem 1.5rem',
              borderRadius: '25px',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.3s ease',
              fontSize: '1rem'
            }}
          >
            Home
          </button>
          <button
            onClick={() => setCurrentPage('about')}
            style={{
              background: currentPage === 'about' ? '#00bcd4' : 'transparent',
              color: currentPage === 'about' ? '#000' : '#00bcd4',
              border: '2px solid #00bcd4',
              padding: '0.5rem 1.5rem',
              borderRadius: '25px',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.3s ease',
              fontSize: '1rem'
            }}
          >
            About Us
          </button>
          <button
            onClick={() => setCurrentPage('news')}
            style={{
              background: currentPage === 'news' ? '#00bcd4' : 'transparent',
              color: currentPage === 'news' ? '#000' : '#00bcd4',
              border: '2px solid #00bcd4',
              padding: '0.5rem 1.5rem',
              borderRadius: '25px',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.3s ease',
              fontSize: '1rem'
            }}
          >
            Market News
          </button>
          <button
            onClick={() => setCurrentPage('howitworks')}
            style={{
              background: currentPage === 'howitworks' ? '#00bcd4' : 'transparent',
              color: currentPage === 'howitworks' ? '#000' : '#00bcd4',
              border: '2px solid #00bcd4',
              padding: '0.5rem 1.5rem',
              borderRadius: '25px',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.3s ease',
              fontSize: '1rem'
            }}
          >
            How it Works
          </button>
        </div>
      </div>
    </nav>
  );

  return (
    <div
      style={{
        backgroundColor: '#0f111a',
        color: '#e8f1f9',
        minHeight: '100vh',
        fontFamily: 'Segoe UI, system-ui, -apple-system, sans-serif',
        marginBottom: '2rem',
      }}
    >
      <Navigation />
      {currentPage === 'home' ? (
        <HomePage
          query={query}
          setQuery={setQuery}
          handleSearch={handleSearch}
          loading={loading}
          error={error}
          result={result}
          sentiment={sentiment}
        />
      ) : currentPage === 'about' ? (
        <AboutPage />
      ) : currentPage === 'news' ? (
        <MarketNewsPage
          query={query}
          result={result}
          sentiment={sentiment}
          setSentiment={setSentiment}
        />
      ) : (
        <HowItWorksPage />
      )}
      <style>{`
        html, body {
          background: #0f111a !important;
          color: #e8f1f9;
          min-height: 100vh;
          margin: 0;
          padding: 0;
          width: 100vw;
          overflow-x: hidden;
        }
        body {
          box-sizing: border-box;
        }
        /* Custom Scrollbar for Webkit Browsers */
        ::-webkit-scrollbar {
          width: 12px;
          background: #181c2f;
        }
        ::-webkit-scrollbar-thumb {
          background: #23263a;
          border-radius: 8px;
          border: 2px solid #0f111a;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #00bcd4;
        }
        /* Firefox */
        html {
          scrollbar-color: #23263a #181c2f;
          scrollbar-width: thin;
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

export default App;

//Finally done
