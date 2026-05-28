/**
 * Historical Analog Search Engine — Roadmap Item #7
 *
 * Membandingkan kondisi pasar saat ini dengan seluruh history untuk menemukan
 * situasi paling mirip, lalu melihat apa yang terjadi setelahnya.
 *
 * Metode (sesuai roadmap):
 *   1. Cosine Similarity — membandingkan feature vectors
 *   2. Dynamic Time Warping (DTW) — membandingkan shape harga
 *
 * Workflow:
 *   1. Normalisasi window harga saat ini menjadi return series
 *   2. Slide window sepanjang history, hitung similarity
 *   3. Ambil top-3 match, lihat outcome (return 5 bar berikutnya)
 *
 * Semua data dari candle nyata — tidak ada scenario hardcoded.
 */

import { Candle, AnalogMatch } from "../../types";

const WINDOW_SIZE    = 20;   // Panjang window yang dibandingkan
const TOP_K          = 3;    // Ambil top-3 analog
const MIN_GAP        = 10;   // Minimum gap antar match (hindari overlap)
const OUTCOME_BARS   = 5;    // Berapa bar ke depan untuk outcome

export class HistoricalAnalogEngine {
  private static instance: HistoricalAnalogEngine;

  private constructor() {}

  public static getInstance(): HistoricalAnalogEngine {
    if (!HistoricalAnalogEngine.instance) {
      HistoricalAnalogEngine.instance = new HistoricalAnalogEngine();
    }
    return HistoricalAnalogEngine.instance;
  }

  /**
   * Cari analog historis yang paling mirip dengan kondisi saat ini.
   *
   * @param candles - OHLCV lengkap (idealnya 200+ candle untuk search space yang bermakna)
   * @returns Array top-K analog matches
   */
  public findAnalogs(candles: Candle[]): AnalogMatch[] {
    const minRequired = WINDOW_SIZE * 2 + OUTCOME_BARS + MIN_GAP;
    if (candles.length < minRequired) {
      return [];
    }

    // ── Step 1: Buat feature vector dari window saat ini ──────────────────
    const currentWindow = candles.slice(-WINDOW_SIZE);
    const currentVec    = this.windowToReturnVector(currentWindow);
    const currentNorm   = this.l2Normalize(currentVec);

    // ── Step 2: Slide window di sepanjang history ─────────────────────────
    // Hindari overlap dengan window saat ini: hanya search s/d -(WINDOW+OUTCOME+GAP)
    const searchEnd    = candles.length - WINDOW_SIZE - OUTCOME_BARS - 1;
    const candidates: Array<{
      idx: number;
      cosineSim: number;
      dtwDist: number;
      combined: number;
    }> = [];

    for (let i = 0; i <= searchEnd - WINDOW_SIZE; i++) {
      const histWindow = candles.slice(i, i + WINDOW_SIZE);
      const histVec    = this.windowToReturnVector(histWindow);
      const histNorm   = this.l2Normalize(histVec);

      // Cosine similarity [−1, 1] → re-scale ke [0, 1]
      const cosSim = (this.cosineSimilarity(currentNorm, histNorm) + 1) / 2;

      // DTW distance → normalise ke similarity [0, 1]
      const dtwDist = this.dtw(currentVec, histVec);
      const maxDtw  = currentVec.length * 0.1; // threshold heuristik
      const dtwSim  = Math.max(0, 1 - dtwDist / (maxDtw || 1));

      // Combined: 60% cosine + 40% DTW
      const combined = cosSim * 0.6 + dtwSim * 0.4;

      candidates.push({ idx: i, cosineSim: cosSim, dtwDist, combined });
    }

    // ── Step 3: Sort dan ambil top-K dengan minimum gap ───────────────────
    candidates.sort((a, b) => b.combined - a.combined);
    const selected: typeof candidates = [];

    for (const c of candidates) {
      if (selected.every(s => Math.abs(s.idx - c.idx) >= MIN_GAP)) {
        selected.push(c);
        if (selected.length >= TOP_K) break;
      }
    }

    // ── Step 4: Hitung outcome return setelah tiap analog ─────────────────
    return selected.map((match) => {
      const afterStart  = match.idx + WINDOW_SIZE;
      const afterEnd    = afterStart + OUTCOME_BARS;
      const priceAtMatch = candles[afterStart].close;
      const priceAfter   = candles[Math.min(afterEnd, candles.length - 1)].close;
      const outcomeReturn = priceAtMatch > 0
        ? (priceAfter - priceAtMatch) / priceAtMatch
        : 0;

      const quality: AnalogMatch["matchQuality"] =
        match.combined > 0.80 ? "HIGH" :
        match.combined > 0.65 ? "MEDIUM" : "LOW";

      return {
        similarityScore:  Number(match.combined.toFixed(4)),
        periodStartTs:    candles[match.idx].time,
        outcomeReturn:    Number(outcomeReturn.toFixed(4)),
        matchQuality:     quality,
      };
    });
  }

  /**
   * Agregasi outcome dari semua analog untuk menghasilkan sinyal probabilistik.
   * Return: probability bullish berdasarkan analog history [0, 1]
   */
  public getAnalogSignal(analogs: AnalogMatch[]): number {
    if (analogs.length === 0) return 0.5;

    let weightedSum  = 0;
    let totalWeight  = 0;

    for (const a of analogs) {
      const weight = a.similarityScore;
      const bullish = a.outcomeReturn > 0 ? 1 : 0;
      weightedSum  += bullish * weight;
      totalWeight  += weight;
    }

    return totalWeight > 0
      ? Math.max(0.1, Math.min(0.9, weightedSum / totalWeight))
      : 0.5;
  }

  // ── Cosine Similarity ───────────────────────────────────────────────────────

  private cosineSimilarity(a: number[], b: number[]): number {
    const n = Math.min(a.length, b.length);
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < n; i++) {
      dot   += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0;
  }

  // ── Dynamic Time Warping ────────────────────────────────────────────────────

  /**
   * DTW distance antara dua return series.
   * Menggunakan DP O(n²) — efficient untuk window size 20.
   */
  private dtw(a: number[], b: number[]): number {
    const n = a.length;
    const m = b.length;

    // DP matrix
    const dp: number[][] = Array.from({ length: n + 1 }, () =>
      new Array(m + 1).fill(Infinity)
    );
    dp[0][0] = 0;

    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        const cost = Math.abs(a[i - 1] - b[j - 1]);
        dp[i][j] = cost + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }

    return dp[n][m];
  }

  // ── Feature Extraction ──────────────────────────────────────────────────────

  /**
   * Konversi window candle → vector log-return yang dinormalisasi.
   * Ini membuat perbandingan scale-invariant (100rb vs 1jt tetap bisa dibandingkan).
   */
  private windowToReturnVector(candles: Candle[]): number[] {
    const vec: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const prev = candles[i - 1].close;
      const curr = candles[i].close;
      vec.push(prev > 0 ? Math.log(curr / prev) : 0);
    }
    return vec;
  }

  /**
   * L2 normalisasi agar cosine similarity tidak dipengaruhi magnitude.
   */
  private l2Normalize(vec: number[]): number[] {
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    return norm > 0 ? vec.map(v => v / norm) : vec;
  }
}
