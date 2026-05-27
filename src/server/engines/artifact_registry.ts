export interface ModelArtifact {
  modelId: string;
  architecture: "LightGBM" | "PyTorch";
  hyperparameters: Record<string, any>;
  metrics: {
    val_accuracy?: number;
    val_loss?: number;
    optuna_trial_id?: string;
  };
  storagePath: string; // e.g., "s3://models/..."
  createdAt: number;
}

export class ArtifactRegistry {
  private static instance: ArtifactRegistry;
  private artifacts: Map<string, ModelArtifact> = new Map();

  private constructor() {}

  public static getInstance(): ArtifactRegistry {
    if (!ArtifactRegistry.instance) {
      ArtifactRegistry.instance = new ArtifactRegistry();
    }
    return ArtifactRegistry.instance;
  }

  public registerArtifact(artifact: ModelArtifact): void {
    this.artifacts.set(artifact.modelId, artifact);
    console.log(
      `[Artifact Registry] Saved ${artifact.architecture} model: ${artifact.modelId} to ${artifact.storagePath}`,
    );
  }

  public getModel(modelId: string): ModelArtifact | undefined {
    return this.artifacts.get(modelId);
  }

  public getLatestModel(architecture?: string): ModelArtifact | undefined {
    const list = Array.from(this.artifacts.values());
    if (list.length === 0) return undefined;

    if (architecture) {
      const filtered = list.filter((a) => a.architecture === architecture);
      return filtered.sort((a, b) => b.createdAt - a.createdAt)[0];
    }
    return list.sort((a, b) => b.createdAt - a.createdAt)[0];
  }
}
