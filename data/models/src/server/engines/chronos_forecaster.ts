/**
 * Statistical Time Series Forecaster — Holt-Winters ETS (Exponential Smoothing)
 *
 * ─── Tentang Amazon Chronos 2.0 ──────────────────────────────────────────────
 * Chronos 2.0 (amazon/chronos-t5-small, amazon/chronos-t5-large) adalah model
 * transformer untuk time series milik Amazon Research, dirilis di HuggingFace.
 *
 * Model ini TIDAK TERSEDIA di Node.js/TypeScript secara native.
 * Untuk menggunakannya di project ini, dibutuhkan salah satu dari:
 *   A) Python subprocess:
 *      pip install chronos-forecasting
 *      from chronos import ChronosPipeline
 *   B) HuggingFace Inference API (memerlukan API key)
 *   C) ONNX export dari model Chronos (eksperimental, ukuran besar)
 *
 * ─── Yang Diimplementasikan di Sini ──────────────────────────────────────────
 * Holt-Winters Double Exponential Smoothing (ETS — Error, Trend, Seasonal):
 *   - Metode statistik time series yang terbukti dan digunakan di produksi
 *   - Dipakai oleh AWS Forecast, Facebook Prophet, dan statsmodels Python
 *   - Parameter alpha/beta/phi dioptimalkan otomatis via grid search (RMSE minimum)
 *   - Memberikan confidence interval (prediction bands)
 *
 * Ini lebih jujur dan secara matematis lebih sound daripada label "Chronos 2.0"
 * yang sebelumnya hanya berupa linear drift sederhana.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Candle } from "../../types";

export interface ForecastResult {
  prices: number[];           // Prediksi harga absolut
  upperBand: number[];        // Batas atas confidence interval (1σ)
  lowerBand: number[];        // Batas bawah confidence interval (1σ)
  alpha: number;              // Parameter smoothing level yang digunakan
  beta: number;               // Parameter smoothing trend yang digunakan
  phi: number;                // Parameter damping yang digunakan
  rmseInSample: number;       // RMSE pada data historis (ukuran fit quality)
}

export class StatisticalForecaster {
  private static instance: StatisticalForecaster;

  private constructor() {
    console.log(
      "[Statistical Forecaster] Holt-Winters ETS siap. " +
      "(Upgrade ke Chronos 2.0 memerlukan Python bridge — lihat komentar di file ini)"
    );
  }

  public static getInstance(): StatisticalForecaster {
    if (!StatisticalForecaster.instance) {
      StatisticalForecaster.instance = new StatisticalForecaster();
    }
    return StatisticalForecaster.instance;
  }

  /**
   * Forecast utama: Holt-Winters Double Exponential Smoothing dengan damped trend.
   *
   * Formula:
   *   Level:  L_t = α * y_t + (1-α) * (L_{t-1} + φ * T_{t-1})
   *   Trend:  T_t = β * (L_t - L_{t-1}) + (1-β) * φ * T_{t-1}
   *   Fcst:   ŷ_{t+h} = L_t + (φ + φ² + ... + φʰ) * T_t
   *
   * @param candles - OHLCV candle history (minimal 15)
   * @param steps   - Jumlah candle ke depan yang diprediksi (default 5)
   */
  public forecast(candles: Candle[], steps = 5): ForecastResult {
    if (candles.length < 10) {
      const last = candles[candles.length - 1]?.close || 0;
      return {
        prices: Array(steps).fill(Number(last.toFixed(4))),
        upperBand: Array(steps).fill(Number(last.toFixed(4))),
        lowerBand: Array(steps).fill(Number(last.toFixed(4))),
        alpha: 0.2, beta: 0.1, phi: 0.92,
        rmseInSample: 0,
      };
    }

    const closes = candles.map((c) => c.close);

    // Cari parameter terbaik via grid search
    const { alpha, beta, phi } = this.findOptimalParams(closes);

    // Jalankan smoothing pass
    const { level, trend, fittedValues } = this.runSmoothing(closes, alpha, beta, phi);

    // Hitung RMSE in-sample sebagai ukuran kualitas fit
    const rmseInSample = this.computeRmse(closes, fittedValues);

    // Hitung standar deviasi residual untuk confidence interval
    const residuals = closes.map((y, i) => y - fittedValues[i]);
    const residStd = this.computeStd(residuals);

    // Generate forecast dengan damped trend
    const prices: number[] = [];
    const upperBand: number[] = [];
    const lowerBand: number[] = [];

    let cumulativePhi = phi;
    for (let h = 1; h <= steps; h++) {
      const dampedSum = this.dampedPhiSum(phi, h);
      const forecast = level + dampedSum * trend;

      // Confidence interval melebar seiring h (ketidakpastian bertambah)
      const margin = residStd * Math.sqrt(1 + h * 0.15);

      prices.push(Number(forecast.toFixed(4)));
      upperBand.push(Number((forecast + margin).toFixed(4)));
      lowerBand.push(Number((forecast - margin).toFixed(4)));

      cumulativePhi *= phi;
    }

    return { prices, upperBand, lowerBand, alpha, beta, phi, rmseInSample };
  }

  // ── Private Methods ────────────────────────────────────────────────────────

  /**
   * Grid search untuk mencari kombinasi α, β, φ dengan RMSE terendah
   * pada 20% data terakhir sebagai validation set.
   */
  private findOptimalParams(closes: number[]): {
    alpha: number;
    beta: number;
    phi: number;
  } {
    const trainEnd = Math.floor(closes.length * 0.8);

    const alphas = [0.1, 0.15, 0.2, 0.3];
    const betas  = [0.05, 0.1,  0.15, 0.2];
    const phis   = [0.85, 0.90, 0.95, 0.98];

    let best = { alpha: 0.2, beta: 0.1, phi: 0.92 };
    let bestRmse = Infinity;

    for (const alpha of alphas) {
      for (const beta of betas) {
        for (const phi of phis) {
          const rmse = this.validationRmse(closes, trainEnd, alpha, beta, phi);
          if (rmse < bestRmse) {
            bestRmse = rmse;
            best = { alpha, beta, phi };
          }
        }
      }
    }

    return best;
  }

  /**
   * Menjalankan Holt-Winters smoothing pass pada seluruh data historis.
   * Mengembalikan level akhir, trend akhir, dan nilai fitted untuk setiap titik.
   */
  private runSmoothing(
    closes: number[],
    alpha: number,
    beta: number,
    phi: number
  ): { level: number; trend: number; fittedValues: number[] } {
    let level = closes[0];
    let trend = closes.length > 1 ? closes[1] - closes[0] : 0;
    const fittedValues: number[] = [closes[0]];

    for (let i = 1; i < closes.length; i++) {
      const prevLevel = level;
      const prevTrend = trend;

      // Holt-Winters update equations
      level = alpha * closes[i] + (1 - alpha) * (prevLevel + phi * prevTrend);
      trend = beta * (level - prevLevel) + (1 - beta) * phi * prevTrend;

      fittedValues.push(prevLevel + phi * prevTrend);
    }

    return { level, trend, fittedValues };
  }

  /**
   * RMSE pada data validasi (held-out 20% terakhir).
   */
  private validationRmse(
    closes: number[],
    trainEnd: number,
    alpha: number,
    beta: number,
    phi: number
  ): number {
    // Latih pada data training
    const { level, trend } = this.runSmoothing(
      closes.slice(0, trainEnd),
      alpha,
      beta,
      phi
    );

    // Evaluasi pada data validasi
    let sqError = 0;
    let count = 0;

    for (let h = 1; h <= closes.length - trainEnd; h++) {
      const dampedSum = this.dampedPhiSum(phi, h);
      const pred = level + dampedSum * trend;
      sqError += Math.pow(pred - closes[trainEnd + h - 1], 2);
      count++;
    }

    return count > 0 ? Math.sqrt(sqError / count) : Infinity;
  }

  /** Σ_{i=1}^{h} φ^i — jumlah geometris untuk damped trend */
  private dampedPhiSum(phi: number, h: number): number {
    if (Math.abs(phi - 1.0) < 1e-9) return h;
    return phi * (1 - Math.pow(phi, h)) / (1 - phi);
  }

  private computeRmse(actual: number[], fitted: number[]): number {
    const n = Math.min(actual.length, fitted.length);
    if (n === 0) return 0;
    let sq = 0;
    for (let i = 0; i < n; i++) {
      sq += Math.pow(actual[i] - fitted[i], 2);
    }
    return Math.sqrt(sq / n);
  }

  private computeStd(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }
}
