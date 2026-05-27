/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Core asset metadata
export type AssetClass = "IDX" | "CRYPTO";

export interface AssetInfo {
  ticker: string;
  name: string;
  assetClass: AssetClass;
  sector?: string;
}

// Historical OHLCV (candles)
export interface Candle {
  time: number; // unix timestamp in ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Quantitative Technical & Sentiment Features
export interface TechIndicators {
  emaFast: number;
  emaSlow: number;
  vwap?: number;
  atr: number;
  rsi: number;
  macd: number;
  macdSignal: number;
  macdHist: number;
  bbUpper: number;
  bbLower: number;
  bbMiddle: number;
  adx: number;
  obv: number;
}

export type MarketRegimeType = "Extended Trending" | "Trending Up" | "Trending Down" | "Low Liquidity Range" | "High Volatility Range" | "Accumulation" | "Distribution" | "Panic Rejection" | "Euphoria Setup";

// Machine Learning Engine outputs
export interface MLPrediction {
  probability: number; // 0.0 - 1.0 (Price increase probability)
  confidence: number; // 0.0 - 1.0 (Calibrated confidence engine metric)
  momentumScore: number; // 0 - 100
  breakoutProbability: number; // 0.0 - 1.0
  trendDirection: "BULLISH" | "BEARISH" | "NEUTRAL";
  estimatedFutureCandles: number[]; // Short-term prediction array mapping next periods
}

// Risk Analysis Engine outputs
export interface RiskMetrics {
  volatilityScore: number; // 0 - 100 (Based on ATR and historical variance)
  liquidityScore: number; // 0 - 100 (Based on volume & spread proxies)
  riskScore: number; // 0 - 100 (Final calculated composite risk)
  rrRatio: number; // Risk-to-reward ratio (e.g., 2.5)
  manipulationWarning: boolean; // Flag if unnatural volume/spread detected
  fakeBreakoutRisk: boolean; // Flag to identify momentum trap setups
  entryZone: { min: number; max: number };
  stopLoss: number;
  takeProfit: number;
  invalidationLevel: number;
}

// Sentiment Analysis outputs
export interface SentimentData {
  sentimentScore: number; // -1.0 to 1.0 (negative to positive)
  label: "positive" | "negative" | "neutral";
  confidence: number;
  newsTitleSummary: string[];
}

// Comprehensive Asset Assessment
export interface ScannerAsset {
  ticker: string;
  name: string;
  assetClass: AssetClass;
  sector?: string; // Phase 3 Portfolio Allocation
  timeframe: string;
  price: number;
  changePercent: number;
  volume: number;
  
  // Predictions & Statistics
  probability: number;
  confidence: number;
  momentumScore: number;
  volatilityScore: number;
  liquidityScore: number;
  sentimentScore: number;
  riskScore: number;
  rrRatio: number;
  breakoutProbability: number;
  marketRegime: MarketRegimeType;
  manipulationWarning: boolean;
  
  // Risk execution zones
  entryZone: { min: number; max: number };
  stopLoss: number;
  takeProfit: number;
  invalidationLevel: number;
  trendDirection: "BULLISH" | "BEARISH" | "NEUTRAL";
  
  // News content
  headlines?: string[];
  
  // Explanation grounding
  aiExplanation?: string;
  
  // Forecast tracking
  estimatedFutureCandles?: number[];
}

// Prediction and realization storage (Memory & Audit Engine)
export interface HistoricalPrediction {
  id: string;
  timestamp: string; // ISO String
  ticker: string;
  assetClass: AssetClass;
  predictedProbability: number;
  predictedDirection: "BULLISH" | "BEARISH" | "NEUTRAL";
  initialPrice: number;
  confidence: number;
  marketRegime: MarketRegimeType;
  
  // Realization audit (updated walk-forward engine)
  actualPrice?: number;
  realizedPercent?: number;
  success?: boolean;
  auditedAt?: string;
}

// System Calibration Configuration
export interface SystemCalibration {
  idxWeight: number; // Base weight modifier for IDX predictive ensemble
  cryptoWeight: number; // Base weight modifier for Crypto predictive ensemble
  globalAccuracyTracker: {
    totalPredictions: number;
    successfulPredictions: number;
    overallAccuracy: number; // 0.0 to 1.0
  };
}

// Primary Core Scanner Results
export interface ScanResult {
  scanTimestamp: string;
  durationMs: number;
  assetsScannedCount: number;
  scannedAssets: ScannerAsset[];
}
