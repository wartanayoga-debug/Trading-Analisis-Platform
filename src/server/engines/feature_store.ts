import { TechIndicators, Candle } from "../../types";

export interface FeatureRecord {
  ticker: string;
  timestamp: number;
  features: TechIndicators;
  candles: Candle[];
  regime: string;
}

export class FeatureStore {
  private static instance: FeatureStore;
  private store: Map<string, FeatureRecord[]> = new Map();

  private constructor() {}

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
    const record: FeatureRecord = {
      ticker,
      timestamp: Date.now(),
      features,
      candles,
      regime,
    };

    const existing = this.store.get(ticker) || [];
    existing.push(record);
    // Keep last 1000 features per ticker for training memory
    if (existing.length > 1000) {
      existing.shift();
    }
    this.store.set(ticker, existing);
  }

  public getFeatures(ticker: string): FeatureRecord[] {
    return this.store.get(ticker) || [];
  }
}
