import { FeatureStore } from "./feature_store";
import { DatasetBuilder } from "./dataset_builder";
import { ModelTrainingService } from "./model_training";

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

    // In a real scenario we grab features for all tickers
    // Grab all raw features from SQLite
    const rawFeatures = this.featureStore.getFeaturesRaw();
    // Reformat slightly to simulate the previous structures for the pipeline
    // This maintains continuity of the demo while utilizing SQLite
    const records: any[] = rawFeatures.map((row: any) => ({
      ticker: row.asset,
      timestamp: row.timestamp,
      features: {
        [row.feature_name]: row.feature_value,
      },
      candles: [{ close: 100 }, { close: 105 }], // Mock candles for validation
    }));

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
