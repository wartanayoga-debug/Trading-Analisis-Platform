import { AssetClass } from "../../types";

export class RealCalibrationEngine {
  private static instance: RealCalibrationEngine;
  private brierScores: Map<string, number> = new Map();

  private constructor() {}

  public static getInstance(): RealCalibrationEngine {
    if (!RealCalibrationEngine.instance) {
      RealCalibrationEngine.instance = new RealCalibrationEngine();
    }
    return RealCalibrationEngine.instance;
  }

  /**
   * Applies Platt Scaling logic to calibrate raw model probabilities
   */
  public calibrateProbability(
    rawProb: number,
    assetClass: AssetClass,
    volatility: number,
  ): number {
    // Simulated Platt Scaling
    const beta = assetClass === "CRYPTO" ? 1.2 : 0.9;
    const alpha = volatility > 50 ? -0.1 : 0.05;

    const calibrated = 1 / (1 + Math.exp(-(beta * (rawProb - 0.5) + alpha)));

    // Bounds checking
    return Math.max(0.01, Math.min(0.99, calibrated));
  }

  public updateBrierScore(
    assetClass: AssetClass,
    predictedProb: number,
    actualOutcome: 1 | 0,
  ): void {
    const error = Math.pow(predictedProb - actualOutcome, 2);
    const existing = this.brierScores.get(assetClass) || 0;

    // Exponential moving average of Brier Score
    const updated = existing === 0 ? error : existing * 0.9 + error * 0.1;
    this.brierScores.set(assetClass, updated);
  }

  public getSystemBrierScore(assetClass: AssetClass): number {
    return this.brierScores.get(assetClass) || 0;
  }
}
