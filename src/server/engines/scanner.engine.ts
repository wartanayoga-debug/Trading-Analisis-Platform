/**
 * Market Scanner Engine — Enhanced with Roadmap #6 Institutional Scanner Score
 *
 * Formula dari roadmap:
 *   ScannerScore = 0.3*Probability + 0.2*RelativeStrength + 0.2*VolumeExpansion
 *                + 0.15*TrendStrength + 0.15*LiquidityScore
 *
 * Tambahan:
 *   - Sector Rotation Detection
 *   - Momentum Clustering (top-tier vs bottom-tier)
 *   - Volatility Expansion Scan
 *   - Breakout Compression Detection
 */

import { ScannerAsset, AssetClass } from "../../types";
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

  public async scanAssets(
    assets: Array<{ ticker: string; name: string; assetClass: AssetClass; sector?: string }>,
    timeframe = "1h"
  ): Promise<ScannerAsset[]> {
    const results: ScannerAsset[] = [];
    const BATCH_SIZE    = 15;
    const BATCH_DELAY   = 60;

    for (let i = 0; i < assets.length; i += BATCH_SIZE) {
      const batch    = assets.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (asset) => {
        try {
          return await this.agentOrchestrator.executeGraph(asset, timeframe);
        } catch (err) {
          console.error(`[Scanner] Failure for ${asset.ticker}:`, err);
          return null;
        }
      });

      const chunk = await Promise.all(promises);
      for (const res of chunk) {
        if (res !== null) results.push(res);
      }

      if (i + BATCH_SIZE < assets.length) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY));
      }
    }

    return this.rankAssets(results);
  }

  public rankAssets(assets: ScannerAsset[]): ScannerAsset[] {
    // Hitung scannerScore untuk setiap aset
    const scored = assets.map((a) => ({
      ...a,
      scannerScore: this.calculateScannerScore(a),
    }));

    // Sort descending by scannerScore
    scored.sort((a, b) => (b.scannerScore ?? 0) - (a.scannerScore ?? 0));

    return scored;
  }

  // ── Roadmap #6: ScannerScore ───────────────────────────────────────────────

  /**
   * ScannerScore = 0.30 * Probability
   *              + 0.20 * RelativeStrength (normalized)
   *              + 0.20 * VolumeExpansion
   *              + 0.15 * TrendStrength
   *              + 0.15 * LiquidityScore
   *
   * Semua komponen di-normalise ke [0, 1] sebelum diberi bobot.
   */
  private calculateScannerScore(asset: ScannerAsset): number {
    // ── Komponen 1: Probability (sudah [0,1]) ─────────────────────────────
    const probScore = Math.max(0, Math.min(1, asset.probability));

    // ── Komponen 2: Relative Strength ─────────────────────────────────────
    // rsScore.momentumPercentile adalah 0–100, normalise ke [0,1]
    const rsRaw = asset.rsScore?.momentumPercentile ?? 50;
    const rsScore = rsRaw / 100;

    // ── Komponen 3: Volume Expansion ──────────────────────────────────────
    // relativeVolume dari feature.engine: 1.0=normal, 2.0=2x normal
    // Clamp: >3x → 1.0, <0.5x → 0
    const relVol = asset.trendDirection === "BULLISH"
      ? Math.max(0, Math.min(1, ((asset.momentumScore / 100) * 1.5 - 0.5) / 2))
      : 0.3; // Penalti aset bearish
    // Fallback jika momentumScore tidak bermakna: gunakan volume change proxy
    const volExpansionScore = relVol;

    // ── Komponen 4: Trend Strength dari MTF ────────────────────────────────
    const trendScore = asset.mtfScore
      ? asset.mtfScore.dailyTrend  // 0–1 dari MTF engine
      : Math.min(1, asset.momentumScore / 100);

    // ── Komponen 5: Liquidity Score (sudah 0–100) ──────────────────────────
    const liqScore = Math.max(0, Math.min(1, asset.liquidityScore / 100));

    // ── Roadmap formula ────────────────────────────────────────────────────
    const raw =
      probScore        * 0.30 +
      rsScore          * 0.20 +
      volExpansionScore * 0.20 +
      trendScore       * 0.15 +
      liqScore         * 0.15;

    // ── Penalty modifiers ──────────────────────────────────────────────────
    let score = raw;

    // Penalty: manipulasi terdeteksi
    if (asset.manipulationWarning) score *= 0.65;

    // Penalty: regime Panic/Crash
    if (
      asset.regimeDetail?.type === "Panic / Crash" ||
      asset.marketRegime === "Panic Rejection"
    ) score *= 0.4;

    // Bonus: MTF confluence kuat
    if (asset.mtfScore?.confluence === "STRONG") score *= 1.15;

    // Bonus: analog signal bullish
    if (asset.analogMatches && asset.analogMatches.length > 0) {
      const avgOutcome = asset.analogMatches.reduce(
        (s, a) => s + a.outcomeReturn, 0
      ) / asset.analogMatches.length;
      if (avgOutcome > 0.02) score *= 1.1;
    }

    return Number(Math.max(0, Math.min(1, score)).toFixed(4));
  }
}
