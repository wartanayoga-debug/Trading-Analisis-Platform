/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ScannerAsset, AssetClass, Candle, TechIndicators } from "../../types";
import { TradingAgentOrchestrator } from "./agent.orchestrator";

export class MarketScannerEngine {
  private static instance: MarketScannerEngine;
  private agentOrchestrator = TradingAgentOrchestrator.getInstance();

  private constructor() {}

  public static getInstance(): MarketScannerEngine {
    if (!MarketScannerEngine.instance) {
      MarketScannerEngine.instance = new MarketScannerEngine();
    }
    return MarketScannerEngine.instance;
  }

  /**
   * Scans an array of assets asynchronously on a non-blocking background task runner using Multi-Agent Graph
   */
  public async scanAssets(
    assets: Array<{
      ticker: string;
      name: string;
      assetClass: AssetClass;
      sector?: string;
    }>,
    timeframe = "1h",
  ): Promise<ScannerAsset[]> {
    const results: ScannerAsset[] = [];
    const BATCH_SIZE = 15;
    const BATCH_DELAY_MS = 60;

    for (let i = 0; i < assets.length; i += BATCH_SIZE) {
      const batch = assets.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (asset) => {
        try {
          // Dispatch asset to LangGraph multi-agent orchestrator
          const finalAsset = await this.agentOrchestrator.executeGraph(
            asset,
            timeframe,
          );
          return finalAsset;
        } catch (err) {
          console.error(
            `[Scanner] Agent Orchestrator failure for ${asset.ticker}:`,
            err,
          );
          return null;
        }
      });

      const chunkResults = await Promise.all(promises);
      for (const res of chunkResults) {
        if (res !== null) {
          results.push(res);
        }
      }

      if (i + BATCH_SIZE < assets.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    return this.rankAssets(results);
  }

  public rankAssets(assets: ScannerAsset[]): ScannerAsset[] {
    return assets.sort((a, b) => {
      const scoreA = this.calculateInstitutionalScore(a);
      const scoreB = this.calculateInstitutionalScore(b);
      return scoreB - scoreA;
    });
  }

  private calculateInstitutionalScore(asset: ScannerAsset): number {
    const probability = asset.probability;
    const momentum = asset.momentumScore / 100;
    const liquidity = asset.liquidityScore / 100;
    const sentiment = (asset.sentimentScore + 1) / 2;

    let regimeStability = 0.5;
    if (
      asset.marketRegime === "Trending Up" ||
      asset.marketRegime === "Accumulation"
    )
      regimeStability = 0.8;
    if (asset.marketRegime === "Panic Rejection") regimeStability = 0.1;

    const rrScore = asset.rrRatio / 5;

    const numerator =
      probability +
      momentum * 0.8 +
      liquidity * 0.6 +
      sentiment * 0.4 +
      regimeStability * 0.7 +
      rrScore * 0.9;

    const volatilityRisk = Math.max(0.1, asset.volatilityScore / 100);
    const coreRisk = Math.max(0.1, asset.riskScore / 100);

    const denominator = volatilityRisk * coreRisk;

    return numerator / Math.max(0.01, denominator);
  }
}
