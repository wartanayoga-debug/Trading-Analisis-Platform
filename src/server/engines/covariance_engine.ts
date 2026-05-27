import { Candle } from "../../types";

export class CovarianceEngine {
  private static instance: CovarianceEngine;

  private constructor() {}

  public static getInstance(): CovarianceEngine {
    if (!CovarianceEngine.instance) {
      CovarianceEngine.instance = new CovarianceEngine();
    }
    return CovarianceEngine.instance;
  }

  /**
   * Mock implementation of a covariance matrix calculator
   */
  public calculateCovarianceMatrix(
    assetSeriesList: { ticker: string; candles: Candle[] }[],
  ): number[][] {
    const n = assetSeriesList.length;
    let matrix: number[][] = Array(n)
      .fill(0)
      .map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        // Mock covariance calculation
        if (i === j) {
          matrix[i][j] = 1.0; // Self-variance normalized
        } else {
          // Simulated covariance between -1 to 1 based on ticker strings difference
          const diff =
            Math.abs(
              assetSeriesList[i].ticker.length -
                assetSeriesList[j].ticker.length,
            ) * 0.1;
          matrix[i][j] = Math.max(-1, 0.8 - diff);
        }
      }
    }
    return matrix;
  }
}
