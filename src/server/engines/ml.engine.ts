/**
 * ML Prediction Engine
 *
 * Pipeline prediksi 4-layer:
 *   1. RandomForest Classifier (tabular features → probabilitas arah)
 *   2. LSTM Forecast Model     (sequential candles → harga 5 period ke depan)
 *   3. LSTM Reversal Detector  (sequential candles → probabilitas pembalikan)
 *   4. Holt-Winters ETS        (statistical forecaster sebagai cross-check)
 *
 * Semua output di-ensemble lalu dikalibrasi via Platt Scaling.
 */

import { Candle, TechIndicators, MLPrediction } from "../../types";
import { RealCalibrationEngine } from "./calibration.engine";
import { LSTMForecaster } from "./lstm_forecaster";
import { StatisticalForecaster } from "./chronos_forecaster";
import { RandomForestClassifier } from "ml-random-forest";
import * as fs from "fs";
import * as path from "path";

export class MLPredictionEngine {
  private static instance: MLPredictionEngine;
  private rfClassifier: RandomForestClassifier | null = null;
  private modelWeightsLoaded: boolean = false;

  // ── Model baru: LSTM + Statistical Forecaster ────────────────────────────
  private lstmForecaster = LSTMForecaster.getInstance();
  private statForecaster = StatisticalForecaster.getInstance();

  private constructor() {}

  public static getInstance(): MLPredictionEngine {
    if (!MLPredictionEngine.instance) {
      MLPredictionEngine.instance = new MLPredictionEngine();
      MLPredictionEngine.instance.initializeRFModel();
    }
    return MLPredictionEngine.instance;
  }

  // ── Inisialisasi RandomForest ─────────────────────────────────────────────

  private initializeRFModel() {
    try {
      const modelDir = path.join(process.cwd(), "data", "models");
      let loaded = false;

      if (fs.existsSync(modelDir)) {
        const files = fs
          .readdirSync(modelDir)
          .filter(
            (f: string) =>
              f.endsWith(".json") && f.includes("RandomForestClassifier")
          );

        if (files.length > 0) {
          files.sort((a: string, b: string) => {
            const statA = fs.statSync(path.join(modelDir, a)).mtimeMs;
            const statB = fs.statSync(path.join(modelDir, b)).mtimeMs;
            return statB - statA;
          });
          const latestModelPath = path.join(modelDir, files[0]);
          const rawData = fs.readFileSync(latestModelPath, "utf-8");
          const modelJson = JSON.parse(rawData);
          this.rfClassifier = RandomForestClassifier.load(modelJson);
          this.modelWeightsLoaded = true;
          console.log(
            `[ML Engine] RandomForestClassifier loaded: ${files[0]}`
          );
          loaded = true;
        }
      }

      if (!loaded) {
        console.warn(
          "[ML Engine] No RF weights found. Initializing base model..."
        );
        this.rfClassifier = new RandomForestClassifier({
          seed: 42,
          maxFeatures: 1.0,
          replacement: true,
          nEstimators: 25,
        });
        // Catatan: model ini hanya bootstrap — akurasi meningkat setelah training
        // pertama dijalankan via /api/train
        const dummyX = [
          [30, 0, -1, 0.2, 0.1],
          [70, 1,  1, 0.8, 0.5],
          [50, 0,  0, 0.5, 0.2],
          [60, 1,  0.5, 0.7, 0.3],
          [40, 0, -0.5, 0.3, 0.1],
          [80, 1,  1.2, 0.9, 0.8],
        ];
        const dummyY = [0, 1, 0, 1, 0, 1];
        this.rfClassifier.train(dummyX, dummyY);
        this.modelWeightsLoaded = true;
        console.log("[ML Engine] Base RF model initialized.");
      }
    } catch (e) {
      console.error("[ML Engine] RF init error:", e);
    }
  }

  // ── Entry Point Utama ─────────────────────────────────────────────────────

  public generatePrediction(
    candles: Candle[],
    indicators: TechIndicators
  ): MLPrediction {
    if (candles.length < 20) {
      return this.generateEmptyPrediction();
    }

    // ── Layer 1: RandomForest tabular inference ──
    const rfProb = this.computeRFProbability(candles, indicators);

    // ── Layer 2: LSTM price forecast ──────────────
    // Mengembalikan harga absolut untuk 5 candle ke depan
    const lstmForecast = this.lstmForecaster.forecastPrices(candles);

    // ── Layer 3: LSTM reversal detection ──────────
    // Mengembalikan probabilitas pembalikan arah [0,1]
    const lstmReversalProb = this.lstmForecaster.getReversalProbability(candles);

    // ── Layer 4: Holt-Winters statistical cross-check ──
    const holtWinters = this.statForecaster.forecast(candles, 5);

    // ── Ensemble voting ───────────────────────────────
    // Holt-Winters: apakah arah forecast naik atau turun?
    const lastPrice = candles[candles.length - 1].close;
    const hwForecastNet = holtWinters.prices.length > 0
      ? holtWinters.prices[holtWinters.prices.length - 1] - lastPrice
      : 0;
    const hwProbSignal = hwForecastNet > 0 ? 0.6 : 0.4; // Konversi ke probabilitas sederhana

    // Rata-rata berbobot: RF (50%) + Holt-Winters direction (20%) + baseline (30%)
    let ensembleProb = rfProb * 0.5 + hwProbSignal * 0.2 + 0.5 * 0.3;

    // Dampen probabilitas berdasarkan LSTM reversal risk
    if (lstmReversalProb > 0.65) {
      const reversalDamp = 1 - (lstmReversalProb - 0.65) * 0.8;
      ensembleProb = ensembleProb * reversalDamp + 0.5 * (1 - reversalDamp);
    }

    // ── Kalibrasi Platt Scaling ───────────────────────
    const calibrationEngine = RealCalibrationEngine.getInstance();
    const volProxy =
      (indicators.atr / candles[candles.length - 1].close) * 100 * 100;
    const finalProb = calibrationEngine.calibrateProbability(
      ensembleProb,
      volProxy > 5 ? "CRYPTO" : "IDX",
      volProxy
    );

    // ── Tentukan arah ──────────────────────────────────
    let direction: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
    if (finalProb > 0.58) direction = "BULLISH";
    else if (finalProb < 0.42) direction = "BEARISH";

    // ── Confidence ─────────────────────────────────────
    const confidence = this.computeConfidence(
      finalProb,
      indicators,
      lstmReversalProb
    );

    // ── Breakout factor ────────────────────────────────
    const breakoutProb = this.calculateBreakoutFactor(indicators, lastPrice);

    // ── Pilih forecast candles: LSTM jika tersedia, fallback ke Holt-Winters
    const estimatedFutureCandles =
      lstmForecast.length === 5
        ? lstmForecast
        : holtWinters.prices;

    return {
      probability: Number(finalProb.toFixed(3)),
      confidence: Number(confidence.toFixed(3)),
      momentumScore: Math.round(finalProb * 100),
      breakoutProbability: Number(breakoutProb.toFixed(3)),
      trendDirection: direction,
      estimatedFutureCandles: estimatedFutureCandles.map((p) =>
        Number(p.toFixed(4))
      ),
    };
  }

  // ── Layer 1: RandomForest Inference ───────────────────────────────────────

  private computeRFProbability(
    candles: Candle[],
    indicators: TechIndicators
  ): number {
    if (!this.modelWeightsLoaded || !this.rfClassifier) return 0.5;

    // ─── BUG FIX: OBV sebelumnya hardcoded ke 1000 ───────────────────────
    // OBV asli sudah dihitung di feature.engine.ts dan tersedia di indicators.obv
    // Nilai OBV bisa ratusan juta — normalisasi ke skala yang masuk akal
    const rawObv = indicators.obv;
    const normalizedObv = Math.tanh(rawObv / 1_000_000); // scale ke [-1, 1]
    // ─────────────────────────────────────────────────────────────────────

    const f1_rsi    = indicators.rsi;
    const f2_macdH  = indicators.macdHist;
    const f3_adx    = indicators.adx || 20;
    const f4_obv    = normalizedObv;            // ← FIX: pakai OBV asli, bukan 1000
    const f5_bbWidth =
      (indicators.bbUpper - indicators.bbLower) /
      (indicators.bbMiddle || 1);

    const featureVector = [[f1_rsi, f2_macdH, f3_adx, f4_obv, f5_bbWidth]];

    const predictionResult = this.rfClassifier.predict(featureVector);
    let computedProb: number = predictionResult[0];

    // Voting probability dari semua decision tree
    try {
      const estimators = (this.rfClassifier as any).estimators;
      if (estimators && estimators.length > 0) {
        let votesFor1 = 0;
        for (let i = 0; i < estimators.length; i++) {
          if (estimators[i].predict(featureVector)[0] === 1) votesFor1++;
        }
        computedProb = votesFor1 / estimators.length;
      }
    } catch (_) {}

    return computedProb;
  }

  // ── Confidence & Breakout ─────────────────────────────────────────────────

  private computeConfidence(
    probability: number,
    indicators: TechIndicators,
    lstmReversalRisk: number
  ): number {
    const predictabilityFactor = Math.abs(probability - 0.5) * 2;
    const trendFactor = Math.min(1.0, indicators.adx / 60);
    const reversalDampener = 1.0 - lstmReversalRisk * 0.4;
    const rawConfidence = predictabilityFactor * 0.5 + trendFactor * 0.5;
    return Math.max(0.3, Math.min(0.95, rawConfidence * reversalDampener));
  }

  private calculateBreakoutFactor(
    indicators: TechIndicators,
    lastPrice: number
  ): number {
    const bbRange = indicators.bbUpper - indicators.bbLower || 1;
    const bandProximity = (lastPrice - indicators.bbLower) / bbRange;
    const squeezedBands =
      (indicators.bbUpper - indicators.bbLower) / indicators.bbMiddle < 0.03;

    let breakoutFactor = bandProximity * 0.6 + (indicators.adx / 80) * 0.4;
    if (squeezedBands) breakoutFactor += 0.25;

    return Math.max(0, Math.min(1.0, breakoutFactor));
  }

  private generateEmptyPrediction(): MLPrediction {
    return {
      probability: 0.5,
      confidence: 0.5,
      momentumScore: 50,
      breakoutProbability: 0,
      trendDirection: "NEUTRAL",
      estimatedFutureCandles: [],
    };
  }
}
