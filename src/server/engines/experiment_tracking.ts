export interface ExperimentRun {
  runId: string;
  modelName: string;
  timestamp: number;
  hyperparameters: Record<string, any>;
  metrics: {
    accuracy: number;
    f1Score: number;
    logLoss: number;
    sharpeRatio: number;
  };
  status: "COMPLETED" | "FAILED" | "RUNNING";
}

export class ExperimentTracker {
  private static instance: ExperimentTracker;
  private runs: ExperimentRun[] = [];

  private constructor() {}

  public static getInstance(): ExperimentTracker {
    if (!ExperimentTracker.instance) {
      ExperimentTracker.instance = new ExperimentTracker();
    }
    return ExperimentTracker.instance;
  }

  public logRun(run: ExperimentRun): void {
    this.runs.push(run);
    console.log(
      `[MLFlow Tracker] Logged Run: ${run.runId} - Acc: ${run.metrics.accuracy.toFixed(3)}`,
    );
  }

  public getBestRun(): ExperimentRun | null {
    if (this.runs.length === 0) return null;
    return this.runs.sort((a, b) => b.metrics.accuracy - a.metrics.accuracy)[0];
  }

  public getAllRuns(): ExperimentRun[] {
    return this.runs;
  }
}
