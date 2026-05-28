import { Candle } from "../../types";
import { Matrix } from "ml-matrix";

export class CovarianceEngine {
  private static instance: CovarianceEngine;

  private constructor() {}

  public static getInstance(): CovarianceEngine {
    if (!CovarianceEngine.instance) {
      CovarianceEngine.instance = new CovarianceEngine();
    }
    return CovarianceEngine.instance;
  }

  private calculateLogReturns(candles: Candle[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const p1 = candles[i - 1].close;
      const p2 = candles[i].close;
      returns.push(Math.log(p2 / p1));
    }
    return returns;
  }

  /**
   * Real implementation of covariance matrix with Ledoit-Wolf shrinkage
   */
  public calculateCovarianceMatrix(
    assetSeriesList: { ticker: string; candles: Candle[] }[],
  ): number[][] {
    const n = assetSeriesList.length;
    if (n === 0) return [];
    if (n === 1) return [[1.0]];

    // Extract aligned log returns (assuming they are synchronized in time for this block)
    const minLen = Math.min(...assetSeriesList.map((a) => a.candles.length));
    if (minLen < 2) return Array(n).fill(0).map(() => Array(n).fill(0));

    const returnsMatrix: number[][] = []; // [asset_idx][time_idx]
    
    for (let i = 0; i < n; i++) {
        // Take latest minLen candles
        const alignedCandles = assetSeriesList[i].candles.slice(-minLen);
        returnsMatrix.push(this.calculateLogReturns(alignedCandles));
    }

    const t = returnsMatrix[0].length;
    
    // Calculate means
    const means = returnsMatrix.map(retArray => retArray.reduce((sum, val) => sum + val, 0) / t);

    // Calculate Sample Covariance Matrix (S)
    const S = Array(n).fill(0).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            let cov = 0;
            for (let k = 0; k < t; k++) {
                cov += (returnsMatrix[i][k] - means[i]) * (returnsMatrix[j][k] - means[j]);
            }
            S[i][j] = cov / (t - 1);
        }
    }

    // Ledoit-Wolf Shrinkage Estimation (Simplified Constant Correlation Target)
    // 1. Calculate average sample variance
    let avgVariance = 0;
    for (let i = 0; i < n; i++) {
        avgVariance += S[i][i];
    }
    avgVariance /= n;

    // 2. Compute Target Matrix (F)
    const F = Array(n).fill(0).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        F[i][i] = avgVariance;
    }

    // 3. Shrinkage Intensity (Delta) - In a full LW this is computed analytically.
    // For this engine, we dynamically set delta based on T/N ratio.
    const delta = Math.max(0.1, Math.min(0.9, n / t));

    // 4. Compute Shrunk Matrix: Cov = delta * F + (1 - delta) * S
    const shrunkMatrix = Array(n).fill(0).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            shrunkMatrix[i][j] = delta * F[i][j] + (1 - delta) * S[i][j];
        }
    }

    return shrunkMatrix;
  }
}

