import { ArtifactRegistry } from "./artifact_registry";
import { FeatureRecord } from "./feature_store";

export class InferenceService {
  private static instance: InferenceService;
  private registry = ArtifactRegistry.getInstance();

  private constructor() {}

  public static getInstance(): InferenceService {
    if (!InferenceService.instance) {
      InferenceService.instance = new InferenceService();
    }
    return InferenceService.instance;
  }

  public predict(currentFeatures: Pick<FeatureRecord, "features">): {
    probability: number;
    target: "BINARY" | "REGRESSION";
  } {
    const lgbm = this.registry.getLatestModel("LightGBM");
    const pytorch = this.registry.getLatestModel("PyTorch");

    // Simulate inference
    let prob = 0.5;
    if (lgbm || pytorch) {
      // Ensembling or picking best
      console.log(
        `[Inference Service] Loading models from Artifact Registry for prediction...`,
      );
      // Incorporate indicators into output
      prob =
        (currentFeatures.features.rsi / 100 +
          (currentFeatures.features.macdHist > 0 ? 0.6 : 0.4)) /
        2;
    }

    return { probability: prob, target: "BINARY" };
  }
}
