import { ScannerAsset, Candle } from "../../types";

export class PortfolioIntelligence {
  private static instance: PortfolioIntelligence;

  private constructor() {}

  public static getInstance(): PortfolioIntelligence {
    if (!PortfolioIntelligence.instance) {
      PortfolioIntelligence.instance = new PortfolioIntelligence();
    }
    return PortfolioIntelligence.instance;
  }

  /**
   * Institutional Log Returns calculation
   * r_t = ln(P_t / P_{t-1})
   */
  public static calculateLogReturns(prices: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push(Math.log(prices[i] / prices[i - 1]));
    }
    return returns;
  }

  /**
   * Realized Volatility calculation
   * RV_t = sqrt(Σ(r_i^2)) * sqrt(Periods)
   */
  public static calculateRealizedVolatility(returns: number[], annualizeFactor: number = 252): number {
    if (returns.length === 0) return 0;
    const sumSq = returns.reduce((acc, val) => acc + (val * val), 0);
    const variance = sumSq / returns.length;
    return Math.sqrt(variance) * Math.sqrt(annualizeFactor);
  }

  /**
   * Risk Parity Allocation
   * w_i ∝ 1 / σ_i
   */
  public calculateRiskParityAllocation(assetsWithVol: {ticker: string, realizedVol: number}[]): Map<string, number> {
    const allocation = new Map<string, number>();
    let sumInverseVol = 0;

    // Filter out assets with zero volatility to avoid division by zero
    const validAssets = assetsWithVol.filter(a => a.realizedVol > 0);

    validAssets.forEach(a => {
      sumInverseVol += (1 / a.realizedVol);
    });

    if (sumInverseVol === 0) return allocation;

    validAssets.forEach(a => {
      const weight = (1 / a.realizedVol) / sumInverseVol;
      allocation.set(a.ticker, weight);
    });

    return allocation;
  }

  /**
   * Volatility Targeting
   * Leverage_t = TargetVol / RealizedVol_t
   */
  public calculateVolatilityTargetingLeverage(realizedVol: number, targetVol: number = 0.15): number {
    if (realizedVol === 0) return 1.0;
    // Institutional max leverage cap (e.g., 3.0x) to avoid reckless leverage
    return Math.min(3.0, targetVol / realizedVol);
  }

  /**
   * Sharpe Ratio calculation
   * Sharpe = (R_p - R_f) / σ_p
   */
  public static calculateSharpeRatio(portfolioReturn: number, portfolioVol: number, riskFreeRate: number = 0.05): number {
    if (portfolioVol === 0) return 0;
    return (portfolioReturn - riskFreeRate) / portfolioVol;
  }

  /**
   * Helper to evaluate metrics for a portfolio
   */
  public analyzePortfolio(assets: ScannerAsset[]): any {
    const sectors = assets.reduce(
      (acc, curr) => {
        const sec = curr.sector || "Uncategorized";
        acc[sec] = (acc[sec] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Realistic proxy for asset vols without fake Math.random()
    // For production this should integrate with CovarianceEngine using historical candle returns
    const estimatedVols = assets.map(a => ({
       ticker: a.ticker,
       realizedVol: 0.15 // deterministic structural baseline pending full historical engine integration
    }));
    const riskParityWeights = this.calculateRiskParityAllocation(estimatedVols);
    
    return {
      totalAssets: assets.length,
      sectorConcentration: sectors,
      riskParityAllocation: Object.fromEntries(riskParityWeights),
      overallRisk: "MODERATE",
    };
  }
}

