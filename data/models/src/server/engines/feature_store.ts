import { TechIndicators, Candle } from "../../types";
import path from "path";
import fs from "fs";

export interface FeatureRecord {
  ticker: string;
  timestamp: number;
  features: TechIndicators;
  candles: Candle[];
  regime: string;
}

interface PersistedFeatureRow {
  timestamp: string;
  asset: string;
  feature_name: string;
  feature_value: number;
  feature_version: string;
}

export class FeatureStore {
  private static instance: FeatureStore;
  private storagePath: string;
  private rows: PersistedFeatureRow[] = [];

  private constructor() {
    const dbDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.storagePath = path.join(dbDir, "feature_store.json");

    if (fs.existsSync(this.storagePath)) {
      try {
        const raw = fs.readFileSync(this.storagePath, "utf8");
        this.rows = JSON.parse(raw);
      } catch {
        this.rows = [];
      }
    }
  }

  public static getInstance(): FeatureStore {
    if (!FeatureStore.instance) {
      FeatureStore.instance = new FeatureStore();
    }
    return FeatureStore.instance;
  }

  private persist() {
    fs.writeFileSync(this.storagePath, JSON.stringify(this.rows, null, 2), "utf8");
  }

  public saveFeatures(
    ticker: string,
    features: TechIndicators,
    candles: Candle[],
    regime: string,
  ): void {
    const timestamp = new Date().toISOString();
    const version = "1.0.0";

    for (const [key, value] of Object.entries(features)) {
      if (typeof value === "number") {
        this.rows.push({
          timestamp,
          asset: ticker,
          feature_name: key,
          feature_value: value,
          feature_version: version,
        });
      }
    }

    this.persist();
  }

  public getFeaturesRaw(ticker?: string) {
    const rows = ticker
      ? this.rows.filter((r) => r.asset === ticker)
      : this.rows;

    return rows.slice(-1000).reverse();
  }

  // Legacy method to keep pipeline unbroken for now
  public getFeatures(ticker: string): FeatureRecord[] {
    return [];
  }
}
