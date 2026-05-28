/**
 * LSTM Forecaster — Real Neural Network via TensorFlow.js
 *
 * Dua model LSTM yang sesungguhnya:
 *   1. Forecast Model  → memprediksi 5 harga candle ke depan
 *   2. Reversal Model  → mendeteksi probabilitas pembalikan arah (bull/bear trap)
 *
 * Bobot model disimpan ke disk (data/models/lstm/) dan di-load ulang saat server restart.
 * Model otomatis melatih dirinya sendiri setiap kali training pipeline berjalan.
 */

import * as tf from "@tensorflow/tfjs-node";
import * as fs from "fs";
import * as path from "path";
import { Candle } from "../../types";

// ─── Hyperparameters ──────────────────────────────────────────────────────────
const LOOK_BACK = 20;      // Panjang sequence input (20 candle terakhir)
const FORECAST_STEPS = 5;  // Jumlah candle ke depan yang diprediksi
const NUM_FEATURES = 4;    // [log_return, volume_change, hl_ratio, obv_norm]
const MODEL_DIR = path.join(process.cwd(), "data", "models", "lstm");
// ─────────────────────────────────────────────────────────────────────────────

export class LSTMForecaster {
  private static instance: LSTMForecaster;

  private forecastModel: tf.LayersModel | null = null;
  private reversalModel: tf.LayersModel | null = null;
  private isReady = false;

  private constructor() {}

  public static getInstance(): LSTMForecaster {
    if (!LSTMForecaster.instance) {
      LSTMForecaster.instance = new LSTMForecaster();
      LSTMForecaster.instance.initialize().catch((e) =>
        console.error("[LSTM] Init error:", e)
      );
    }
    return LSTMForecaster.instance;
  }

  // ── Inisialisasi: Load dari disk atau buat model baru ──────────────────────

  private async initialize(): Promise<void> {
    if (!fs.existsSync(MODEL_DIR)) {
      fs.mkdirSync(MODEL_DIR, { recursive: true });
    }

    const forecastPath = path.join(MODEL_DIR, "forecast");
    const reversalPath = path.join(MODEL_DIR, "reversal");

    // Forecast Model
    if (fs.existsSync(path.join(forecastPath, "model.json"))) {
      try {
        this.forecastModel = await tf.loadLayersModel(
          `file://${forecastPath}/model.json`
        );
        this.forecastModel.compile({
          optimizer: tf.train.adam(0.001),
          loss: "meanSquaredError",
          metrics: ["mae"],
        });
        console.log("[LSTM] Forecast model loaded from disk.");
      } catch {
        this.forecastModel = this.buildForecastModel();
        console.log("[LSTM] Forecast model rebuilt (load failed).");
      }
    } else {
      this.forecastModel = this.buildForecastModel();
      console.log("[LSTM] New forecast model created.");
    }

    // Reversal Model
    if (fs.existsSync(path.join(reversalPath, "model.json"))) {
      try {
        this.reversalModel = await tf.loadLayersModel(
          `file://${reversalPath}/model.json`
        );
        this.reversalModel.compile({
          optimizer: tf.train.adam(0.001),
          loss: "binaryCrossentropy",
          metrics: ["accuracy"],
        });
        console.log("[LSTM] Reversal model loaded from disk.");
      } catch {
        this.reversalModel = this.buildReversalModel();
        console.log("[LSTM] Reversal model rebuilt (load failed).");
      }
    } else {
      this.reversalModel = this.buildReversalModel();
      console.log("[LSTM] New reversal model created.");
    }

    this.isReady = true;
  }

  // ── Arsitektur Model ───────────────────────────────────────────────────────

  private buildForecastModel(): tf.LayersModel {
    /**
     * LSTM 2-layer untuk regresi harga:
     *   Input  : [batch, 20 timesteps, 4 features]
     *   Output : [batch, 5] — log-return untuk 5 candle ke depan
     */
    const model = tf.sequential({
      layers: [
        tf.layers.lstm({
          units: 48,
          inputShape: [LOOK_BACK, NUM_FEATURES],
          returnSequences: true,
          name: "lstm_forecast_1",
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.lstm({
          units: 24,
          returnSequences: false,
          name: "lstm_forecast_2",
        }),
        tf.layers.dense({ units: 16, activation: "relu" }),
        tf.layers.dense({
          units: FORECAST_STEPS,
          activation: "linear",
          name: "price_output",
        }),
      ],
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "meanSquaredError",
      metrics: ["mae"],
    });

    return model;
  }

  private buildReversalModel(): tf.LayersModel {
    /**
     * LSTM 1-layer untuk klasifikasi biner:
     *   Input  : [batch, 20 timesteps, 4 features]
     *   Output : [batch, 1] — probabilitas pembalikan arah (0=lanjut, 1=reversal)
     */
    const model = tf.sequential({
      layers: [
        tf.layers.lstm({
          units: 32,
          inputShape: [LOOK_BACK, NUM_FEATURES],
          returnSequences: false,
          name: "lstm_reversal",
        }),
        tf.layers.dropout({ rate: 0.25 }),
        tf.layers.dense({ units: 16, activation: "relu" }),
        tf.layers.dense({
          units: 1,
          activation: "sigmoid",
          name: "reversal_output",
        }),
      ],
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "binaryCrossentropy",
      metrics: ["accuracy"],
    });

    return model;
  }

  // ── Feature Engineering ────────────────────────────────────────────────────

  /**
   * Mengekstrak matrix fitur dari candle history.
   * Setiap baris = satu timestep dengan 4 fitur:
   *   [0] log_return      : perubahan harga sebagai log (scale: ±0.1)
   *   [1] volume_change   : perubahan volume relatif terhadap EMA (scale: ±1)
   *   [2] hl_ratio        : (high-low)/close — proxy volatilitas (scale: 0-0.2)
   *   [3] obv_norm        : OBV kumulatif dinormalisasi via tanh (scale: ±1)
   */
  private extractFeatureMatrix(candles: Candle[]): number[][] {
    const matrix: number[][] = [];
    let volEma = candles[0]?.volume || 1;
    let obvCumulative = 0;

    for (let i = 1; i < candles.length; i++) {
      const prev = candles[i - 1];
      const curr = candles[i];

      // [0] Log return — lebih stabil dari persentase biasa
      const logReturn = Math.log(curr.close / Math.max(prev.close, 0.0001));

      // [1] Volume change — normalisasi terhadap EMA volume
      const volChange = volEma > 0 ? (curr.volume - prev.volume) / (volEma + 1) : 0;
      volEma = volEma * 0.9 + curr.volume * 0.1; // Wilder EMA

      // [2] High-Low ratio sebagai proxy intrabar volatility
      const hlRatio = curr.close > 0 ? (curr.high - curr.low) / curr.close : 0;

      // [3] OBV kumulatif di-squash ke [-1, 1] via tanh
      if (curr.close > prev.close) obvCumulative += curr.volume;
      else if (curr.close < prev.close) obvCumulative -= curr.volume;
      const obvNorm = Math.tanh(obvCumulative / (volEma * 100 + 1));

      matrix.push([
        Math.max(-0.1, Math.min(0.1, logReturn)),
        Math.max(-1, Math.min(1, volChange)),
        Math.max(0, Math.min(0.2, hlRatio)),
        obvNorm,
      ]);
    }

    return matrix;
  }

  // ── Training ───────────────────────────────────────────────────────────────

  /**
   * Melatih kedua model LSTM pada data candle historis.
   * Dipanggil oleh training pipeline setiap kali ada cukup data baru.
   */
  public async trainOnCandles(
    candles: Candle[]
  ): Promise<{ forecastMse: number; reversalAcc: number }> {
    const minRequired = LOOK_BACK + FORECAST_STEPS + 20;
    if (!this.isReady || !this.forecastModel || !this.reversalModel) {
      return { forecastMse: 0, reversalAcc: 0 };
    }
    if (candles.length < minRequired) {
      console.warn(
        `[LSTM] Perlu minimal ${minRequired} candle untuk training, saat ini: ${candles.length}`
      );
      return { forecastMse: 0, reversalAcc: 0 };
    }

    const features = this.extractFeatureMatrix(candles);

    // Bangun dataset training
    const X: number[][][] = [];
    const Y_forecast: number[][] = [];
    const Y_reversal: number[][] = [];

    for (let i = LOOK_BACK; i < features.length - FORECAST_STEPS; i++) {
      const sequence = features.slice(i - LOOK_BACK, i);
      const futureReturns = features
        .slice(i, i + FORECAST_STEPS)
        .map((f) => f[0]);

      X.push(sequence);
      Y_forecast.push(futureReturns);

      // Label reversal: 1 jika tren berbalik arah signifikan
      const currentMomentum = features[i - 1][0];
      const futureNet = futureReturns.reduce((a, b) => a + b, 0);
      const isReversal =
        (currentMomentum > 0.002 && futureNet < -0.003) ||
        (currentMomentum < -0.002 && futureNet > 0.003)
          ? 1
          : 0;
      Y_reversal.push([isReversal]);
    }

    if (X.length < 10) {
      console.warn("[LSTM] Dataset terlalu kecil untuk training.");
      return { forecastMse: 0, reversalAcc: 0 };
    }

    console.log(`[LSTM] Melatih model pada ${X.length} sequences...`);

    // Train Forecast Model
    const xTensor = tf.tensor3d(X);
    const yFTensor = tf.tensor2d(Y_forecast);

    const forecastHistory = await this.forecastModel.fit(xTensor, yFTensor, {
      epochs: 8,
      batchSize: Math.min(32, X.length),
      validationSplit: 0.15,
      shuffle: true,
      verbose: 0,
    });

    const forecastMse = forecastHistory.history["loss"][
      forecastHistory.history["loss"].length - 1
    ] as number;

    // Train Reversal Model
    const yRTensor = tf.tensor2d(Y_reversal);

    const reversalHistory = await this.reversalModel.fit(xTensor, yRTensor, {
      epochs: 8,
      batchSize: Math.min(32, X.length),
      validationSplit: 0.15,
      shuffle: true,
      verbose: 0,
    });

    const accKey =
      Object.keys(reversalHistory.history).find((k) => k.includes("acc")) ||
      "acc";
    const reversalAcc =
      (reversalHistory.history[accKey]?.[
        reversalHistory.history[accKey].length - 1
      ] as number) || 0.5;

    // Bersihkan tensor dari memori GPU/CPU
    xTensor.dispose();
    yFTensor.dispose();
    yRTensor.dispose();

    // Simpan bobot ke disk
    await this.saveModels();

    console.log(
      `[LSTM] Training selesai. Forecast MSE: ${forecastMse.toFixed(6)}, Reversal Acc: ${reversalAcc.toFixed(3)}`
    );
    return { forecastMse, reversalAcc };
  }

  // ── Inference (Prediksi) ───────────────────────────────────────────────────

  /**
   * Memprediksi 5 harga candle ke depan menggunakan LSTM forecast model.
   * Mengembalikan array harga absolut (bukan return).
   */
  public forecastPrices(candles: Candle[]): number[] {
    if (!this.isReady || !this.forecastModel || candles.length < LOOK_BACK + 1) {
      return this.linearFallback(candles);
    }

    try {
      const features = this.extractFeatureMatrix(candles);
      const sequence = features.slice(-LOOK_BACK);

      if (sequence.length < LOOK_BACK) return this.linearFallback(candles);

      // Inference — synchronous
      const inputTensor = tf.tensor3d([sequence]);
      const outputTensor = this.forecastModel.predict(
        inputTensor
      ) as tf.Tensor;
      const predictedReturns = Array.from(outputTensor.dataSync());

      inputTensor.dispose();
      outputTensor.dispose();

      // Konversi log-return kembali ke harga absolut
      let price = candles[candles.length - 1].close;
      return predictedReturns.map((logR) => {
        price = price * Math.exp(Math.max(-0.05, Math.min(0.05, logR)));
        return Number(price.toFixed(4));
      });
    } catch (e) {
      console.error("[LSTM] Forecast error:", e);
      return this.linearFallback(candles);
    }
  }

  /**
   * Mengembalikan probabilitas pembalikan arah [0, 1] menggunakan LSTM reversal model.
   * > 0.65 = risiko reversal tinggi (bull/bear trap)
   */
  public getReversalProbability(candles: Candle[]): number {
    if (!this.isReady || !this.reversalModel || candles.length < LOOK_BACK + 1) {
      return 0.25; // Default: risiko reversal rendah
    }

    try {
      const features = this.extractFeatureMatrix(candles);
      const sequence = features.slice(-LOOK_BACK);

      if (sequence.length < LOOK_BACK) return 0.25;

      const inputTensor = tf.tensor3d([sequence]);
      const outputTensor = this.reversalModel.predict(
        inputTensor
      ) as tf.Tensor;
      const prob = outputTensor.dataSync()[0];

      inputTensor.dispose();
      outputTensor.dispose();

      return Math.max(0, Math.min(1, prob));
    } catch (e) {
      console.error("[LSTM] Reversal detection error:", e);
      return 0.25;
    }
  }

  // ── Fallback ───────────────────────────────────────────────────────────────

  /**
   * Digunakan saat LSTM belum siap (sebelum training pertama).
   * Linear momentum decay — jauh lebih jujur daripada label "Chronos 2.0".
   */
  private linearFallback(candles: Candle[]): number[] {
    const last = candles[candles.length - 1];
    const slice = candles.slice(-15);
    let sumDx = 0;
    for (let i = 1; i < slice.length; i++) {
      sumDx += (slice[i].close - slice[i - 1].close) / (slice[i - 1].close || 1);
    }
    const drift = sumDx / (slice.length - 1);
    let price = last.close;
    return Array.from({ length: FORECAST_STEPS }, (_, s) => {
      price = price * (1 + drift * (1 / (1 + s * 0.1)));
      return Number(price.toFixed(4));
    });
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  private async saveModels(): Promise<void> {
    try {
      if (this.forecastModel) {
        await this.forecastModel.save(
          `file://${path.join(MODEL_DIR, "forecast")}`
        );
      }
      if (this.reversalModel) {
        await this.reversalModel.save(
          `file://${path.join(MODEL_DIR, "reversal")}`
        );
      }
      console.log("[LSTM] Bobot model tersimpan ke disk.");
    } catch (e) {
      console.error("[LSTM] Error menyimpan model:", e);
    }
  }

  public get ready(): boolean {
    return this.isReady;
  }
}
