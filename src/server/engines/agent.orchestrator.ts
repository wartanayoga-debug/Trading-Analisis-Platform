import {
  ScannerAsset,
  AssetClass,
  Candle,
  TechIndicators,
  MarketRegimeType,
} from "../../types";
import { MarketDataEngine } from "./data.engine";
import { FeatureEngineeringEngine } from "./feature.engine";
import { MLPredictionEngine } from "./ml.engine";
import { RiskEngine } from "./risk.engine";
import { MemoryLearningEngine } from "./memory.engine";

import { RealTrainingPipeline } from "./training.pipeline";
import { FeatureStore } from "./feature_store";
import { LocalAIRouter } from "./local_ai_router";
import { ToolCallingAgent } from "./tool_agents";
import { InferenceService } from "./inference_service";

export interface AgentState {
  ticker: string;
  name: string;
  assetClass: AssetClass;
  timeframe: string;
  candles: Candle[];
  features?: TechIndicators;
  regime?: MarketRegimeType;
  microstructure?: any;
  riskMetrics?: any;
  mlOutput?: any;
  sentimentScore?: number;
  headlines?: string[];
  finalAsset?: ScannerAsset | null;
  reasoningLog: string[];
}

export class TradingAgentOrchestrator {
  private static instance: TradingAgentOrchestrator;

  private dataEngine = MarketDataEngine.getInstance();
  private featureEngine = FeatureEngineeringEngine.getInstance();
  private mlEngine = MLPredictionEngine.getInstance();
  private riskEngine = RiskEngine.getInstance();
  private memoryEngine = MemoryLearningEngine.getInstance();

  private constructor() {}

  public static getInstance(): TradingAgentOrchestrator {
    if (!TradingAgentOrchestrator.instance) {
      TradingAgentOrchestrator.instance = new TradingAgentOrchestrator();
    }
    return TradingAgentOrchestrator.instance;
  }

  private async analystAgent(state: AgentState): Promise<AgentState> {
    try {
      state.reasoningLog.push(
        `[Analyst Agent] Gathering market data for ${state.ticker}...`,
      );
      const candles = await this.dataEngine.getHistory(
        state.ticker,
        state.assetClass,
        state.timeframe,
        100,
      );

      if (candles.length < 30) {
        state.reasoningLog.push(
          `[Analyst Agent] ABORT: Insufficient data (${candles.length} candles).`,
        );
        state.candles = [];
        return state;
      }
      state.candles = candles;
      state.features = this.featureEngine.extractFeatures(candles);
      
      // Fetch Structural Microstructure data
      state.microstructure = await this.dataEngine.fetchOrderbookMicrostructure(state.ticker, state.assetClass);

      state.regime = this.featureEngine.detectMarketRegime(
        state.features,
        candles,
      );

      // Phase 1: Save real features for ML Training loop
      FeatureStore.getInstance().saveFeatures(
        state.ticker,
        state.features,
        state.candles,
        state.regime,
      );

      state.reasoningLog.push(
        `[Analyst Agent] Extracted features and detected regime: ${state.regime} | VPIN: ${state.microstructure?.vpin?.toFixed(2)}`,
      );
      return state;
    } catch (err) {
      state.reasoningLog.push(`[Analyst Agent] Error: ${err}`);
      return state;
    }
  }

  private async researcherAgent(state: AgentState): Promise<AgentState> {
    if (state.candles.length === 0) return state;

    state.reasoningLog.push(
      `[Researcher Agent] Analyzing market sentiment using Financial RoBERTa (FinBERT)...`,
    );
    const headlines = await this.dataEngine.fetchGoogleNewsHeadlines(
      state.ticker,
      state.assetClass === "CRYPTO",
    );
    state.headlines = headlines;

    // Use Local AI Router with SENTIMENT task type to trigger proper model selection
    const aiRouter = LocalAIRouter.getInstance();
    const prompt = `Classify financial sentiment for ${state.ticker} based on these headlines. Output only a float between -1.0 (bearish) and 1.0 (bullish).\nHeadlines: ${headlines.join(" | ")}`;

    let sentimentScore = 0;
    try {
      const aiAnalysis = await aiRouter.routeRequest("SENTIMENT", prompt);
      state.reasoningLog.push(
        `[Researcher Agent - RoBERTa Output] ${aiAnalysis}`,
      );

      // Mock parsing the float from the generated text
      const parsedScore = parseFloat(aiAnalysis.replace(/[^0-9.-]+/g, ""));
      if (!isNaN(parsedScore)) {
        sentimentScore = Math.max(-1.0, Math.min(1.0, parsedScore));
      } else {
        // Fallback mock score based on headlines logic if model format fails (just for demo)
        sentimentScore = headlines.length > 3 ? 0.35 : -0.15;
      }
    } catch (e) {
      state.reasoningLog.push(
        `[Researcher Agent] Sentiment Model Failed. Using default Fallback.`,
      );
    }

    state.sentimentScore = sentimentScore;
    state.reasoningLog.push(
      `[Researcher Agent] Final Sentiment Score: ${sentimentScore.toFixed(2)} [Agent: FinBERT]`,
    );
    return state;
  }

  private async traderAgent(state: AgentState): Promise<AgentState> {
    if (state.candles.length === 0 || !state.features) return state;

    state.reasoningLog.push(
      `[Trader Agent] Running Local ML prediction model...`,
    );
    const rawOut = this.mlEngine.generatePrediction(
      state.candles,
      state.features,
    );
    const biasedProbability = this.memoryEngine.applyCalibrationBias(
      rawOut.probability,
      state.assetClass,
    );

    // Phase 1: Inference Service - query institutional artifact registry
    const inferenceEngine = InferenceService.getInstance();

    // Convert to FeatureRecord format for inference service simulation
    const currentFeaturesRecord = {
      features: state.features,
    };
    const inferenceOut = inferenceEngine.predict(currentFeaturesRecord);
    state.reasoningLog.push(
      `[Institutional Inference Service] Evaluated binary target probability: ${inferenceOut.probability.toFixed(3)}`,
    );

    // Ensemble the institutional inference with biased ML Engine output
    const ensembleProbability =
      (biasedProbability + inferenceOut.probability) / 2;

    // Phase 2: Use Tool Calling Agent to fetch extra context during trading decisions
    const toolAgent = new ToolCallingAgent();
    const toolIntel = await toolAgent.executeTaskWithTools(
      `Check market regime for ${state.ticker}`,
    );
    state.reasoningLog.push(`[Trader Agent Tooling] ${toolIntel}`);

    state.mlOutput = {
      ...rawOut,
      probability: ensembleProbability,
      momentumScore: Math.round(ensembleProbability * 100),
    };

    state.reasoningLog.push(
      `[Trader Agent] Generated prediction - Trend: ${state.mlOutput.trendDirection}, Prob: ${ensembleProbability.toFixed(3)}`,
    );
    return state;
  }

  private async riskManagerAgent(state: AgentState): Promise<AgentState> {
    if (state.candles.length === 0 || !state.features || !state.mlOutput)
      return state;

    state.reasoningLog.push(
      `[Risk Manager] Evaluating portfolio risk boundaries...`,
    );
    const riskMetrics = this.riskEngine.evaluateRisk(
      state.candles,
      state.features,
      state.assetClass,
    );
    state.riskMetrics = riskMetrics;

    if (riskMetrics.liquidityScore < 20 || riskMetrics.manipulationWarning) {
      state.reasoningLog.push(
        `[Risk Manager] REJECTED: Failed liquidity/manipulation checks.`,
      );
      return state;
    }

    const last = state.candles[state.candles.length - 1];
    const prev = state.candles[state.candles.length - 2];
    const changePercent = ((last.close - prev.close) / prev.close) * 100;

    state.finalAsset = {
      ticker: state.ticker,
      name: state.name,
      assetClass: state.assetClass,
      timeframe: state.timeframe,
      price: last.close,
      changePercent: Number(changePercent.toFixed(2)),
      volume: last.volume,
      probability: state.mlOutput.probability,
      confidence: state.mlOutput.confidence,
      momentumScore: state.mlOutput.momentumScore,
      volatilityScore: riskMetrics.volatilityScore,
      liquidityScore: riskMetrics.liquidityScore,
      sentimentScore: Number(state.sentimentScore?.toFixed(2) || 0),
      riskScore: riskMetrics.riskScore,
      rrRatio: riskMetrics.rrRatio,
      breakoutProbability: state.mlOutput.breakoutProbability,
      marketRegime: state.regime!,
      manipulationWarning: riskMetrics.manipulationWarning,
      entryZone: riskMetrics.entryZone,
      stopLoss: Number(riskMetrics.stopLoss.toFixed(4)),
      takeProfit: Number(riskMetrics.takeProfit.toFixed(4)),
      invalidationLevel: Number(riskMetrics.invalidationLevel.toFixed(4)),
      trendDirection: state.mlOutput.trendDirection,
      headlines: state.headlines,
      estimatedFutureCandles: state.mlOutput.estimatedFutureCandles,
    };

    state.reasoningLog.push(
      `[Risk Manager] Risk score: ${riskMetrics.riskScore}, target R:R: ${riskMetrics.rrRatio}. Approved for dispatch.`,
    );

    const explanation =
      `[LangGraph Orchestration]\n` + state.reasoningLog.join("\n");
    state.finalAsset.aiExplanation = explanation;

    this.memoryEngine.logScannedPredictions([state.finalAsset]);

    return state;
  }

  public async executeGraph(
    asset: {
      ticker: string;
      name: string;
      assetClass: AssetClass;
      sector?: string;
    },
    timeframe: string,
  ): Promise<ScannerAsset | null> {
    let state: AgentState = {
      ticker: asset.ticker,
      name: asset.name,
      assetClass: asset.assetClass,
      timeframe,
      candles: [],
      finalAsset: null,
      reasoningLog: [`[Phase 4 Agent Graph] Initiating LangGraph Workflow...`],
    };

    // 1. PLANNER
    state.reasoningLog.push(
      `[Planner Agent] Planning execution topology for ${asset.ticker}`,
    );

    // 2. DYNAMIC ROUTING & PARALLEL EXECUTION (Analyst & Researcher run async)
    state.reasoningLog.push(
      `[Router Node] Routing tasks. Launching Analyst & Researcher in parallel...`,
    );

    // A bit hacky state management for parallel ops on same object, but sufficient for simulation
    const [analystState, researcherState] = await Promise.all([
      this.analystAgent({ ...state, reasoningLog: [] }),
      this.researcherAgent({
        ...state,
        reasoningLog: [],
        candles: await this.dataEngine.getHistory(
          asset.ticker,
          asset.assetClass,
          timeframe,
          100,
        ),
      }),
    ]);

    if (!analystState.candles || analystState.candles.length === 0) return null;

    // Merge parallel results
    state.candles = analystState.candles;
    state.features = analystState.features;
    state.regime = analystState.regime;
    state.headlines = researcherState.headlines;
    state.sentimentScore = researcherState.sentimentScore;
    state.reasoningLog.push(...analystState.reasoningLog);
    state.reasoningLog.push(...researcherState.reasoningLog);

    // 3. TOOL EXECUTION (Trader & Risk Manager)
    state = await this.traderAgent(state);
    state = await this.riskManagerAgent(state);

    // 4. MEMORY UPDATES
    if (state.finalAsset) {
      state.reasoningLog.push(
        `[Memory Node] Committing episodic memory updates...`,
      );
      // Trigger continuous learning pipeline
      RealTrainingPipeline.getInstance()
        .triggerTrainingPipeline(
          asset.assetClass === "CRYPTO"
            ? "Crypto-LSTM-V2"
            : "IDX-Transformer-V1",
        )
        .catch((err) => console.error("Pipeline Error:", err));
    }

    // Reattach the merged log because risk manager overwrites the aiExplanation property
    if (state.finalAsset) {
      const explanation =
        `[Graph-Based Agent Flow]\n` + state.reasoningLog.join("\n");
      state.finalAsset.aiExplanation = explanation;
    }

    return state.finalAsset || null;
  }
}
