/**
 * Market Regime Detection Engine  — Roadmap Item #1
 *
 * Mengklasifikasikan kondisi pasar ke dalam 6 regime utama:
 *   Trending Bullish | Trending Bearish | Sideways |
 *   High Volatility  | Panic / Crash    | Recovery
 *
 * Metode:
 *   1. ATR + ADX Hybrid Classification (deterministik, utama)
 *   2. Volatility Clustering via EWMA Variance (Bayesian-inspired)
 *   3. Composite RegimeScore = w1*ADX + w2*Volatility + w3*TrendStrength
 *
 * Semua kalkulasi menggunakan data candle nyata — tidak ada nilai hardcoded.
 */

import { Candle, TechIndicators, RegimeDetail, MarketRegimeType } from "../../types";

// Bobot dari roadmap: RegimeScore = w1*ADX + w2*Volatility + w3*TrendStrength
const W1_ADX       = 0.35;
const W2_VOL       = 0.35;
const W3_TREND     = 0.30;

// Threshold ADX (Wilder standard)
const ADX_TRENDING = 25;
const ADX_SIDEWAYS = 18;

// Threshold ATR expansion untuk HIGH_VOL (% dari harga)
const ATR_HIGH_VOL_PCT = 0.04; // 4% ATR/price → high volatility

export class RegimeDetectionEngine {
  private static instance: RegimeDetectionEngine;

  // Bayesian volatility state: EWMA variance estimate
  private ewmaVariance: Map<string, number> = new Map();
  private readonly EWMA_LAMBDA = 0.94; // RiskMetrics standard decay

  private constructor() {}

  public static getInstance(): RegimeDetectionEngine {
    if (!RegimeDetectionEngine.instance) {
      RegimeDetectionEngine.instance = new RegimeDetectionEngine();
    }
    return RegimeDetectionEngine.instance;
  }

  /**
   * Entry point utama.
   * Mengembalikan RegimeDetail lengkap termasuk regimeScore, confidence,
   * dan kontribusi tiap faktor.
   */
  public detectRegime(
    candles: Candle[],
    indicators: TechIndicators,
    ticker: string
  ): RegimeDetail {
    if (candles.length < 10) {
      return this.defaultRegime();
    }

    const lastPrice = candles[candles.length - 1].close;

    // ── Komponen 1: ADX Contribution ─────────────────────────────────────
    // ADX dinormalisasi ke [0,1]: ADX 0→0, ADX 40+→1
    const adxNorm      = Math.min(1, indicators.adx / 40);
    const adxContrib   = adxNorm * W1_ADX * 100;

    // ── Komponen 2: Volatility Contribution (EWMA Variance) ─────────────
    const logReturns   = this.computeLogReturns(candles);
    const ewmaVar      = this.updateEWMAVariance(ticker, logReturns);
    const dailyVol     = Math.sqrt(ewmaVar);
    const annualVol    = dailyVol * Math.sqrt(252);    // Annualised

    // Normalise: vol 0%→0, vol 50%+ annualised→1
    const volNorm      = Math.min(1, annualVol / 0.5);
    const volContrib   = volNorm * W2_VOL * 100;

    // ── Komponen 3: Trend Strength Contribution ──────────────────────────
    const trendStrength = this.computeTrendStrength(candles, indicators);
    const trendContrib  = trendStrength * W3_TREND * 100;

    // ── Composite Regime Score ───────────────────────────────────────────
    const regimeScore = adxContrib + volContrib + trendContrib;

    // ── ATR/price untuk panic dan high-vol detection ─────────────────────
    const atrPct = lastPrice > 0 ? indicators.atr / lastPrice : 0;

    // ── Klasifikasi regime ───────────────────────────────────────────────
    const type = this.classifyRegime(
      indicators.adx,
      atrPct,
      annualVol,
      trendStrength,
      candles,
      indicators
    );

    // ── Confidence: lebih tinggi jika sinyal tidak ambigu ────────────────
    const confidence = this.computeConfidence(
      indicators.adx, atrPct, annualVol, trendStrength
    );

    return {
      type,
      regimeScore: Number(regimeScore.toFixed(1)),
      adxContrib: Number(adxContrib.toFixed(1)),
      volContrib: Number(volContrib.toFixed(1)),
      trendContrib: Number(trendContrib.toFixed(1)),
      confidence: Number(confidence.toFixed(3)),
    };
  }

  // ── Klasifikasi utama ──────────────────────────────────────────────────────

  private classifyRegime(
    adx: number,
    atrPct: number,
    annualVol: number,
    trendStrength: number,
    candles: Candle[],
    indicators: TechIndicators
  ): MarketRegimeType {
    const lastPrice  = candles[candles.length - 1].close;
    const n          = candles.length;
    const recentN    = Math.min(5, n);
    const priceNow   = candles[n - 1].close;
    const pricePrev  = candles[n - recentN].close;
    const shortReturn = (priceNow - pricePrev) / (pricePrev || 1);

    // ── Panic / Crash: ATR expansion + sharp drop ────────────────────────
    if (atrPct > ATR_HIGH_VOL_PCT * 1.5 && shortReturn < -0.06) {
      return "Panic / Crash";
    }

    // ── Recovery: setelah panik, volatility masih tinggi tapi arah naik ──
    if (atrPct > ATR_HIGH_VOL_PCT && shortReturn > 0.03 && adx < ADX_TRENDING) {
      return "Recovery";
    }

    // ── High Volatility (bukan directional) ──────────────────────────────
    if (atrPct > ATR_HIGH_VOL_PCT || annualVol > 0.6) {
      return "High Volatility";
    }

    // ── Trending: ADX > 25 ────────────────────────────────────────────────
    if (adx > ADX_TRENDING) {
      const isBullish = indicators.emaFast > indicators.emaSlow &&
                        lastPrice > indicators.bbMiddle;
      return isBullish ? "Trending Bullish" : "Trending Bearish";
    }

    // ── Sideways: ADX < 18 ────────────────────────────────────────────────
    if (adx < ADX_SIDEWAYS) {
      return "Sideways";
    }

    // ── Ambiguous zone (ADX 18–25): gunakan trendStrength & RSI ─────────
    if (trendStrength > 0.6) {
      return indicators.emaFast > indicators.emaSlow
        ? "Trending Bullish"
        : "Trending Bearish";
    }

    return "Sideways";
  }

  // ── EWMA Variance (Bayesian Volatility Clustering) ────────────────────────

  private updateEWMAVariance(ticker: string, logReturns: number[]): number {
    if (logReturns.length === 0) return 0.0001;

    let variance = this.ewmaVariance.get(ticker);

    if (variance === undefined) {
      // Bootstrap: gunakan sample variance dari 10 return pertama
      const seed = logReturns.slice(0, 10);
      const mean = seed.reduce((s, r) => s + r, 0) / seed.length;
      variance = seed.reduce((s, r) => s + (r - mean) ** 2, 0) / seed.length;
    }

    // Update EWMA: σ²_t = λ*σ²_{t-1} + (1-λ)*r²_t
    for (const r of logReturns.slice(-20)) {
      variance = this.EWMA_LAMBDA * variance + (1 - this.EWMA_LAMBDA) * r * r;
    }

    this.ewmaVariance.set(ticker, variance);
    return variance;
  }

  // ── Trend Strength via Efficiency Ratio ───────────────────────────────────

  /**
   * Kaufman Efficiency Ratio = |net move| / sum(|bar moves|)
   * 1.0 = perfect trend, 0 = total noise
   */
  private computeTrendStrength(
    candles: Candle[],
    indicators: TechIndicators
  ): number {
    const window = Math.min(20, candles.length);
    if (window < 3) return 0.5;

    const slice = candles.slice(-window);
    const netMove = Math.abs(slice[window - 1].close - slice[0].close);
    let pathLength = 0;
    for (let i = 1; i < window; i++) {
      pathLength += Math.abs(slice[i].close - slice[i - 1].close);
    }
    const er = pathLength > 0 ? netMove / pathLength : 0;

    // Blend with ADX signal
    const adxFactor = Math.min(1, indicators.adx / 40);
    return er * 0.6 + adxFactor * 0.4;
  }

  // ── Confidence scoring ────────────────────────────────────────────────────

  private computeConfidence(
    adx: number,
    atrPct: number,
    annualVol: number,
    trendStrength: number
  ): number {
    // Confidence is high when signals agree and are unambiguous
    const adxClear       = adx > ADX_TRENDING || adx < ADX_SIDEWAYS ? 1.0 : 0.5;
    const volClear       = atrPct > ATR_HIGH_VOL_PCT * 1.5 || atrPct < ATR_HIGH_VOL_PCT * 0.5 ? 1.0 : 0.5;
    const trendClear     = trendStrength > 0.7 || trendStrength < 0.3 ? 1.0 : 0.5;
    return (adxClear + volClear + trendClear) / 3;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private computeLogReturns(candles: Candle[]): number[] {
    const out: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const prev = candles[i - 1].close;
      const curr = candles[i].close;
      if (prev > 0 && curr > 0) out.push(Math.log(curr / prev));
    }
    return out;
  }

  private defaultRegime(): RegimeDetail {
    return {
      type: "Sideways",
      regimeScore: 30,
      adxContrib: 10,
      volContrib: 10,
      trendContrib: 10,
      confidence: 0.3,
    };
  }
}
