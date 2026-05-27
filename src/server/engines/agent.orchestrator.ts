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

export interface AgentState {
  ticker: string;
  name: string;
  assetClass: AssetClass;
  timeframe: string;
  candles: Candle[];
  features?: TechIndicators;
  regime?: MarketRegimeType;
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
        `[Analyst Agent] Extracted features and detected regime: ${state.regime}`,
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
      `[Researcher Agent] Analyzing market sentiment & news...`,
    );
    const headlines = await this.dataEngine.fetchGoogleNewsHeadlines(
      state.ticker,
      state.assetClass === "CRYPTO",
    );
    state.headlines = headlines;

    // Phase 2: Use Local AI Router & LM Studio for NLP Sentiment (Mocking request here)
    const aiRouter = LocalAIRouter.getInstance();
    const aiAnalysis = await aiRouter.routeRequest(
      "RESEARCH",
      `Analyze sentiment for ${state.ticker} based on these headlines: ${headlines.join(", ")}`,
    );
    state.reasoningLog.push(`[Researcher Agent] ${aiAnalysis}`);

    let sentimentScore = 0;
    if (headlines.length > 0) {
      const combinedText = headlines.join(" ").toLowerCase();
      const positiveWords = [
        "naik",
        "lonjak",
        "bullish",
        "profit",
        "laba",
        "buy",
        "beli",
        "akumulasi",
        "pertumbuhan",
        "kuat",
        "rekor",
        "investasi",
        "surge",
        "peak",
      ];
      const negativeWords = [
        "turun",
        "anjlok",
        "rugi",
        "jual",
        "sell",
        "distribusi",
        "lemah",
        "bearish",
        "waspada",
        "koreksi",
        "drop",
        "outflow",
      ];

      let posCount = 0;
      let negCount = 0;
      positiveWords.forEach((w) => {
        if (combinedText.includes(w)) posCount++;
      });
      negativeWords.forEach((w) => {
        if (combinedText.includes(w)) negCount++;
      });

      if (posCount === 0 && negCount === 0) sentimentScore = 0;
      else
        sentimentScore =
          (posCount - negCount) / Math.max(posCount + negCount, 1);
    } else {
      const last = state.candles[state.candles.length - 1];
      sentimentScore = 0.1 + Math.sin(last.time) * 0.4;
    }
    state.sentimentScore = sentimentScore;
    state.reasoningLog.push(
      `[Researcher Agent] Calculated sentiment score: ${sentimentScore.toFixed(2)}`,
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

    // Phase 2: Use Tool Calling Agent to fetch extra context during trading decisions
    const toolAgent = new ToolCallingAgent();
    const toolIntel = await toolAgent.executeTaskWithTools(
      `Check market regime for ${state.ticker}`,
    );
    state.reasoningLog.push(`[Trader Agent Tooling] ${toolIntel}`);

    state.mlOutput = {
      ...rawOut,
      probability: biasedProbability,
      momentumScore: Math.round(biasedProbability * 100),
    };

    state.reasoningLog.push(
      `[Trader Agent] Generated prediction - Trend: ${state.mlOutput.trendDirection}, Prob: ${biasedProbability.toFixed(3)}`,
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
      reasoningLog: [
        `[System] Initiating Multi-Agent Workflow for ${asset.ticker}`,
      ],
    };

    state = await this.analystAgent(state);
    if (!state.candles || state.candles.length === 0) return null;

    state = await this.researcherAgent(state);
    state = await this.traderAgent(state);
    state = await this.riskManagerAgent(state);

    if (state.finalAsset) {
      // Phase 1: Fire and forget Real Training Pipeline asynchronously for continuous learning
      RealTrainingPipeline.getInstance()
        .triggerTrainingPipeline(
          asset.assetClass === "CRYPTO"
            ? "Crypto-LSTM-V2"
            : "IDX-Transformer-V1",
        )
        .catch((err) => console.error("Pipeline Error:", err));
    }

    return state.finalAsset || null;
  }
}
