/**
 * Multi-Timeframe Intelligence Engine — Roadmap Item #5
 *
 * Menggabungkan sinyal dari 4 timeframe:
 *   Daily (40%) + 4H (30%) + 1H (20%) + Weekly (10%)
 *
 * Formula dari roadmap:
 *   FinalScore = 0.4*DailyTrend + 0.3*H4Momentum + 0.2*H1Setup + 0.1*WeeklyBias
 *
 * Candle agregasi dilakukan dari data 1H (candle terkecil yang tersedia):
 *   - 4H  = aggregate tiap 4 candle 1H
 *   - Daily = aggregate tiap 24 candle 1H
 *   - Weekly = aggregate tiap 168 candle 1H (atau ambil 5 daily candle)
 *
 * Sinyal tiap timeframe: -1 (bearish) … 0 (neutral) … +1 (bullish)
 * FinalScore di-map ke [0,1] untuk konsistensi dengan probability pipeline.
 */

import { Candle, MTFScore, TechIndicators } from "../../types";
import { FeatureEngineeringEngine } from "./feature.engine";

export class MultiTimeframeEngine {
  private static instance: MultiTimeframeEngine;
  private featureEngine = FeatureEngineeringEngine.getInstance();

  private constructor() {}

  public static getInstance(): MultiTimeframeEngine {
    if (!MultiTimeframeEngine.instance) {
      MultiTimeframeEngine.instance = new MultiTimeframeEngine();
    }
    return MultiTimeframeEngine.instance;
  }

  /**
   * Hitung MTF confluence dari candle 1H.
   *
   * @param candles1H - Candle 1H (butuh minimal 168 untuk weekly)
   */
  public computeMTF(candles1H: Candle[]): MTFScore {
    if (candles1H.length < 24) {
      return this.defaultMTF();
    }

    // ── Agregasi candle ───────────────────────────────────────────────────
    const candles4H     = this.aggregateCandles(candles1H, 4);
    const candlesDaily  = this.aggregateCandles(candles1H, 24);
    const candlesWeekly = this.aggregateCandles(candlesDaily, 5);

    // ── Hitung sinyal tiap timeframe [-1, +1] ────────────────────────────
    const h1Setup     = this.computeTimeframeSignal(candles1H);
    const h4Momentum  = this.computeTimeframeSignal(candles4H);
    const dailyTrend  = this.computeTimeframeSignal(candlesDaily);
    const weeklyBias  = this.computeTimeframeSignal(candlesWeekly);

    // ── Formula dari roadmap ──────────────────────────────────────────────
    // FinalScore dalam [-1, +1]
    const rawScore =
      0.4 * dailyTrend +
      0.3 * h4Momentum +
      0.2 * h1Setup +
      0.1 * weeklyBias;

    // Normalise ke [0, 1] untuk konsistensi dengan pipeline probability
    const finalScore = (rawScore + 1) / 2;

    // ── Confluence assessment ─────────────────────────────────────────────
    const signals     = [dailyTrend, h4Momentum, h1Setup, weeklyBias];
    const confluence  = this.assessConfluence(signals);

    return {
      finalScore:    Number(finalScore.toFixed(3)),
      dailyTrend:    Number(((dailyTrend + 1) / 2).toFixed(3)),
      h4Momentum:    Number(((h4Momentum + 1) / 2).toFixed(3)),
      h1Setup:       Number(((h1Setup + 1) / 2).toFixed(3)),
      weeklyBias:    Number(((weeklyBias + 1) / 2).toFixed(3)),
      confluence,
    };
  }

  // ── Sinyal per timeframe ────────────────────────────────────────────────────

  /**
   * Menghasilkan sinyal [-1, +1] untuk satu timeframe.
   * Menggabungkan: EMA cross, MACD histogram, RSI, dan trend persistence.
   */
  private computeTimeframeSignal(candles: Candle[]): number {
    if (candles.length < 5) return 0;

    const indicators = this.featureEngine.extractFeatures(candles);
    const lastClose  = candles[candles.length - 1].close;

    let score = 0;
    let weight = 0;

    // ── EMA Cross (weight 0.3) ────────────────────────────────────────────
    if (indicators.emaFast !== 0 && indicators.emaSlow !== 0) {
      const emaDiff = (indicators.emaFast - indicators.emaSlow) /
                      (indicators.emaSlow || 1);
      // Normalise: |emaDiff| > 2% = full signal
      const emaSignal = Math.max(-1, Math.min(1, emaDiff / 0.02));
      score  += emaSignal * 0.3;
      weight += 0.3;
    }

    // ── MACD Histogram (weight 0.25) ─────────────────────────────────────
    if (indicators.macdHist !== 0) {
      // Normalise relative to price: |hist/price| > 0.5% = full signal
      const macdSignal = Math.max(-1, Math.min(1,
        indicators.macdHist / (lastClose * 0.005 || 1)
      ));
      score  += macdSignal * 0.25;
      weight += 0.25;
    }

    // ── RSI (weight 0.25) ─────────────────────────────────────────────────
    // RSI 30–70 maps to [-1, +1], clamped outside
    const rsiSignal = Math.max(-1, Math.min(1, (indicators.rsi - 50) / 20));
    score  += rsiSignal * 0.25;
    weight += 0.25;

    // ── Trend Persistence (weight 0.2) ────────────────────────────────────
    if (indicators.trendPersistence !== undefined) {
      // trendPersistence 0.5 = neutral, 1.0 = full trend signal
      // Direction from EMA cross
      const dir     = indicators.emaFast >= indicators.emaSlow ? 1 : -1;
      const tpSignal = dir * (indicators.trendPersistence - 0.5) * 2;
      score  += tpSignal * 0.2;
      weight += 0.2;
    }

    return weight > 0 ? Math.max(-1, Math.min(1, score / weight * weight)) : 0;
  }

  // ── Candle Aggregation ──────────────────────────────────────────────────────

  /**
   * Agregasi N candle kecil menjadi 1 candle besar.
   * OHLCV: O=first, H=max, L=min, C=last, V=sum, T=first
   */
  private aggregateCandles(candles: Candle[], barsPerCandle: number): Candle[] {
    const result: Candle[] = [];
    for (let i = 0; i + barsPerCandle <= candles.length; i += barsPerCandle) {
      const slice = candles.slice(i, i + barsPerCandle);
      result.push({
        time:   slice[0].time,
        open:   slice[0].open,
        high:   Math.max(...slice.map(c => c.high)),
        low:    Math.min(...slice.map(c => c.low)),
        close:  slice[slice.length - 1].close,
        volume: slice.reduce((s, c) => s + c.volume, 0),
      });
    }
    return result;
  }

  // ── Confluence Assessment ───────────────────────────────────────────────────

  /**
   * Menilai seberapa selaras sinyal antar timeframe.
   * STRONG  = semua 4 TF searah
   * MODERATE = 3 TF searah
   * WEAK    = 2 TF searah
   * CONFLICTED = campuran (tidak ada konsensus)
   */
  private assessConfluence(signals: number[]): MTFScore["confluence"] {
    const bullish = signals.filter(s => s >  0.2).length;
    const bearish = signals.filter(s => s < -0.2).length;
    const neutral = signals.length - bullish - bearish;

    const dominant = Math.max(bullish, bearish);
    if (dominant === 4)             return "STRONG";
    if (dominant === 3)             return "MODERATE";
    if (dominant === 2 && neutral < 2) return "WEAK";
    return "CONFLICTED";
  }

  private defaultMTF(): MTFScore {
    return {
      finalScore: 0.5,
      dailyTrend: 0.5,
      h4Momentum: 0.5,
      h1Setup: 0.5,
      weeklyBias: 0.5,
      confluence: "CONFLICTED",
    };
  }
}
