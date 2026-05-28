/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path from "path";
import { HistoricalPrediction, SystemCalibration } from "../../types/index";

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "db.json");

interface DatabaseSchema {
  predictions: HistoricalPrediction[];
  calibration: SystemCalibration;
  lastScanTimestamp: string | null;
}

const DEFAULT_CALIBRATION: SystemCalibration = {
  idxWeight: 1.0,
  cryptoWeight: 1.0,
  globalAccuracyTracker: {
    totalPredictions: 0,
    successfulPredictions: 0,
    overallAccuracy: 0.0,
  },
};

const DEFAULT_DB: DatabaseSchema = {
  predictions: [],
  calibration: DEFAULT_CALIBRATION,
  lastScanTimestamp: null,
};

export class LocalDatabase {
  private static instance: LocalDatabase;
  private memoryCache: DatabaseSchema = DEFAULT_DB;

  private constructor() {
    this.ensureDbExists();
    this.loadFromDisk();
  }

  public static getInstance(): LocalDatabase {
    if (!LocalDatabase.instance) {
      LocalDatabase.instance = new LocalDatabase();
    }
    return LocalDatabase.instance;
  }

  private ensureDbExists() {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), "utf8");
      }
    } catch (err) {
      console.error("[Database] Error ensuring DB directories/files exist:", err);
    }
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf8");
        this.memoryCache = JSON.parse(raw);
      }
    } catch (err) {
      console.error("[Database] Error loading database from disk. Resetting:", err);
      this.memoryCache = { ...DEFAULT_DB };
    }
  }

  private saveToDisk() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.memoryCache, null, 2), "utf8");
    } catch (err) {
      console.error("[Database] Failed to write database to disk:", err);
    }
  }

  public getPredictions(): HistoricalPrediction[] {
    return this.memoryCache.predictions;
  }

  public addPrediction(pred: HistoricalPrediction) {
    this.memoryCache.predictions.push(pred);
    this.saveToDisk();
  }

  public updatePrediction(id: string, updates: Partial<HistoricalPrediction>) {
    const idx = this.memoryCache.predictions.findIndex((p) => p.id === id);
    if (idx !== -1) {
      this.memoryCache.predictions[idx] = {
        ...this.memoryCache.predictions[idx],
        ...updates,
      };
      this.recalculateCalibration();
      this.saveToDisk();
    }
  }

  public getCalibration(): SystemCalibration {
    return this.memoryCache.calibration;
  }

  public updateCalibration(updates: Partial<SystemCalibration>) {
    this.memoryCache.calibration = {
      ...this.memoryCache.calibration,
      ...updates,
    };
    this.saveToDisk();
  }

  public setLastScanTimestamp(timestamp: string) {
    this.memoryCache.lastScanTimestamp = timestamp;
    this.saveToDisk();
  }

  public getLastScanTimestamp(): string | null {
    return this.memoryCache.lastScanTimestamp;
  }

  public clearAll() {
    this.memoryCache = {
      predictions: [],
      calibration: { ...DEFAULT_CALIBRATION },
      lastScanTimestamp: null,
    };
    this.saveToDisk();
  }

  private recalculateCalibration() {
    const predictions = this.memoryCache.predictions;
    const audited = predictions.filter((p) => p.success !== undefined);
    
    if (audited.length === 0) {
      this.memoryCache.calibration.globalAccuracyTracker = {
        totalPredictions: 0,
        successfulPredictions: 0,
        overallAccuracy: 0.0,
      };
      return;
    }

    const successful = audited.filter((p) => p.success === true).length;
    const accuracy = successful / audited.length;

    // Separate accuracy analysis to dynamically calibrate weights for multi-model feedback loops
    const idxAudited = audited.filter((p) => p.assetClass === "IDX");
    const idxSuccess = idxAudited.filter((p) => p.success === true).length;
    const idxAcc = idxAudited.length > 0 ? idxSuccess / idxAudited.length : 0.5;

    const cryptoAudited = audited.filter((p) => p.assetClass === "CRYPTO");
    const cryptoSuccess = cryptoAudited.filter((p) => p.success === true).length;
    const cryptoAcc = cryptoAudited.length > 0 ? cryptoSuccess / cryptoAudited.length : 0.5;

    // Self-learning logic to adjust calibration model weights:
    // Symmetrical weights scaling around standard 1.0 mapping baseline
    const baseIdxWeight = 0.5 + idxAcc;
    const baseCryptoWeight = 0.5 + cryptoAcc;

    this.memoryCache.calibration = {
      idxWeight: Number(baseIdxWeight.toFixed(3)),
      cryptoWeight: Number(baseCryptoWeight.toFixed(3)),
      globalAccuracyTracker: {
        totalPredictions: audited.length,
        successfulPredictions: successful,
        overallAccuracy: Number(accuracy.toFixed(3)),
      },
    };
  }
}
