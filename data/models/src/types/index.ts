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
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ── Extended Technical Indicators ─────────────────────────────────────────────
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

  // ── Roadmap #3: Advanced Quant Features ──────────────────────────────────
  realizedVolatility?: number;   // Annualised close-to-close volatility
  hurstExponent?: number;        // 0–1: <0.5=mean-revert, 0.5=random, >0.5=trend
  shannonEntropy?: number;       // Price-move entropy (bits)
  zScoreMomentum?: number;       // (close – mean) / stddev over 20 periods
  volatilityCompression?: number;// ATR_5 / ATR_30 — squeeze proxy
  relativeVolume?: number;       // Current vol / 20-period average vol
  trendPersistence?: number;     // Fraction of bars where price moved in primary direction
}

// ── Roadmap #1: Detailed Regime ───────────────────────────────────────────────
export type MarketRegimeType =
  | "Trending Bullish"
  | "Trending Bearish"
  | "Sideways"
  | "High Volatility"
  | "Panic / Crash"
  | "Recovery"
  | "Extended Trending"
  | "Trending Up"
  | "Trending Down"
  | "Low Liquidity Range"
  | "High Volatility Range"
  | "Accumulation"
  | "Distribution"
  | "Panic Rejection"
  | "Euphoria Setup";

export interface RegimeDetail {
  type: MarketRegimeType;
  regimeScore: number;        // composite score 0–100
  adxContrib: number;
  volContrib: number;
  trendContrib: number;
  confidence: number;         // 0–1
}

// ── Roadmap #4: Relative Strength ─────────────────────────────────────────────
export interface RSScore {
  rsRaw: number;              // stock return / benchmark return
  momentumPercentile: number; // 0–100 rank in universe
  sectorRank: number;         // rank within sector (1=best)
  alphaRank: number;          // rank vs full universe
}

// ── Roadmap #5: Multi-Timeframe ───────────────────────────────────────────────
export interface MTFScore {
  finalScore: number;         // 0.4*daily + 0.3*h4 + 0.2*h1 + 0.1*weekly
  dailyTrend: number;
  h4Momentum: number;
  h1Setup: number;
  weeklyBias: number;
  confluence: "STRONG" | "MODERATE" | "WEAK" | "CONFLICTED";
}

// ── Roadmap #7: Historical Analog ─────────────────────────────────────────────
export interface AnalogMatch {
  similarityScore: number;    // 0–1 cosine similarity
  periodStartTs: number;      // Unix ms of matched historical window
  outcomeReturn: number;      // Actual return that followed the analog
  matchQuality: "HIGH" | "MEDIUM" | "LOW";
}

// ML Engine outputs
export interface MLPrediction {
  probability: number;
  confidence: number;
  momentumScore: number;
  breakoutProbability: number;
  trendDirection: "BULLISH" | "BEARISH" | "NEUTRAL";
  estimatedFutureCandles: number[];
}

// Risk Analysis Engine outputs
export interface RiskMetrics {
  volatilityScore: number;
  liquidityScore: number;
  riskScore: number;
  rrRatio: number;
  manipulationWarning: boolean;
  fakeBreakoutRisk: boolean;
  entryZone: { min: number; max: number };
  stopLoss: number;
  takeProfit: number;
  invalidationLevel: number;
}

// Comprehensive Asset Assessment
export interface ScannerAsset {
  ticker: string;
  name: string;
  assetClass: AssetClass;
  sector?: string;
  timeframe: string;
  price: number;
  changePercent: number;
  volume: number;

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
  fakeBreakoutRisk?: boolean;

  entryZone: { min: number; max: number };
  stopLoss: number;
  takeProfit: number;
  invalidationLevel: number;
  trendDirection: "BULLISH" | "BEARISH" | "NEUTRAL";

  headlines?: string[];
  newsTitleSummary?: string[];
  aiExplanation?: string;
  estimatedFutureCandles?: number[];

  // ── New roadmap fields ────────────────────────────────────────────────────
  regimeDetail?: RegimeDetail;
  rsScore?: RSScore;
  mtfScore?: MTFScore;
  analogMatches?: AnalogMatch[];
  scannerScore?: number;        // Composite institutional scanner score
}

// Memory / Audit
export interface HistoricalPrediction {
  id: string;
  ticker: string;
  assetClass: AssetClass;
  timestamp: number;
  priceAtPrediction: number;
  predictedProbability: number;
  predictedDirection: "BULLISH" | "BEARISH" | "NEUTRAL";
  actualOutcome?: number;
  confidence: number;
}
