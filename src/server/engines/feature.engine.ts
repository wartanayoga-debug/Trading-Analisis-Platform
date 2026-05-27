/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
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

  /**
   * Primary Entry Point: Generates comprehensive feature matrix from OHLCV candles
   */
  public extractFeatures(candles: Candle[]): TechIndicators {
    if (candles.length === 0) {
      return this.generateEmptyIndicators();
    }

    const closes = candles.map((c) => c.close);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const volumes = candles.map((c) => c.volume);

    const emaFastNum = this.calculateEMA(closes, 12);
    const emaSlowNum = this.calculateEMA(closes, 26);
    const vwapNum = this.calculateVWAP(candles);
    const atrNum = this.calculateATR(highs, lows, closes, 14);
    const rsiNum = this.calculateRSI(closes, 14);
    const macdData = this.calculateMACD(closes, 12, 26, 9);
    const bbData = this.calculateBollingerBands(closes, 20, 2);
    const adxNum = this.calculateADX(highs, lows, closes, 14);
    const obvNum = this.calculateOBV(closes, volumes);

    return {
      emaFast: Number(emaFastNum.toFixed(4)),
      emaSlow: Number(emaSlowNum.toFixed(4)),
      vwap: vwapNum !== undefined ? Number(vwapNum.toFixed(4)) : undefined,
      atr: Number(atrNum.toFixed(4)),
      rsi: Number(rsiNum.toFixed(2)),
      macd: Number(macdData.macd.toFixed(4)),
      macdSignal: Number(macdData.signal.toFixed(4)),
      macdHist: Number(macdData.histogram.toFixed(4)),
      bbUpper: Number(bbData.upper.toFixed(4)),
      bbLower: Number(bbData.lower.toFixed(4)),
      bbMiddle: Number(bbData.middle.toFixed(4)),
      adx: Number(adxNum.toFixed(2)),
      obv: obvNum,
    };
  }

  /**
   * Deterministically detects the structural Market Regime using technical aggregates
   */
  public detectMarketRegime(
    indicators: TechIndicators,
    candles: Candle[],
  ): MarketRegimeType {
    if (candles.length < 2) return "Low Liquidity Range";

    const lastCandle = candles[candles.length - 1];
    const prevCandle = candles[candles.length - 2];
    const priceChange =
      (lastCandle.close - prevCandle.close) / prevCandle.close;

    const isTrending = indicators.adx > 25;
    const isHighlyVolatile = indicators.atr / lastCandle.close > 0.05; // 5% range in single candle ratio

    if (isHighlyVolatile && priceChange < -0.04) {
      return "Panic Rejection";
    }
    if (isHighlyVolatile && priceChange > 0.04) {
      return "Euphoria Setup";
    }

    if (isTrending) {
      if (
        indicators.emaFast > indicators.emaSlow &&
        lastCandle.close > indicators.bbMiddle
      ) {
        return indicators.rsi > 70 ? "Extended Trending" : "Trending Up";
      } else {
        return indicators.rsi < 30 ? "Extended Trending" : "Trending Down";
      }
    }

    // Ranging markets division
    if (indicators.rsi > 60) {
      return "Distribution";
    } else if (indicators.rsi < 40) {
      return "Accumulation";
    }

    return isHighlyVolatile ? "High Volatility Range" : "Low Liquidity Range";
  }

  // ==========================================
  // MATHEMATICAL IMPLEMENTATIONS
  // ==========================================

  private calculateEMA(data: number[], period: number): number {
    if (data.length === 0) return 0;
    if (data.length <= period) {
      // Return simple average as fallback initializer
      return data.reduce((sum, v) => sum + v, 0) / data.length;
    }

    const k = 2 / (period + 1);
    let ema = data[0]; // Start matching first value

    for (let i = 1; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
    }
    return ema;
  }

  private calculateVWAP(candles: Candle[]): number {
    let totalTypicalPriceVolume = 0;
    let totalVolume = 0;

    candles.forEach((c) => {
      const typicalPrice = (c.high + c.low + c.close) / 3;
      totalTypicalPriceVolume += typicalPrice * c.volume;
      totalVolume += c.volume;
    });

    return totalVolume > 0
      ? totalTypicalPriceVolume / totalVolume
      : candles[candles.length - 1]?.close || 0;
  }

  private calculateATR(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number,
  ): number {
    if (closes.length < 2) return 0;

    const trs: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      const h = highs[i];
      const l = lows[i];
      const pc = closes[i - 1];

      const tr1 = h - l;
      const tr2 = Math.abs(h - pc);
      const tr3 = Math.abs(l - pc);

      trs.push(Math.max(tr1, tr2, tr3));
    }

    // Calculate Wilder's smoothing/average for ATR
    if (trs.length === 0) return 0;
    let atr =
      trs.slice(0, period).reduce((sum, v) => sum + v, 0) /
      Math.min(trs.length, period);

    for (let i = period; i < trs.length; i++) {
      atr = (atr * (period - 1) + trs[i]) / period;
    }

    return atr;
  }

  private calculateRSI(closes: number[], period: number): number {
    if (closes.length <= period) return 50; // Default flat momentum bias

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? -change : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  private calculateMACD(
    closes: number[],
    fastPeriod: number,
    slowPeriod: number,
    signalPeriod: number,
  ): { macd: number; signal: number; histogram: number } {
    if (closes.length < slowPeriod) {
      return { macd: 0, signal: 0, histogram: 0 };
    }

    // Build lists of EMAs at every index
    const fastEMAs: number[] = [];
    const slowEMAs: number[] = [];
    const macdLine: number[] = [];

    const kFast = 2 / (fastPeriod + 1);
    const kSlow = 2 / (slowPeriod + 1);

    let currentFast = closes[0];
    let currentSlow = closes[0];

    for (let i = 0; i < closes.length; i++) {
      currentFast = closes[i] * kFast + currentFast * (1 - kFast);
      currentSlow = closes[i] * kSlow + currentSlow * (1 - kSlow);
      fastEMAs.push(currentFast);
      slowEMAs.push(currentSlow);
      macdLine.push(currentFast - currentSlow);
    }

    // Calculate signal line of MACD
    const signalLine: number[] = [];
    const kSignal = 2 / (signalPeriod + 1);
    let currentSignal = macdLine[0];

    for (let i = 0; i < macdLine.length; i++) {
      currentSignal = macdLine[i] * kSignal + currentSignal * (1 - kSignal);
      signalLine.push(currentSignal);
    }

    const lastMacd = macdLine[macdLine.length - 1];
    const lastSignal = signalLine[signalLine.length - 1];

    return {
      macd: lastMacd,
      signal: lastSignal,
      histogram: lastMacd - lastSignal,
    };
  }

  private calculateBollingerBands(
    closes: number[],
    period: number,
    stdDevMultiplier: number,
  ): { upper: number; lower: number; middle: number } {
    const lastIdx = closes.length - 1;
    if (closes.length < period) {
      const price = closes[lastIdx] || 0;
      return { upper: price, lower: price, middle: price };
    }

    const slice = closes.slice(-period);
    const middle = slice.reduce((sum, v) => sum + v, 0) / period;

    const variance =
      slice.reduce((sum, v) => sum + Math.pow(v - middle, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    return {
      middle,
      upper: middle + stdDevMultiplier * stdDev,
      lower: middle - stdDevMultiplier * stdDev,
    };
  }

  private calculateADX(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number,
  ): number {
    if (closes.length <= period * 2) return 20; // default moderate trending benchmark

    const plusDM: number[] = [];
    const minusDM: number[] = [];
    const trs: number[] = [];

    for (let i = 1; i < closes.length; i++) {
      const upMove = highs[i] - highs[i - 1];
      const downMove = lows[i - 1] - lows[i];

      let pdm = 0;
      let mdm = 0;

      if (upMove > downMove && upMove > 0) pdm = upMove;
      if (downMove > upMove && downMove > 0) mdm = downMove;

      plusDM.push(pdm);
      minusDM.push(mdm);

      const tr1 = highs[i] - lows[i];
      const tr2 = Math.abs(highs[i] - closes[i - 1]);
      const tr3 = Math.abs(lows[i] - closes[i - 1]);
      trs.push(Math.max(tr1, tr2, tr3));
    }

    // Wilder's smoothers
    let trSmoothed = trs.slice(0, period).reduce((sum, v) => sum + v, 0);
    let plusDMSmoothed = plusDM.slice(0, period).reduce((sum, v) => sum + v, 0);
    let minusDMSmoothed = minusDM
      .slice(0, period)
      .reduce((sum, v) => sum + v, 0);

    const dxValues: number[] = [];

    for (let i = period; i < trs.length; i++) {
      trSmoothed = trSmoothed - trSmoothed / period + trs[i];
      plusDMSmoothed = plusDMSmoothed - plusDMSmoothed / period + plusDM[i];
      minusDMSmoothed = minusDMSmoothed - minusDMSmoothed / period + minusDM[i];

      const diPlus = trSmoothed > 0 ? (plusDMSmoothed / trSmoothed) * 100 : 0;
      const diMinus = trSmoothed > 0 ? (minusDMSmoothed / trSmoothed) * 100 : 0;

      const sum = diPlus + diMinus;
      const diff = Math.abs(diPlus - diMinus);
      const dx = sum > 0 ? (diff / sum) * 100 : 0;
      dxValues.push(dx);
    }

    if (dxValues.length === 0) return 20;

    // Average the DX indicators to construct the ADX
    let adx =
      dxValues.slice(0, period).reduce((sum, v) => sum + v, 0) /
      Math.min(dxValues.length, period);
    for (let i = period; i < dxValues.length; i++) {
      adx = (adx * (period - 1) + dxValues[i]) / period;
    }

    return adx;
  }

  private calculateOBV(closes: number[], volumes: number[]): number {
    if (closes.length === 0) return 0;
    let obv = 0;

    for (let i = 1; i < closes.length; i++) {
      if (closes[i] > closes[i - 1]) {
        obv += volumes[i];
      } else if (closes[i] < closes[i - 1]) {
        obv -= volumes[i];
      }
    }

    return obv;
  }

  private generateEmptyIndicators(): TechIndicators {
    return {
      emaFast: 0,
      emaSlow: 0,
      atr: 0,
      rsi: 50,
      macd: 0,
      macdSignal: 0,
      macdHist: 0,
      bbUpper: 0,
      bbLower: 0,
      bbMiddle: 0,
      adx: 20,
      obv: 0,
    };
  }
}
