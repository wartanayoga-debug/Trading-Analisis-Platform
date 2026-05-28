import {
  ScannerAsset,
  AssetClass,
  Candle,
  TechIndicators,
  MarketRegimeType,
  RegimeDetail,
  RSScore,
  MTFScore,
  AnalogMatch,
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
// ── Roadmap engines ─────────────────────────────────────────────────────────
import { RegimeDetectionEngine } from "./regime.engine";
import { RelativeStrengthEngine } from "./relative_strength.engine";
import { MultiTimeframeEngine } from "./mtf.engine";
import { HistoricalAnalogEngine } from "./analog.engine";

export interface AgentState {
  ticker: string;
  name: string;
  assetClass: AssetClass;
  timeframe: string;
  candles: Candle[];
  features?: TechIndicators;
  regime?: MarketRegimeType;
  regimeDetail?: RegimeDetail;
  rsScore?: RSScore;
  mtfScore?: MTFScore;
  analogMatches?: AnalogMatch[];
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

  private dataEngine   = MarketDataEngine.getInstance();
  private featureEngine = FeatureEngineeringEngine.getInstance();
  private mlEngine     = MLPredictionEngine.getInstance();
  private riskEngine   = RiskEngine.getInstance();
  private memoryEngine = MemoryLearningEngine.getInstance();

  // ── Roadmap engines ─────────────────────────────────────────────────────
  private regimeEngine  = RegimeDetectionEngine.getInstance();
  private rsEngine      = RelativeStrengthEngine.getInstance();
  private mtfEngine     = MultiTimeframeEngine.getInstance();
  private analogEngine  = HistoricalAnalogEngine.getInstance();

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

      // Legacy regime detection (backward compat)
      state.regime = this.featureEngine.detectMarketRegime(
        state.features,
        candles,
      );

      // Roadmap #1: Full Regime Detection
      state.regimeDetail = this.regimeEngine.detectRegime(
        state.candles,
        state.features,
        state.ticker,
      );

      // Roadmap #5: Multi-Timeframe Confluence
      state.mtfScore = this.mtfEngine.computeMTF(state.candles);

      // Roadmap #7: Historical Analog Search
      state.analogMatches = this.analogEngine.findAnalogs(state.candles);

      // Phase 1: Save real features for ML Training loop
      FeatureStore.getInstance().saveFeatures(
        state.ticker,
        state.features,
        state.candles,
        state.regime,
      );

      state.reasoningLog.push(
        `[Analyst Agent] Regime: ${state.regimeDetail.type} (score:${state.regimeDetail.regimeScore}, conf:${state.regimeDetail.confidence.toFixed(2)}) | MTF: ${state.mtfScore.confluence} | Analogs: ${state.analogMatches.length}`,
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
      `[Researcher Agent] Fetching real news and analyzing sentiment for ${state.ticker}...`,
    );
    const headlines = await this.dataEngine.fetchGoogleNewsHeadlines(
      state.ticker,
      state.assetClass === "CRYPTO",
    );
    state.headlines = headlines;

    // Use Local AI Router — passes real headlines (not template)
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

    // Roadmap #4: Relative Strength (benchmark fetched via data engine)
    try {
      const isCrypto = state.assetClass === "CRYPTO";
      const bmTicker = isCrypto ? "BTCUSDT" : "^JKSE";
      const bmCandles = await this.dataEngine.getHistory(bmTicker, isCrypto ? "CRYPTO" : "IDX", state.timeframe, 60).catch(() => []);
      if (bmCandles.length > 5 && state.candles.length > 5) {
        state.rsScore = this.rsEngine.computeRS(
          state.ticker, state.candles, bmCandles, bmTicker, state.finalAsset.sector
        );
      }
    } catch (_) {}

    // Attach all roadmap fields to finalAsset
    if (state.regimeDetail)   state.finalAsset.regimeDetail   = state.regimeDetail;
    if (state.rsScore)        state.finalAsset.rsScore        = state.rsScore;
    if (state.mtfScore)       state.finalAsset.mtfScore       = state.mtfScore;
    if (state.analogMatches)  state.finalAsset.analogMatches  = state.analogMatches;

    // Roadmap #8: AI Structured Reasoning
    state.finalAsset.aiExplanation = this.buildStructuredExplanation(state);

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
  // ── Roadmap #8: AI Structured Reasoning ────────────────────────────────────
  /**
   * Membangun penjelasan AI yang factor-driven, bukan generik.
   * Format mengikuti roadmap:
   *   1. Trend Factors    5. Risk Conditions
   *   2. Momentum Factors 6. Regime Analysis
   *   3. Volume Factors   7. Final Probability
   *   4. Relative Strength
   */
  private buildStructuredExplanation(state: AgentState): string {
    const f  = state.features;
    const ml = state.mlOutput;
    const rs = state.rsScore;
    const mtf = state.mtfScore;
    const regime = state.regimeDetail;
    const analogs = state.analogMatches || [];
    const risk = state.riskMetrics;
    const asset = state.finalAsset!;

    const lines: string[] = [];
    lines.push(`=== AI Quant Analysis: ${state.ticker} ===`);
    lines.push(`Timeframe: ${state.timeframe} | ${new Date().toISOString()}`);
    lines.push("");

    // 1. Trend Factors
    lines.push("── 1. Trend Factors ──");
    if (f) {
      const emaCross = f.emaFast > f.emaSlow ? "EMA Bullish Cross ✓" : "EMA Bearish Cross ✗";
      lines.push(`  ${emaCross} (EMA12: ${f.emaFast?.toFixed(2)}, EMA26: ${f.emaSlow?.toFixed(2)})`);
      lines.push(`  ADX: ${f.adx?.toFixed(1)} ${f.adx > 25 ? "(Trending)" : f.adx < 18 ? "(Sideways)" : "(Transitional)"}`);
      if (f.hurstExponent !== undefined) {
        const hurstLabel = f.hurstExponent > 0.55 ? "Trending (persist)" : f.hurstExponent < 0.45 ? "Mean-Reverting" : "Random Walk";
        lines.push(`  Hurst Exponent: ${f.hurstExponent.toFixed(3)} → ${hurstLabel}`);
      }
      if (f.trendPersistence !== undefined) {
        lines.push(`  Trend Persistence: ${(f.trendPersistence * 100).toFixed(0)}% of bars in primary direction`);
      }
    }
    lines.push("");

    // 2. Momentum Factors
    lines.push("── 2. Momentum Factors ──");
    if (f) {
      lines.push(`  RSI(14): ${f.rsi?.toFixed(1)} ${f.rsi > 70 ? "(Overbought)" : f.rsi < 30 ? "(Oversold)" : "(Neutral)"}`);
      lines.push(`  MACD Hist: ${f.macdHist?.toFixed(4)} ${f.macdHist > 0 ? "↑ Positive" : "↓ Negative"}`);
      if (f.zScoreMomentum !== undefined) {
        lines.push(`  Z-Score Momentum: ${f.zScoreMomentum.toFixed(2)} ${Math.abs(f.zScoreMomentum) > 2 ? "(Extreme)" : ""}`);
      }
    }
    if (mtf) {
      lines.push(`  MTF Confluence: ${mtf.confluence} | Daily: ${(mtf.dailyTrend*100).toFixed(0)}% | 4H: ${(mtf.h4Momentum*100).toFixed(0)}% | 1H: ${(mtf.h1Setup*100).toFixed(0)}%`);
    }
    lines.push("");

    // 3. Volume Factors
    lines.push("── 3. Volume Factors ──");
    if (f) {
      if (f.relativeVolume !== undefined) {
        lines.push(`  Relative Volume: ${f.relativeVolume.toFixed(2)}x average ${f.relativeVolume > 2 ? "⚡ Significant expansion" : f.relativeVolume < 0.5 ? "⚠ Low volume" : ""}`);
      }
      lines.push(`  OBV: ${f.obv?.toLocaleString()} ${f.obv > 0 ? "(Accumulation)" : "(Distribution)"}`);
      if (f.volatilityCompression !== undefined) {
        lines.push(`  Vol Compression (ATR5/ATR30): ${f.volatilityCompression.toFixed(3)} ${f.volatilityCompression < 0.7 ? "⚡ Squeeze detected" : ""}`);
      }
    }
    lines.push("");

    // 4. Relative Strength
    lines.push("── 4. Relative Strength ──");
    if (rs) {
      lines.push(`  RS vs Benchmark: ${rs.rsRaw.toFixed(3)} ${rs.rsRaw > 1.1 ? "✓ Outperforming" : rs.rsRaw < 0.9 ? "✗ Underperforming" : "≈ In-line"}`);
      lines.push(`  Momentum Percentile: ${rs.momentumPercentile.toFixed(0)}th percentile in universe`);
      if (rs.sectorRank > 0) lines.push(`  Sector Rank: #${rs.sectorRank}`);
    } else {
      lines.push("  Relative Strength: Not available (no benchmark data)");
    }
    lines.push("");

    // 5. Risk Conditions
    lines.push("── 5. Risk Conditions ──");
    lines.push(`  Risk Score: ${asset.riskScore}/100 | Volatility: ${asset.volatilityScore}/100`);
    lines.push(`  R:R Ratio: ${asset.rrRatio.toFixed(2)} | SL: ${asset.stopLoss?.toFixed(4)} | TP: ${asset.takeProfit?.toFixed(4)}`);
    if (asset.manipulationWarning) lines.push("  ⚠ MANIPULATION WARNING: Unusual volume/spread detected");
    if (asset.fakeBreakoutRisk ?? false) lines.push("  ⚠ FAKE BREAKOUT RISK: Momentum trap pattern detected");
    if (f?.realizedVolatility !== undefined) {
      lines.push(`  Realized Volatility (ann.): ${(f.realizedVolatility * 100).toFixed(1)}%`);
    }
    if (f?.shannonEntropy !== undefined) {
      lines.push(`  Entropy: ${f.shannonEntropy.toFixed(3)} ${f.shannonEntropy < 0.4 ? "(Predictable)" : f.shannonEntropy > 0.8 ? "(Noisy)" : "(Moderate)"}`);
    }
    lines.push("");

    // 6. Regime Analysis
    lines.push("── 6. Regime Analysis ──");
    if (regime) {
      lines.push(`  Regime: ${regime.type} | Score: ${regime.regimeScore} | Confidence: ${(regime.confidence * 100).toFixed(0)}%`);
      lines.push(`  Components → ADX: ${regime.adxContrib.toFixed(1)} | Vol: ${regime.volContrib.toFixed(1)} | Trend: ${regime.trendContrib.toFixed(1)}`);
    }
    if (analogs.length > 0) {
      lines.push(`  Historical Analogs: ${analogs.length} match(es) found`);
      for (const a of analogs.slice(0, 2)) {
        const ts = new Date(a.periodStartTs).toISOString().split("T")[0];
        lines.push(`    → ${ts} | Similarity: ${(a.similarityScore*100).toFixed(0)}% | Outcome: ${(a.outcomeReturn*100).toFixed(1)}% [${a.matchQuality}]`);
      }
    }
    lines.push("");

    // 7. Final Probability
    lines.push("── 7. Final Probability ──");
    lines.push(`  Direction: ${asset.trendDirection} | Probability: ${(asset.probability * 100).toFixed(1)}% | Confidence: ${(asset.confidence * 100).toFixed(0)}%`);
    lines.push(`  Breakout Probability: ${(asset.breakoutProbability * 100).toFixed(1)}%`);
    if (mtf) lines.push(`  MTF Final Score: ${(mtf.finalScore * 100).toFixed(0)}/100`);
    lines.push("");
    lines.push("─────────────────────────────────────────────────────────");

    return lines.join("\n");
  }

}