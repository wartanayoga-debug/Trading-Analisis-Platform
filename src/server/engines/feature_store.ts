import { TechIndicators, Candle } from "../../types";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

export interface FeatureRecord {
  ticker: string;
  timestamp: number;
  features: TechIndicators;
  candles: Candle[];
  regime: string;
}

export class FeatureStore {
  private static instance: FeatureStore;
  private db: Database.Database;

  private constructor() {
    const dbDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    this.db = new Database(path.join(dbDir, "feature_store.db"));
    this.initializeSchema();
  }

  private initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS features (
        timestamp TIMESTAMP,
        asset TEXT,
        feature_name TEXT,
        feature_value DOUBLE PRECISION,
        feature_version TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_features_asset ON features(asset);
    `);
  }

  public static getInstance(): FeatureStore {
    if (!FeatureStore.instance) {
      FeatureStore.instance = new FeatureStore();
    }
    return FeatureStore.instance;
  }

  public saveFeatures(
    ticker: string,
    features: TechIndicators,
    candles: Candle[],
    regime: string,
  ): void {
    const timestamp = new Date().toISOString();
    const version = "1.0.0";

    // We insert a row for each feature dynamically to match the schema
    const insert = this.db.prepare(
      `INSERT INTO features (timestamp, asset, feature_name, feature_value, feature_version) 
       VALUES (?, ?, ?, ?, ?)`,
    );

    const transaction = this.db.transaction(() => {
      for (const [key, value] of Object.entries(features)) {
        if (typeof value === "number") {
          insert.run(timestamp, ticker, key, value, version);
        }
      }
    });

    transaction();
  }

  public getFeaturesRaw(ticker?: string) {
    if (ticker) {
      const stmt = this.db.prepare(
        `SELECT * FROM features WHERE asset = ? ORDER BY timestamp DESC LIMIT 1000`,
      );
      return stmt.all(ticker);
    }
    const stmt = this.db.prepare(
      `SELECT * FROM features ORDER BY timestamp DESC LIMIT 1000`,
    );
    return stmt.all();
  }

  // Legacy method to keep pipeline unbroken for now, although we migrate dataset builder later
  public getFeatures(ticker: string): FeatureRecord[] {
    // Return mock full records since it is hard to reconstruct 'candles' which aren't in this table
    // In a real TS pipeline we'd reconstruct or store candles elsewhere.
    return [];
  }
}
