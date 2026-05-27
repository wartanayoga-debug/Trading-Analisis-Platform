import { AssetClass } from "../../types";

export class RealCalibrationEngine {
  private static instance: RealCalibrationEngine;
  private brierScores: Map<string, number> = new Map();
  // Learned weights for Platt Scaling: y = 1 / (1 + exp(-(beta * x + alpha)))
  private learnedWeights: Map<string, { alpha: number; beta: number }> = new Map();

  private constructor() {
    this.learnedWeights.set("CRYPTO", { alpha: 0.0, beta: 1.0 });
    this.learnedWeights.set("IDX", { alpha: 0.0, beta: 1.0 });
    this.learnedWeights.set("GLOBAL", { alpha: 0.0, beta: 1.0 });
  }

  public static getInstance(): RealCalibrationEngine {
    if (!RealCalibrationEngine.instance) {
      RealCalibrationEngine.instance = new RealCalibrationEngine();
    }
    return RealCalibrationEngine.instance;
  }

  /**
   * Applies Platt Scaling logic to calibrate raw model probabilities
   * Now uses iteratively learned weights from past predictions
   */
  public calibrateProbability(
    rawProb: number,
    assetClass: AssetClass,
    volatility: number,
  ): number {
    const weights = this.learnedWeights.get(assetClass) || { alpha: 0.0, beta: 1.0 };
    
    // Convert raw probability to log-odds
    // Handle edge cases to prevent infinity
    const safeProb = Math.max(0.001, Math.min(0.999, rawProb));
    const logOdds = Math.log(safeProb / (1 - safeProb));

    // Dynamic Volatility Penalty
    // High volatility dilutes the logistic slope (beta) making models less confident
    const volatilityPenalty = Math.max(0.5, 1.0 - (volatility / 200)); 
    const adjustedBeta = weights.beta * volatilityPenalty;

    // Apply learned affine transformation
    const fAdjusted = adjustedBeta * logOdds + weights.alpha;

    // Convert back to probability
    const calibrated = 1 / (1 + Math.exp(-fAdjusted));

    // Bounds checking
    return Math.max(0.01, Math.min(0.99, calibrated));
  }

  /**
   * Learn from new realizations: SGD update for Platt Scaling logic
   */
  public updateBrierScore(
    assetClass: AssetClass,
    predictedProb: number,
    actualOutcome: 1 | 0,
  ): void {
    // 1. Maintain Brier Score EMA
    const error = Math.pow(predictedProb - actualOutcome, 2);
    const existing = this.brierScores.get(assetClass) || 0.25;
    const updated = existing * 0.9 + error * 0.1;
    this.brierScores.set(assetClass, updated);

    // 2. Perform one step of Gradient Descent to learn Platt Scaling parameters
    const weights = this.learnedWeights.get(assetClass) || { alpha: 0.0, beta: 1.0 };
    const lr = 0.01; // Learning rate

    const safeProb = Math.max(0.001, Math.min(0.999, predictedProb));
    const logOdds = Math.log(safeProb / (1 - safeProb));
    
    // y_hat is the calibrated prediction we would have made
    const f = weights.beta * logOdds + weights.alpha;
    const p_calibrated = 1 / (1 + Math.exp(-f));

    // Gradient of binary cross-entropy with respect to f is (p_calibrated - actualOutcome)
    const gradientF = p_calibrated - actualOutcome;

    // Chain rule for alpha and beta
    const gradAlpha = gradientF;
    const gradBeta = gradientF * logOdds;

    weights.alpha -= lr * gradAlpha;
    weights.beta -= lr * gradBeta;

    // Constrain beta to be positive to preserve directionality
    weights.beta = Math.max(0.1, weights.beta);

    this.learnedWeights.set(assetClass, weights);
    console.log(`[Calibration Engine] Updated Learned Parameters for ${assetClass}: alpha=${weights.alpha.toFixed(3)} beta=${weights.beta.toFixed(3)} | Brier: ${updated.toFixed(3)}`);
  }

  public getSystemBrierScore(assetClass: AssetClass): number {
    return this.brierScores.get(assetClass) || 0;
  }
}

