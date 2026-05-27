/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Candle, TechIndicators, RiskMetrics, AssetClass } from "../../types";

export class RiskEngine {
  private static instance: RiskEngine;

  private constructor() {}

  public static getInstance(): RiskEngine {
    if (!RiskEngine.instance) {
      RiskEngine.instance = new RiskEngine();
    }
    return RiskEngine.instance;
  }

  /**
   * Primary entry: Computes strict institutional risk assessment metrics
   */
  public evaluateRisk(
    candles: Candle[],
    indicators: TechIndicators,
    assetClass: AssetClass,
  ): RiskMetrics {
    if (candles.length < 10) {
      return this.generateEmptyRisk();
    }

    const last = candles[candles.length - 1];

    // 1. Calculate Volatility score [0, 100]
    const volatilityScore = this.calculateVolatilityIndex(candles, indicators);

    // 2. Calculate Liquidity depth index [0, 100]
    const liquidityScore = this.calculateLiquidityScore(candles, assetClass);

    // 3. Assess Manipulation Risk
    const manipulationWarning = this.detectManipulationSignatures(
      candles,
      indicators,
    );

    // 4. Fake Breakout identification
    const fakeBreakoutRisk = this.evaluateBreakoutTraps(candles, indicators);

    // 5. Build dynamic Entry Zone, Stop Loss, and Take Profit targets
    const executionZones = this.computeAdaptiveTradingBands(
      last.close,
      indicators,
      assetClass,
    );

    // 6. Synthesize final composite Risk Score
    const riskScore = this.synthesizeCompositeRisk(
      volatilityScore,
      liquidityScore,
      manipulationWarning,
      fakeBreakoutRisk,
      indicators,
    );

    return {
      volatilityScore: Math.round(volatilityScore),
      liquidityScore: Math.round(liquidityScore),
      riskScore: Math.round(riskScore),
      rrRatio: executionZones.rrRatio,
      manipulationWarning,
      fakeBreakoutRisk,
      entryZone: executionZones.entryZone,
      stopLoss: executionZones.stopLoss,
      takeProfit: executionZones.takeProfit,
      invalidationLevel: executionZones.invalidationLevel,
    };
  }

  /**
   * Evaluates historical price variance against ATR to output volatility score
   */
  private calculateVolatilityIndex(
    candles: Candle[],
    indicators: TechIndicators,
  ): number {
    const last = candles[candles.length - 1];
    const atrRatio = (indicators.atr / last.close) * 100; // raw ATR percentage

    // Compute closing variance over trailing 15 bars
    const slice = candles.slice(-15);
    const mean = slice.reduce((sum, c) => sum + c.close, 0) / slice.length;
    const stdDev = Math.sqrt(
      slice.reduce((sum, c) => sum + Math.pow(c.close - mean, 2), 0) /
        slice.length,
    );
    const varianceRatio = (stdDev / mean) * 100;

    // Compile volatility raw index
    let volScore = atrRatio * 40 + varianceRatio * 20;
    volScore = Math.max(10, Math.min(100, volScore));

    return volScore;
  }

  /**
   * Computes liquidity depth logs relative to asset class norms
   */
  private calculateLiquidityScore(
    candles: Candle[],
    assetClass: AssetClass,
  ): number {
    const slice = candles.slice(-15);
    const averageVolume =
      slice.reduce((sum, c) => sum + c.volume, 0) / slice.length;

    let score = 50;

    if (assetClass === "IDX") {
      // Scale standard IDX volume thresholds
      score = Math.log10(Math.max(1, averageVolume)) * 12.5; // E.g., volume 10,000,000 maps to 87.5
    } else {
      // Scale Crypto metrics
      score = Math.log10(Math.max(1, averageVolume)) * 15; // Log Crypto volume models
    }

    return Math.max(10, Math.min(100, score));
  }

  /**
   * Scans price shadow spikes and artificial transactions to flag pump-and-dump signs
   */
  private detectManipulationSignatures(
    candles: Candle[],
    indicators: TechIndicators,
  ): boolean {
    const last = candles[candles.length - 1];

    const slice = candles.slice(-12);
    const avgVolume =
      slice.reduce((sum, c) => sum + c.volume, 0) / slice.length;

    // Condition A: Extreme volume spike
    const volAnomalous = last.volume > avgVolume * 6;

    // Condition B: High upper shadow with weak delta close (abnormal dump rejection)
    const body = Math.abs(last.close - last.open);
    const totalRange = last.high - last.low || 1;
    const upperShadow = last.high - Math.max(last.open, last.close);
    const excessiveUpperShadow =
      upperShadow / totalRange > 0.82 && totalRange > indicators.atr * 1.5;

    return volAnomalous || excessiveUpperShadow;
  }

  /**
   * Checks for fake breakout risk near Bollinger boundaries
   */
  private evaluateBreakoutTraps(
    candles: Candle[],
    indicators: TechIndicators,
  ): boolean {
    const last = candles[candles.length - 1];

    // Trapped: Closing above the Bollinger upper band but RSI showing absolute divergence/exhaustion (>74)
    const isExhaustedBullBreakout =
      last.close > indicators.bbUpper && indicators.rsi > 74;
    const isWeakBearBreakout =
      last.close < indicators.bbLower && indicators.rsi < 26;

    return isExhaustedBullBreakout || isWeakBearBreakout;
  }

  /**
   * Adaptive ATR stop positioning and target modeling structured for Scalping (Profit: >2% to <5%)
   */
  private computeAdaptiveTradingBands(
    close: number,
    indicators: TechIndicators,
    assetClass: AssetClass,
  ) {
    // Determine dynamic exit buffers matching institutional scalping guidelines (Target: >2% - <5% profit)
    const atrPercent = (indicators.atr / close) * 100;

    // Dynamic target percent based on ATR but strictly bounded between 2.2% and 4.8%
    const targetProfitPercent = Math.max(
      2.2,
      Math.min(4.8, atrPercent * 1.6 || 3.0),
    );

    const takeProfit = close * (1 + targetProfitPercent / 100);

    // Stop loss maintains institutional risk-to-reward ratio (e.g., 1:2.0 reward multiple)
    // Meaning risk is half of the target reward.
    const riskPercent = targetProfitPercent / 2.0;
    const stopLoss = close * (1 - riskPercent / 100);

    // Invalidation Level is placed slightly below the protective stop loss
    const invalidationLevel = stopLoss * 0.996;

    const entryZone = {
      min: close * (1 - (riskPercent * 0.15) / 100),
      max: close * (1 + (riskPercent * 0.1) / 100),
    };

    return {
      stopLoss,
      takeProfit,
      invalidationLevel,
      rrRatio: 2.0, // Risk-to-Reward ratio multiple
      entryZone,
    };
  }

  /**
   * Synthesizes volatility, thin volumes, and alerts into a composite Risk rating
   */
  private synthesizeCompositeRisk(
    volatility: number,
    liquidity: number,
    manipulation: boolean,
    trap: boolean,
    indicators: TechIndicators,
  ): number {
    let composite = 30; // base floor

    // Volatility enhances risk
    composite += (volatility - 30) * 0.4;

    // Low liquidity enhances risk
    composite += (100 - liquidity) * 0.35;

    // Warnings and traps are massive risk accelerators
    if (manipulation) composite += 25;
    if (trap) composite += 15;

    // RSI extreme adjustments
    if (indicators.rsi > 80 || indicators.rsi < 20) {
      composite += 10;
    }

    return Math.max(5, Math.min(100, composite));
  }

  private generateEmptyRisk(): RiskMetrics {
    return {
      volatilityScore: 50,
      liquidityScore: 50,
      riskScore: 50,
      rrRatio: 2.0,
      manipulationWarning: false,
      fakeBreakoutRisk: false,
      entryZone: { min: 0, max: 0 },
      stopLoss: 0,
      takeProfit: 0,
      invalidationLevel: 0,
    };
  }
}
