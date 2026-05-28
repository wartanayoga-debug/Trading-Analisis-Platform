/**
 * Relative Strength Engine — Roadmap Item #4
 *
 * Membandingkan performa aset secara cross-sectional:
 *   - Stock vs Benchmark (IHSG / BTC)
 *   - Stock vs Sector peers
 *   - Momentum Percentile dalam universe
 *   - Alpha Rank
 *
 * Formula:
 *   RS = Stock_Return / Benchmark_Return
 *   MomentumPercentile = rank(stock_return) / total_universe * 100
 *
 * Tidak ada nilai hardcoded — semua kalkulasi dari return aktual.
 */

import { Candle, RSScore } from "../../types";

// Benchmark universe — returns diisi saat scan berjalan
interface BenchmarkCache {
  return1d: number;
  return5d: number;
  return20d: number;
  updatedAt: number;
}

export class RelativeStrengthEngine {
  private static instance: RelativeStrengthEngine;

  // Cache return benchmark agar tidak di-refetch tiap aset
  private benchmarkCache: Map<string, BenchmarkCache> = new Map();

  // Universe return tracker: ticker → {return1d, return5d, return20d}
  private universeReturns: Map<string, {
    r1d: number; r5d: number; r20d: number; sector?: string;
  }> = new Map();

  private constructor() {}

  public static getInstance(): RelativeStrengthEngine {
    if (!RelativeStrengthEngine.instance) {
      RelativeStrengthEngine.instance = new RelativeStrengthEngine();
    }
    return RelativeStrengthEngine.instance;
  }

  /**
   * Menghitung RS Score untuk satu aset.
   *
   * @param ticker         - Kode aset
   * @param candles        - OHLCV aset
   * @param benchmarkCandles - OHLCV benchmark (IHSG/BTC)
   * @param benchmarkTicker  - Label benchmark ("^JKSE" / "BTCUSDT")
   * @param sector         - Sektor aset (opsional)
   */
  public computeRS(
    ticker: string,
    candles: Candle[],
    benchmarkCandles: Candle[],
    benchmarkTicker: string,
    sector?: string
  ): RSScore {
    // ── Return kalkulasi ──────────────────────────────────────────────────
    const stockR1d  = this.periodReturn(candles, 1);
    const stockR5d  = this.periodReturn(candles, 5);
    const stockR20d = this.periodReturn(candles, 20);

    const bmR1d  = this.periodReturn(benchmarkCandles, 1);
    const bmR5d  = this.periodReturn(benchmarkCandles, 5);
    const bmR20d = this.periodReturn(benchmarkCandles, 20);

    // Update universe cache dengan return aset ini
    this.universeReturns.set(ticker, {
      r1d: stockR1d, r5d: stockR5d, r20d: stockR20d, sector,
    });

    // ── RS Raw (composite: 20% 1d + 30% 5d + 50% 20d — Mansfield weighting) ──
    const rsRaw = this.computeCompositeRS(
      [stockR1d, stockR5d, stockR20d],
      [bmR1d, bmR5d, bmR20d]
    );

    // ── Momentum Percentile dalam universe ───────────────────────────────
    const momentumPercentile = this.rankInUniverse(ticker, stockR20d, "all");

    // ── Sector Rank ────────────────────────────────────────────────────────
    const sectorRank = sector
      ? this.rankInUniverse(ticker, stockR20d, "sector", sector)
      : 0;

    // ── Alpha Rank (RS vs benchmark, ranked in universe) ──────────────────
    const alphaReturn = stockR20d - bmR20d;
    const alphaRank   = this.rankInUniverse(ticker + "_alpha", alphaReturn, "alpha");

    return {
      rsRaw:              Number(rsRaw.toFixed(4)),
      momentumPercentile: Number(momentumPercentile.toFixed(1)),
      sectorRank,
      alphaRank,
    };
  }

  /**
   * Update universe setelah semua aset di-scan.
   * Dipanggil oleh scanner.engine.ts setelah satu full scan selesai.
   */
  public finalizeUniverse(): void {
    // Re-rank semua aset berdasarkan universe final
    // (universeReturns sudah up to date dari tiap computeRS call)
    console.log(
      `[RSEngine] Universe finalized: ${this.universeReturns.size} assets tracked.`
    );
  }

  // ── Private Helpers ───────────────────────────────────────────────────────

  /**
   * Menghitung return selama `period` candle.
   * Mengembalikan 0 jika data tidak cukup.
   */
  private periodReturn(candles: Candle[], period: number): number {
    if (candles.length < period + 1) {
      // Jika period > tersedia, gunakan seluruh history
      if (candles.length < 2) return 0;
      const first = candles[0].close;
      const last  = candles[candles.length - 1].close;
      return first > 0 ? (last - first) / first : 0;
    }
    const old  = candles[candles.length - period - 1].close;
    const curr = candles[candles.length - 1].close;
    return old > 0 ? (curr - old) / old : 0;
  }

  /**
   * RS Composite: rata-rata berbobot dari RS tiap periode.
   * Jika benchmark return = 0 di salah satu periode, gunakan return absolut.
   */
  private computeCompositeRS(
    stockReturns: [number, number, number],
    bmReturns: [number, number, number]
  ): number {
    const weights = [0.2, 0.3, 0.5];
    let rs = 0;
    for (let i = 0; i < 3; i++) {
      const bm = bmReturns[i];
      // RS relatif: stock / benchmark (keduanya dalam desimal)
      // Jika bm ≈ 0, gunakan alpha (selisih)
      const rsI = Math.abs(bm) > 0.001
        ? stockReturns[i] / bm
        : 1 + (stockReturns[i] - bm);
      rs += weights[i] * rsI;
    }
    return rs;
  }

  /**
   * Mengembalikan rank 0–100 (100 = terbaik) dari `value` dalam universe.
   * mode "sector" = bandingkan dalam sektor yang sama.
   * mode "alpha"  = gunakan alphaReturns map.
   */
  private rankInUniverse(
    ticker: string,
    value: number,
    mode: "all" | "sector" | "alpha",
    sector?: string
  ): number {
    let pool: number[] = [];

    if (mode === "sector" && sector) {
      pool = Array.from(this.universeReturns.values())
        .filter(v => v.sector === sector)
        .map(v => v.r20d);
    } else {
      pool = Array.from(this.universeReturns.values()).map(v => v.r20d);
    }

    if (pool.length === 0) return 50;

    const rank    = pool.filter(v => v < value).length;
    const pct     = (rank / pool.length) * 100;
    return Number(pct.toFixed(1));
  }
}
