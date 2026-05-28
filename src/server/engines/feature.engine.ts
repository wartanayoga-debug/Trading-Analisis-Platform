/**
 * Feature Engineering Engine — Enhanced with Roadmap #3 Advanced Quant Features
 *
 * Fitur baru yang ditambahkan:
 *   - Realized Volatility  (close-to-close, annualised)
 *   - Hurst Exponent       (R/S analysis, 20-bar)
 *   - Shannon Entropy      (price move distribution)
 *   - Z-Score Momentum     (standardised price deviation)
 *   - Volatility Compression (ATR_5 / ATR_30)
 *   - Relative Volume      (current vol / 20-period avg)
 *   - Trend Persistence    (fraction of bars in primary direction)
 *
 * Semua formula dari literatur quant standar (Hurst 1951, Shannon 1948).
 */

import { Candle, TechIndicators, MarketRegimeType } from "../../types";

export class FeatureEngineeringEngine {
  private static instance: FeatureEngineeringEngine;

  private constructor() {}

  public static getInstance(): FeatureEngineeringEngine {
    if (!FeatureEngineeringEngine.instance) {
      FeatureEngineeringEngine.instance = new FeatureEngineeringEngine();
    }
    return FeatureEngineeringEngine.instance;
  }

  public extractFeatures(candles: Candle[]): TechIndicators {
    if (candles.length === 0) return this.generateEmptyIndicators();

    const closes  = candles.map((c) => c.close);
    const highs   = candles.map((c) => c.high);
    const lows    = candles.map((c) => c.low);
    const volumes = candles.map((c) => c.volume);

    const emaFastNum = this.calculateEMA(closes, 12);
    const emaSlowNum = this.calculateEMA(closes, 26);
    const vwapNum    = this.calculateVWAP(candles);
    const atrNum     = this.calculateATR(highs, lows, closes, 14);
    const rsiNum     = this.calculateRSI(closes, 14);
    const macdData   = this.calculateMACD(closes, 12, 26, 9);
    const bbData     = this.calculateBollingerBands(closes, 20, 2);
    const adxNum     = this.calculateADX(highs, lows, closes, 14);
    const obvNum     = this.calculateOBV(closes, volumes);

    // ── Roadmap #3 Advanced Features ──────────────────────────────────────
    const realizedVol     = this.calculateRealizedVolatility(closes, 20);
    const hurstExp        = this.calculateHurstExponent(closes, 20);
    const entropy         = this.calculateShannonEntropy(closes, 20);
    const zScore          = this.calculateZScoreMomentum(closes, 20);
    const volCompression  = this.calculateVolatilityCompression(highs, lows, closes);
    const relVol          = this.calculateRelativeVolume(volumes, 20);
    const trendPersist    = this.calculateTrendPersistence(closes, 20);

    return {
      emaFast:  Number(emaFastNum.toFixed(4)),
      emaSlow:  Number(emaSlowNum.toFixed(4)),
      vwap:     vwapNum !== undefined ? Number(vwapNum.toFixed(4)) : undefined,
      atr:      Number(atrNum.toFixed(4)),
      rsi:      Number(rsiNum.toFixed(2)),
      macd:     Number(macdData.macd.toFixed(4)),
      macdSignal: Number(macdData.signal.toFixed(4)),
      macdHist: Number(macdData.histogram.toFixed(4)),
      bbUpper:  Number(bbData.upper.toFixed(4)),
      bbLower:  Number(bbData.lower.toFixed(4)),
      bbMiddle: Number(bbData.middle.toFixed(4)),
      adx:      Number(adxNum.toFixed(2)),
      obv:      obvNum,

      // Advanced
      realizedVolatility:    Number(realizedVol.toFixed(4)),
      hurstExponent:         Number(hurstExp.toFixed(4)),
      shannonEntropy:        Number(entropy.toFixed(4)),
      zScoreMomentum:        Number(zScore.toFixed(4)),
      volatilityCompression: Number(volCompression.toFixed(4)),
      relativeVolume:        Number(relVol.toFixed(4)),
      trendPersistence:      Number(trendPersist.toFixed(4)),
    };
  }

  // Legacy regime detection (kept for backward compat, main now in regime.engine.ts)
  public detectMarketRegime(
    indicators: TechIndicators,
    candles: Candle[]
  ): MarketRegimeType {
    if (candles.length < 2) return "Low Liquidity Range";

    const lastCandle  = candles[candles.length - 1];
    const prevCandle  = candles[candles.length - 2];
    const priceChange = (lastCandle.close - prevCandle.close) / prevCandle.close;
    const isTrending       = indicators.adx > 25;
    const isHighlyVolatile = indicators.atr / lastCandle.close > 0.05;

    if (isHighlyVolatile && priceChange < -0.04) return "Panic Rejection";
    if (isHighlyVolatile && priceChange > 0.04)  return "Euphoria Setup";

    if (isTrending) {
      if (indicators.emaFast > indicators.emaSlow && lastCandle.close > indicators.bbMiddle) {
        return indicators.rsi > 70 ? "Extended Trending" : "Trending Up";
      }
      return indicators.rsi < 30 ? "Extended Trending" : "Trending Down";
    }
    if (indicators.rsi > 60) return "Distribution";
    if (indicators.rsi < 40) return "Accumulation";
    return isHighlyVolatile ? "High Volatility Range" : "Low Liquidity Range";
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ROADMAP #3 — ADVANCED QUANTITATIVE FEATURES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Realized Volatility — annualised close-to-close
   * Formula: σ = sqrt(252 / n * Σ(ln(P_t / P_{t-1})²))
   */
  private calculateRealizedVolatility(closes: number[], period: number): number {
    const slice = closes.slice(-period - 1);
    if (slice.length < 3) return 0;
    let sumSq = 0;
    let count = 0;
    for (let i = 1; i < slice.length; i++) {
      if (slice[i - 1] > 0 && slice[i] > 0) {
        const r = Math.log(slice[i] / slice[i - 1]);
        sumSq += r * r;
        count++;
      }
    }
    return count > 0 ? Math.sqrt((252 / count) * sumSq) : 0;
  }

  /**
   * Hurst Exponent via Rescaled Range (R/S) Analysis
   * H < 0.5 → mean-reverting, H = 0.5 → random walk, H > 0.5 → trending
   *
   * Source: Hurst (1951), "Long-term storage capacity of reservoirs"
   */
  private calculateHurstExponent(closes: number[], period: number): number {
    const slice = closes.slice(-period);
    if (slice.length < 8) return 0.5;

    const lags = [2, 4, 8, Math.floor(period / 2)].filter(l => l < slice.length);
    if (lags.length < 2) return 0.5;

    const logLags: number[] = [];
    const logRS: number[]   = [];

    for (const lag of lags) {
      const sub     = slice.slice(-lag);
      const mean    = sub.reduce((s, v) => s + v, 0) / lag;
      const devs    = sub.map(v => v - mean);
      let cumDev    = 0;
      let maxCum    = -Infinity;
      let minCum    =  Infinity;
      for (const d of devs) {
        cumDev += d;
        if (cumDev > maxCum) maxCum = cumDev;
        if (cumDev < minCum) minCum = cumDev;
      }
      const range   = maxCum - minCum;
      const std     = Math.sqrt(sub.reduce((s, v) => s + (v - mean) ** 2, 0) / lag);
      if (std > 0 && range > 0) {
        logLags.push(Math.log(lag));
        logRS.push(Math.log(range / std));
      }
    }

    if (logLags.length < 2) return 0.5;

    // OLS slope = Hurst exponent
    const n       = logLags.length;
    const meanX   = logLags.reduce((s, v) => s + v, 0) / n;
    const meanY   = logRS.reduce((s, v) => s + v, 0) / n;
    const num     = logLags.reduce((s, x, i) => s + (x - meanX) * (logRS[i] - meanY), 0);
    const den     = logLags.reduce((s, x) => s + (x - meanX) ** 2, 0);
    const hurst   = den > 0 ? num / den : 0.5;

    return Math.max(0.01, Math.min(0.99, hurst));
  }

  /**
   * Shannon Entropy of price move direction distribution
   * Lower entropy = more predictable direction
   * Formula: H = -Σ p_i * log2(p_i)
   */
  private calculateShannonEntropy(closes: number[], period: number): number {
    const slice = closes.slice(-period - 1);
    if (slice.length < 4) return 1.0;

    const bins: Record<string, number> = { up: 0, down: 0, flat: 0 };
    for (let i = 1; i < slice.length; i++) {
      const r = (slice[i] - slice[i - 1]) / (slice[i - 1] || 1);
      if      (r >  0.001) bins.up++;
      else if (r < -0.001) bins.down++;
      else                 bins.flat++;
    }

    const total = slice.length - 1;
    let entropy = 0;
    for (const count of Object.values(bins)) {
      const p = count / total;
      if (p > 0) entropy -= p * Math.log2(p);
    }

    // Normalise to [0,1] (max entropy for 3 bins = log2(3) ≈ 1.585)
    return entropy / Math.log2(3);
  }

  /**
   * Z-Score Momentum: (close – mean_20) / std_20
   * > 2 = overbought, < -2 = oversold
   */
  private calculateZScoreMomentum(closes: number[], period: number): number {
    const slice = closes.slice(-period);
    if (slice.length < 3) return 0;
    const mean  = slice.reduce((s, v) => s + v, 0) / slice.length;
    const std   = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / slice.length);
    const last  = slice[slice.length - 1];
    return std > 0 ? (last - mean) / std : 0;
  }

  /**
   * Volatility Compression = ATR_5 / ATR_30
   * < 0.7 = compression (potential breakout setup)
   * > 1.3 = expansion
   */
  private calculateVolatilityCompression(
    highs: number[],
    lows: number[],
    closes: number[]
  ): number {
    const atr5  = this.calculateATR(highs, lows, closes, 5);
    const atr30 = this.calculateATR(highs, lows, closes, 30);
    return atr30 > 0 ? atr5 / atr30 : 1.0;
  }

  /**
   * Relative Volume = current volume / SMA_20(volume)
   * > 2 = significant volume expansion
   */
  private calculateRelativeVolume(volumes: number[], period: number): number {
    if (volumes.length < 2) return 1;
    const slice   = volumes.slice(-period - 1);
    const current = slice[slice.length - 1];
    const avg     = slice.slice(0, -1).reduce((s, v) => s + v, 0) / (slice.length - 1);
    return avg > 0 ? current / avg : 1;
  }

  /**
   * Trend Persistence = fraction of bars moving in the dominant direction
   * over the last `period` bars. 0.7+ = strong trend persistence.
   */
  private calculateTrendPersistence(closes: number[], period: number): number {
    const slice = closes.slice(-period - 1);
    if (slice.length < 3) return 0.5;
    let up = 0;
    let dn = 0;
    for (let i = 1; i < slice.length; i++) {
      if (slice[i] > slice[i - 1]) up++;
      else if (slice[i] < slice[i - 1]) dn++;
    }
    const total = slice.length - 1;
    return Math.max(up, dn) / total;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CORE TECHNICAL INDICATORS (unchanged — already correct)
  // ═══════════════════════════════════════════════════════════════════════════

  private calculateEMA(data: number[], period: number): number {
    if (data.length === 0) return 0;
    if (data.length <= period)
      return data.reduce((sum, v) => sum + v, 0) / data.length;
    const k = 2 / (period + 1);
    let ema = data[0];
    for (let i = 1; i < data.length; i++) ema = data[i] * k + ema * (1 - k);
    return ema;
  }

  private calculateVWAP(candles: Candle[]): number {
    let tpv = 0;
    let tv  = 0;
    candles.forEach((c) => {
      const tp = (c.high + c.low + c.close) / 3;
      tpv += tp * c.volume;
      tv  += c.volume;
    });
    return tv > 0 ? tpv / tv : candles[candles.length - 1]?.close || 0;
  }

  public calculateATR(
    highs: number[], lows: number[], closes: number[], period: number
  ): number {
    if (closes.length < 2) return 0;
    const trs: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      trs.push(Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i]  - closes[i - 1])
      ));
    }
    if (trs.length === 0) return 0;
    let atr = trs.slice(0, period).reduce((s, v) => s + v, 0) / Math.min(trs.length, period);
    for (let i = period; i < trs.length; i++)
      atr = (atr * (period - 1) + trs[i]) / period;
    return atr;
  }

  private calculateRSI(closes: number[], period: number): number {
    if (closes.length <= period) return 50;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change; else losses -= change;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    for (let i = period + 1; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      avgGain = (avgGain * (period - 1) + Math.max(0,  change)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.max(0, -change)) / period;
    }
    if (avgLoss === 0) return 100;
    return 100 - 100 / (1 + avgGain / avgLoss);
  }

  private calculateMACD(
    closes: number[], fast: number, slow: number, signal: number
  ): { macd: number; signal: number; histogram: number } {
    if (closes.length < slow) return { macd: 0, signal: 0, histogram: 0 };
    const kF = 2 / (fast + 1), kS = 2 / (slow + 1), kSig = 2 / (signal + 1);
    let emaF = closes[0], emaS = closes[0];
    const macdLine: number[] = [];
    for (let i = 0; i < closes.length; i++) {
      emaF = closes[i] * kF + emaF * (1 - kF);
      emaS = closes[i] * kS + emaS * (1 - kS);
      macdLine.push(emaF - emaS);
    }
    let sig = macdLine[0];
    for (const m of macdLine) sig = m * kSig + sig * (1 - kSig);
    const last = macdLine[macdLine.length - 1];
    return { macd: last, signal: sig, histogram: last - sig };
  }

  private calculateBollingerBands(
    closes: number[], period: number, mult: number
  ): { upper: number; lower: number; middle: number } {
    if (closes.length < period) {
      const p = closes[closes.length - 1] || 0;
      return { upper: p, lower: p, middle: p };
    }
    const slice  = closes.slice(-period);
    const middle = slice.reduce((s, v) => s + v, 0) / period;
    const std    = Math.sqrt(slice.reduce((s, v) => s + (v - middle) ** 2, 0) / period);
    return { middle, upper: middle + mult * std, lower: middle - mult * std };
  }

  private calculateADX(
    highs: number[], lows: number[], closes: number[], period: number
  ): number {
    if (closes.length <= period * 2) return 20;
    const plusDM: number[] = [], minusDM: number[] = [], trs: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      const up = highs[i] - highs[i - 1], dn = lows[i - 1] - lows[i];
      plusDM.push(up > dn && up > 0 ? up : 0);
      minusDM.push(dn > up && dn > 0 ? dn : 0);
      trs.push(Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i]  - closes[i - 1])
      ));
    }
    let trS = trs.slice(0, period).reduce((s, v) => s + v, 0);
    let pdS = plusDM.slice(0, period).reduce((s, v) => s + v, 0);
    let mdS = minusDM.slice(0, period).reduce((s, v) => s + v, 0);
    const dxVals: number[] = [];
    for (let i = period; i < trs.length; i++) {
      trS = trS - trS / period + trs[i];
      pdS = pdS - pdS / period + plusDM[i];
      mdS = mdS - mdS / period + minusDM[i];
      const dp = trS > 0 ? (pdS / trS) * 100 : 0;
      const dm = trS > 0 ? (mdS / trS) * 100 : 0;
      const sum = dp + dm, diff = Math.abs(dp - dm);
      dxVals.push(sum > 0 ? (diff / sum) * 100 : 0);
    }
    if (dxVals.length === 0) return 20;
    let adx = dxVals.slice(0, period).reduce((s, v) => s + v, 0) / Math.min(dxVals.length, period);
    for (let i = period; i < dxVals.length; i++)
      adx = (adx * (period - 1) + dxVals[i]) / period;
    return adx;
  }

  private calculateOBV(closes: number[], volumes: number[]): number {
    let obv = 0;
    for (let i = 1; i < closes.length; i++) {
      if (closes[i] > closes[i - 1])      obv += volumes[i];
      else if (closes[i] < closes[i - 1]) obv -= volumes[i];
    }
    return obv;
  }

  private generateEmptyIndicators(): TechIndicators {
    return {
      emaFast: 0, emaSlow: 0, atr: 0, rsi: 50,
      macd: 0, macdSignal: 0, macdHist: 0,
      bbUpper: 0, bbLower: 0, bbMiddle: 0,
      adx: 20, obv: 0,
      realizedVolatility: 0, hurstExponent: 0.5, shannonEntropy: 1,
      zScoreMomentum: 0, volatilityCompression: 1, relativeVolume: 1,
      trendPersistence: 0.5,
    };
  }
}
