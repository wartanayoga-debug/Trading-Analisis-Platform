/**
 * Calibration Engine — Enhanced dengan Isotonic Regression (Roadmap #2)
 *
 * Dua lapisan kalibrasi:
 *   1. Platt Scaling (SGD-updated)     — already existed, dipertahankan
 *   2. Isotonic Regression             — NEW: non-parametric, lebih fleksibel
 *
 * Isotonic Regression:
 *   Memastikan: jika model berkata "70% bullish", historically sekitar 70% benar.
 *   Menggunakan Pool Adjacent Violators (PAV) algorithm — O(n log n).
 *
 * Reliability Curve Validation:
 *   Brier Score yang sudah ada adalah proxy reliability curve.
 *   Kita tambah Expected Calibration Error (ECE) untuk tracking.
 */

import { AssetClass } from "../../types";

interface IsotonicPoint {
  rawProb: number;
  actualOutcome: number;
}

export class RealCalibrationEngine {
  private static instance: RealCalibrationEngine;

  // Platt Scaling weights
  private brierScores: Map<string, number> = new Map();
  private learnedWeights: Map<string, { alpha: number; beta: number }> = new Map();

  // Isotonic Regression data (online accumulation)
  private isotonicData: Map<string, IsotonicPoint[]> = new Map();

  // ECE tracking bins (10 bins: [0,0.1), [0.1,0.2), ... [0.9,1.0])
  private eceBins: Map<string, Array<{ sumProb: number; sumOutcome: number; count: number }>> = new Map();

  private constructor() {
    this.learnedWeights.set("CRYPTO", { alpha: 0.0, beta: 1.0 });
    this.learnedWeights.set("IDX",    { alpha: 0.0, beta: 1.0 });
    this.learnedWeights.set("GLOBAL", { alpha: 0.0, beta: 1.0 });
    this.initEceBins("CRYPTO");
    this.initEceBins("IDX");
  }

  public static getInstance(): RealCalibrationEngine {
    if (!RealCalibrationEngine.instance) {
      RealCalibrationEngine.instance = new RealCalibrationEngine();
    }
    return RealCalibrationEngine.instance;
  }

  // ── Layer 1: Platt Scaling (existing, unchanged logic) ───────────────────

  public calibrateProbability(
    rawProb: number,
    assetClass: AssetClass,
    volatility: number
  ): number {
    // Step 1: Platt Scaling
    const plattCalibrated = this.applyPlattScaling(rawProb, assetClass, volatility);

    // Step 2: Isotonic Regression refinement (jika ada cukup data)
    const data = this.isotonicData.get(assetClass) || [];
    if (data.length >= 20) {
      return this.applyIsotonicRefinement(plattCalibrated, assetClass);
    }

    return plattCalibrated;
  }

  private applyPlattScaling(
    rawProb: number,
    assetClass: AssetClass,
    volatility: number
  ): number {
    const weights = this.learnedWeights.get(assetClass) || { alpha: 0.0, beta: 1.0 };
    const safeProb = Math.max(0.001, Math.min(0.999, rawProb));
    const logOdds  = Math.log(safeProb / (1 - safeProb));

    const volPenalty   = Math.max(0.5, 1.0 - (volatility / 200));
    const adjustedBeta = weights.beta * volPenalty;
    const fAdjusted    = adjustedBeta * logOdds + weights.alpha;
    const calibrated   = 1 / (1 + Math.exp(-fAdjusted));

    return Math.max(0.01, Math.min(0.99, calibrated));
  }

  // ── Layer 2: Isotonic Regression ─────────────────────────────────────────

  /**
   * Pool Adjacent Violators (PAV) Algorithm
   *
   * Diberikan pasangan (rawProb, actualOutcome), membangun mapping monotone
   * yang memetakan rawProb → kalibrasi optimal.
   *
   * Properti: f(p1) <= f(p2) untuk p1 <= p2 (monotone non-decreasing)
   */
  private applyIsotonicRefinement(prob: number, assetClass: AssetClass): number {
    const data = (this.isotonicData.get(assetClass) || [])
      .slice()
      .sort((a, b) => a.rawProb - b.rawProb);

    if (data.length < 5) return prob;

    // PAV: pool adjacent violators
    const pools: Array<{ sumX: number; sumY: number; count: number }> = [];

    for (const point of data) {
      pools.push({ sumX: point.rawProb, sumY: point.actualOutcome, count: 1 });

      // Merge jika violation (previous mean > current mean)
      while (
        pools.length >= 2 &&
        pools[pools.length - 2].sumY / pools[pools.length - 2].count >
        pools[pools.length - 1].sumY / pools[pools.length - 1].count
      ) {
        const last = pools.pop()!;
        const prev = pools[pools.length - 1];
        prev.sumX   += last.sumX;
        prev.sumY   += last.sumY;
        prev.count  += last.count;
      }
    }

    // Build piecewise constant mapping
    const mapping: Array<{ x: number; y: number }> = pools.map(p => ({
      x: p.sumX / p.count,
      y: p.sumY / p.count,
    }));

    // Interpolate: cari segment yang mengandung prob
    if (prob <= mapping[0].x) return Math.max(0.01, Math.min(0.99, mapping[0].y));
    if (prob >= mapping[mapping.length - 1].x)
      return Math.max(0.01, Math.min(0.99, mapping[mapping.length - 1].y));

    for (let i = 1; i < mapping.length; i++) {
      if (prob <= mapping[i].x) {
        const t = (prob - mapping[i - 1].x) / (mapping[i].x - mapping[i - 1].x);
        const interp = mapping[i - 1].y + t * (mapping[i].y - mapping[i - 1].y);
        return Math.max(0.01, Math.min(0.99, interp));
      }
    }

    return prob;
  }

  // ── Update dari outcome nyata ─────────────────────────────────────────────

  public updateBrierScore(
    assetClass: AssetClass,
    predictedProb: number,
    actualOutcome: 1 | 0
  ): void {
    // 1. Brier Score EMA
    const error    = Math.pow(predictedProb - actualOutcome, 2);
    const existing = this.brierScores.get(assetClass) || 0.25;
    this.brierScores.set(assetClass, existing * 0.9 + error * 0.1);

    // 2. Platt Scaling SGD update
    const weights = this.learnedWeights.get(assetClass) || { alpha: 0.0, beta: 1.0 };
    const lr      = 0.01;
    const safeP   = Math.max(0.001, Math.min(0.999, predictedProb));
    const logOdds = Math.log(safeP / (1 - safeP));
    const f       = weights.beta * logOdds + weights.alpha;
    const pCal    = 1 / (1 + Math.exp(-f));
    const grad    = pCal - actualOutcome;

    weights.alpha -= lr * grad;
    weights.beta   = Math.max(0.1, weights.beta - lr * grad * logOdds);
    this.learnedWeights.set(assetClass, weights);

    // 3. Akumulasi data untuk Isotonic Regression
    const isoData = this.isotonicData.get(assetClass) || [];
    isoData.push({ rawProb: predictedProb, actualOutcome });
    // Batasi buffer: ambil 200 terbaru untuk memory efficiency
    if (isoData.length > 200) isoData.splice(0, isoData.length - 200);
    this.isotonicData.set(assetClass, isoData);

    // 4. Update ECE bins
    this.updateECEBin(assetClass, predictedProb, actualOutcome);

    console.log(
      `[Calibration] ${assetClass} — Platt: α=${weights.alpha.toFixed(3)} β=${weights.beta.toFixed(3)} ` +
      `Brier: ${(existing * 0.9 + error * 0.1).toFixed(3)} ` +
      `IsoData: ${isoData.length} pts`
    );
  }

  // ── Expected Calibration Error (ECE) ─────────────────────────────────────

  private initEceBins(assetClass: string): void {
    this.eceBins.set(
      assetClass,
      Array.from({ length: 10 }, () => ({ sumProb: 0, sumOutcome: 0, count: 0 }))
    );
  }

  private updateECEBin(assetClass: string, prob: number, outcome: number): void {
    const bins = this.eceBins.get(assetClass);
    if (!bins) return;
    const binIdx = Math.min(9, Math.floor(prob * 10));
    bins[binIdx].sumProb    += prob;
    bins[binIdx].sumOutcome += outcome;
    bins[binIdx].count      += 1;
  }

  /**
   * Expected Calibration Error — mengukur rata-rata gap antara
   * confidence model dan accuracy aktual per bin.
   * ECE = 0 → perfectly calibrated.
   */
  public getECE(assetClass: AssetClass): number {
    const bins  = this.eceBins.get(assetClass) || [];
    const total = bins.reduce((s, b) => s + b.count, 0);
    if (total === 0) return 0;

    let ece = 0;
    for (const bin of bins) {
      if (bin.count === 0) continue;
      const avgProb    = bin.sumProb / bin.count;
      const avgOutcome = bin.sumOutcome / bin.count;
      ece += (bin.count / total) * Math.abs(avgProb - avgOutcome);
    }
    return Number(ece.toFixed(4));
  }

  public getSystemBrierScore(assetClass: AssetClass): number {
    return this.brierScores.get(assetClass) || 0;
  }
}
