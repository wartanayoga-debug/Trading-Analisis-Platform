import { FeatureStore } from "./feature_store";
import { DatasetBuilder } from "./dataset_builder";
import { ModelTrainingService } from "./model_training";
import { MarketDataEngine } from "./data.engine";

export class RealTrainingPipeline {
  private static instance: RealTrainingPipeline;
  private featureStore = FeatureStore.getInstance();
  private datasetBuilder = DatasetBuilder.getInstance();
  private modelTrainer = ModelTrainingService.getInstance();

  private constructor() {}

  public static getInstance(): RealTrainingPipeline {
    if (!RealTrainingPipeline.instance) {
      RealTrainingPipeline.instance = new RealTrainingPipeline();
    }
    return RealTrainingPipeline.instance;
  }

  /**
   * Triggers an asynchronous training pipeline loop on stored features
   * Architecture: Institutional ML Pipeline
   */
  public async triggerTrainingPipeline(modelName: string): Promise<void> {
    console.log(
      `[Training Pipeline] Initiating institutional learning loop...`,
    );

    // Grab all raw features from SQLite
    const rawFeatures = this.featureStore.getFeaturesRaw();

    // Group raw features by timestamp and asset to reconstruct the feature object
    const groupedRecords: Record<string, any> = {};
    for (const row of rawFeatures) {
        const key = `${row.asset}_${row.timestamp}`;
        if (!groupedRecords[key]) {
            groupedRecords[key] = {
                ticker: row.asset,
                timestamp: row.timestamp,
                features: {}
            };
        }
        groupedRecords[key].features[row.feature_name] = row.feature_value;
    }

    const uniqueAssets = Array.from(new Set(Object.values(groupedRecords).map((r: any) => r.ticker)));
    const candleMap: Record<string, any[]> = {};
    const marketEngine = MarketDataEngine.getInstance();
    
    for (const asset of uniqueAssets) {
        // Determine asset class dynamically (simple heuristic)
        const assetClass = (asset as string).endsWith(".JK") ? "IDX" : "CRYPTO";
        candleMap[asset as string] = await marketEngine.getHistory(asset as string, assetClass, "1h", 50);
    }

    const records: any[] = Object.values(groupedRecords).map((record: any) => {
        return {
          ...record,
          candles: candleMap[record.ticker], 
        }
    });

    if (records.length < 20) {
      console.log(
        `[Training Pipeline] Not enough records yet (${records.length}). Skipping training.`,
      );
      return;
    }

    // Dataset Builder Node: Extracts Polars-like DataFrames
    // Target binary threshold = 0.015 (1.5% return)
    const dataset = this.datasetBuilder.buildDataset(records, 12, 0.015);

    if (dataset.length === 0) return;

    // Train/Validation Split Node
    const { train, val } = this.datasetBuilder.purgedWalkForwardValidation(
      dataset,
      5,
      3,
    );

    // Model Training & HPO Node -> Artifact Registry
    await this.modelTrainer.train("BINARY", train, val);

    console.log(`[Training Pipeline] Institutional training epoch completed.`);
  }
}

