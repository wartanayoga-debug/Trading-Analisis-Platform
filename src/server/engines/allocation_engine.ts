import { PortfolioIntelligence } from "./portfolio_intelligence";
import { CovarianceEngine } from "./covariance_engine";
import { ScannerAsset } from "../../types";

export class RegimeAwareAllocator {
  private static instance: RegimeAwareAllocator;

  private constructor() {}

  public static getInstance(): RegimeAwareAllocator {
    if (!RegimeAwareAllocator.instance) {
      RegimeAwareAllocator.instance = new RegimeAwareAllocator();
    }
    return RegimeAwareAllocator.instance;
  }

  public allocate(
    assets: ScannerAsset[],
    currentRegime: string,
  ): Map<string, number> {
    const allocation = new Map<string, number>();

    // Simple regime-aware heuristic
    const isRiskOn =
      currentRegime.toUpperCase().includes("BULL") ||
      currentRegime.toUpperCase().includes("RISK-ON");

    assets.forEach((asset) => {
      let weight = 1.0 / assets.length;

      // Overweight crypto in risk-on, underweight in risk-off
      if (asset.assetClass === "CRYPTO") {
        weight *= isRiskOn ? 1.5 : 0.5;
      } else {
        weight *= isRiskOn ? 0.8 : 1.2;
      }

      allocation.set(asset.ticker, weight);
    });

    // Normalize weights to sum to 1.0
    let total = 0;
    allocation.forEach((w) => (total += w));
    allocation.forEach((w, ticker) => allocation.set(ticker, w / total));

    return allocation;
  }
}
