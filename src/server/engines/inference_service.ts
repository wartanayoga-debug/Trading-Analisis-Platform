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
    const rfModel = this.registry.getLatestModel("RandomForestClassifier");

    let prob = 0.5;
    if (rfModel) {
      console.log(`[Inference Service] Found Institutional Artifact: ${rfModel.modelId}`);
      // As a simulation of complex institutional artifacts vs local fast models,
      // we inject a slight variance but keep it mathematically driven by features.
      prob = currentFeatures.features.rsi / 100 * 0.4 + (currentFeatures.features.macdHist > 0 ? 0.3 : 0.2);
    }

    return { probability: prob, target: "BINARY" };
  }
}
