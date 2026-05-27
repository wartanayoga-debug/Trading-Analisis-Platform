import { MLDatasetRow } from "./dataset_builder";
import { ExperimentTracker } from "./experiment_tracking";
import { ArtifactRegistry, ModelArtifact } from "./artifact_registry";

export class ModelTrainingService {
  private static instance: ModelTrainingService;
  private tracker = ExperimentTracker.getInstance();
  private registry = ArtifactRegistry.getInstance();

  private constructor() {}

  public static getInstance(): ModelTrainingService {
    if (!ModelTrainingService.instance) {
      ModelTrainingService.instance = new ModelTrainingService();
    }
    return ModelTrainingService.instance;
  }

  /**
   * Simulates HPO via Optuna and trains the best configuration for ML (LightGBM) or DL (PyTorch)
   */
  public async train(
    targetMode: "BINARY" | "REGRESSION",
    trainData: MLDatasetRow[],
    valData: MLDatasetRow[],
  ): Promise<ModelArtifact> {
    console.log(`[Optuna HPO] Starting hyperparameter optimization trials...`);

    // Simulate Optuna Trials
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Pick winner based on simple logic for demo
    const architecture = targetMode === "BINARY" ? "LightGBM" : "PyTorch";
    const bestTrialId = `trial_${Math.floor(Math.random() * 100)}`;

    const mockValAccuracy = 0.72 + Math.random() * 0.1;
    const mockValLoss = 0.4 - Math.random() * 0.1;

    const modelId = `model_${architecture}_${Date.now()}`;
    const params =
      architecture === "LightGBM"
        ? { learning_rate: 0.01, num_leaves: 31, max_depth: -1 }
        : { lr: 1e-4, hidden_dim: 256, dropout: 0.2 };

    // Log to MLflow
    this.tracker.logRun({
      runId: modelId,
      modelName: architecture,
      timestamp: Date.now(),
      hyperparameters: params,
      metrics: {
        accuracy: mockValAccuracy,
        f1Score: mockValAccuracy * 0.95,
        logLoss: mockValLoss,
        sharpeRatio: 1.5,
      },
      status: "COMPLETED",
    });

    const artifact: ModelArtifact = {
      modelId,
      architecture,
      hyperparameters: params,
      metrics: {
        val_accuracy: mockValAccuracy,
        val_loss: mockValLoss,
        optuna_trial_id: bestTrialId,
      },
      storagePath: `s3://quant-models/production/${modelId}.pkl`,
      createdAt: Date.now(),
    };

    this.registry.registerArtifact(artifact);

    console.log(
      `[Model Training] ${architecture} training complete. Optuna Best Trial: ${bestTrialId}. Validation Acc: ${mockValAccuracy.toFixed(3)}`,
    );
    return artifact;
  }
}
