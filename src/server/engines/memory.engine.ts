/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HistoricalPrediction, ScannerAsset } from "../../types";
import { LocalDatabase } from "../utils/db";

export class MemoryLearningEngine {
  private static instance: MemoryLearningEngine;
  private db = LocalDatabase.getInstance();

  private constructor() {}

  public static getInstance(): MemoryLearningEngine {
    if (!MemoryLearningEngine.instance) {
      MemoryLearningEngine.instance = new MemoryLearningEngine();
    }
    return MemoryLearningEngine.instance;
  }

  /**
   * Commits current active scanned asset predictions to the local localized database
   */
  public logScannedPredictions(scannedAssets: ScannerAsset[]) {
    const predictions = this.db.getPredictions();

    scannedAssets.forEach((asset) => {
      // Avoid duplication of open predictions for same asset
      const openIndex = predictions.findIndex(
        (p) => p.ticker === asset.ticker && p.success === undefined,
      );

      if (openIndex === -1) {
        const hPred: HistoricalPrediction = {
          id: `${asset.ticker}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          timestamp: new Date().toISOString(),
          ticker: asset.ticker,
          assetClass: asset.assetClass,
          predictedProbability: asset.probability,
          predictedDirection: asset.trendDirection,
          initialPrice: asset.price,
          confidence: asset.confidence,
          marketRegime: asset.marketRegime,
        };

        this.db.addPrediction(hPred);
        console.log(
          `[MemoryLearningEngine] Added prediction audit entry for Ticker: ${asset.ticker}`,
        );
      }
    });
  }

  /**
   * Evaluates predictions walk-forward realizations to self-adapt confidence scaling coefficients
   */
  public async executeCalibrationAudit(): Promise<{
    newlyAuditedCount: number;
    globalAccuracy: number;
  }> {
    const predictions = this.db.getPredictions();
    const openPredictions = predictions.filter((p) => p.success === undefined);
    let newlyAuditedCount = 0;

    // We import Data Engine here to fetch real future candles to avoid circular dependency
    const MarketDataEngine = require("./data.engine").MarketDataEngine;
    const dataEngine = MarketDataEngine.getInstance();

    for (const pred of openPredictions) {
      try {
        // Real PnL Calculated (Future Candle Arrives)
        const recentCandles = await dataEngine.getHistory(
          pred.ticker,
          pred.assetClass,
          "1h",
          2,
        );
        if (recentCandles.length > 0) {
          const currentClose = recentCandles[recentCandles.length - 1].close;
          const realizationPercent =
            ((currentClose - pred.initialPrice) / pred.initialPrice) * 100;

          // Score prediction
          const wasBullish = pred.predictedDirection === "BULLISH";
          const actualSuccess =
            (wasBullish && realizationPercent >= 0.5) ||
            (!wasBullish && realizationPercent <= -0.5);

          this.db.updatePrediction(pred.id, {
            actualPrice: currentClose,
            realizedPercent: Number(realizationPercent.toFixed(2)),
            success: actualSuccess,
            auditedAt: new Date().toISOString(),
          });
          newlyAuditedCount++;
        }
      } catch (err) {
        console.warn(`[Memory Engine] Audit missing data for ${pred.ticker}`);
      }
    }

    const refreshedCalibration = this.db.getCalibration();

    return {
      newlyAuditedCount,
      globalAccuracy:
        refreshedCalibration.globalAccuracyTracker.overallAccuracy,
    };
  }

  /**
   * Probability Calibration implementation using approximate Platt Scaling logic
   * Applies empirical success rate moving averages to raw logistic outputs.
   */
  public applyCalibrationBias(
    rawProbability: number,
    assetClass: "IDX" | "CRYPTO",
  ): number {
    const calibration = this.db.getCalibration();
    const empiricalAccuracy = calibration.globalAccuracyTracker.overallAccuracy;

    // Platt Scaling approximation: P(y=1|f) = 1 / (1 + exp(A * f(x) + B))
    // We dynamically shift the sigmoid (A, B) based on historical empirical accuracy
    // If accuracy is low, model is miscalibrated, pull predictions closer to 0.5 (Maximum Uncertainty)

    // Empirical baseline (prior)
    const prior = empiricalAccuracy > 0 ? empiricalAccuracy : 0.5;

    // A heuristic parameter mapping historical confidence to scale shifting
    const A = -1.5; // Slope
    const B = Math.log((1 - prior) / prior) * 0.5; // Intercept shift

    // Reverse logistic on raw to get f(x)
    const fx = Math.log(rawProbability / (1 - rawProbability + 0.0001));

    // Apply Platt Scaling
    const plattProbability = 1 / (1 + Math.exp(A * fx + B));

    return Math.max(0.01, Math.min(0.99, plattProbability));
  }
}
