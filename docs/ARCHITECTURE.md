# IDX & Crypto AI Trading Analysis Platform
## Phase 1: Institutional Architecture, Folder Structure & Module Responsibilities

This document defines the production-grade architectural blueprint, directory organization, and component specs for the **IDX & Crypto AI Trading Analysis Platform**.

---

## 1. Core Architectural Pillars & Strategy

The platform is designed to run in a robust, containerized environment using a **full-stack Express (server) + React (client) architecture**, utilizing high-speed parallel operations for data fetching and real-time computation of quantitative indicators.

### A. Environment Adaptations
- **Runtime Environment:** Google Cloud Run (Node/TypeScript) on Port `3000`.
- **Backend Portability:** Express-based server acting as the high-performance computation engine. While Python can be run locally by an external client, the container backend implements key mathematical and scanning engines directly in highly optimized TypeScript, utilizing native mathematical matrix operations and statistical formulas for extreme performance, low latency, and ease of deployment.
- **Data Engine Integration:** Instead of mock files or simulated infrastructure, the system implements direct, asynchronous feeds:
  - **IDX Market Data:** Pulls real-time and historical price, volume, and spread indicators from **Yahoo Finance** endpoints supporting standard Indo tickers (e.g., `BBRI.JK`, `TLKM.JK`, `BMRI.JK`).
  - **Crypto Market Data:** Serves direct, highly liquid candle feeds from the public **Binance API** without requiring keys, enabling rapid multi-timeframe correlation.
- **AI Explanation & Sentiment Engine:** Integrated with the official `@google/genai` modern Node SDK, leveraging the powerful server-side `gemini-3.5-flash` model for high-efficiency explanation of risk metrics, market regimes, and sentiment correlation. This decouples the Heavy Quant Engine (deterministic calculations, probabilities, risk numbers) from the Cognition Engine (GenAI-based natural language explainability).

---

## 2. Platform Folder Structure (Modular & Clean)

To strictly enforce **No Monolithic Code**, the backend and frontend are compartmentalized as follows:

```text
/
├── docs/
│   └── ARCHITECTURE.md                  # System Architecture, Folder Structure, and Module Specs
├── src/
│   ├── components/                     # High-Performance UI Components
│   │   ├── Dashboard/                  # Main Overview Panel, Heatmaps & Market Regina
│   │   ├── Scanner/                    # Interactive Scanner Matrix with Advanced Filters
│   │   ├── Detail/                     # Deep-Dive Asset Drawer, Dynamic Charts, Explainable AI
│   │   ├── History/                    # Backtesting Ledger, Accuracy Audits & Prediction Records
│   │   └── Common/                     # Clean UI Components (Cards, Badges, Loaders)
│   ├── server/                         # Server-Side Engine Layer (.ts compiled via esbuild)
│   │   ├── index.ts                    # Main Application Bootstrapper
│   │   ├── routes/                     # Clean API Endpoints (Scanner, Sentiment, Backtest, Explain)
│   │   ├── engines/                    # Detached Functional Math & AI Engines
│   │   │   ├── data.engine.ts          # Market Data (Yahoo Finance + Binance REST/WS proxies)
│   │   │   ├── feature.engine.ts       # Quantitative Feature Engineering (EMA, ATR, VWAP, BBM, OBV)
│   │   │   ├── ml.engine.ts            # Machine Learning Direction, Probabilities, & Confidence Calculation
│   │   │   ├── scanner.engine.ts       # Non-blocking Parallel Scan & Core Asset Ranking
│   │   │   ├── risk.engine.ts          # Volatility, Low Liquidity, Spreads & Manipulation Safeguards
│   │   │   ├── sentiment.engine.ts     # Natural Language Crypto/IDX News Classifier
│   │   │   ├── memory.engine.ts        # Self-Learning Calibration Engine (accuracy storage and weighting)
│   │   │   └── explain.engine.ts       # Explainable AI Grounding via Gemini 3.5 Flash
│   │   └── utils/                      # Math utilities, caching layers, and database connectors
│   ├── types/                          # Shared Strict Type System
│   │   ├── index.ts                    # Consolidated Type Definitions (Asset, Prediction, Scan, Audit)
│   │   └── api.ts                      # Backend Request/Response Boundary Interfaces
│   ├── App.tsx                         # Core React Application Shell & Routing
│   ├── index.css                       # Modern Swiss-Mono Tailwind Design Variables
│   └── main.tsx                        # React App Entry Point
├── package.json                        # Server/Client Dependency Matrix
├── tsconfig.json                       # TS Strict Specifications
└── vite.config.ts                      # Optimised React/Express Proxy Pipeline
```

---

## 3. Detailed Module Specifications

### Module 1: Market Data Engine (`data.engine.ts`)
- **Responsibility:** Handles asynchronous collection of historical OHLCV data.
- **Data Channels:**
  - Yahoo Finance Public API (for Indonesian Stocks, standard `.JK` suffix).
  - Binance Public REST endpoints (for Cryptocurrencies).
- **Core Operations:** Dynamic connection polling, robust HTTP retry-with-backoff layers, memory-backed LRU caching to avoid hitting third-party rate limits.

### Module 2: Feature Engineering Engine (`feature.engine.ts`)
- **Responsibility:** Transforms raw price-volume series into numerical quantitative features.
- **Indicators:** Standardizes calculation for:
  - **Overlays / Volume Profile:** EMA, VWAP, Bollinger Bands, Volume Nodes.
  - **Momentum / Strength:** ADX, RSI, MACD, Relative Strength Index relative to Composite Index (IHSG / BTC).
  - **Risk / Space:** ATR, bid-ask spread proxies, volume velocity.
- **Multi-Timeframe Alignment:** Aligns `30m`, `1h`, `4h`, and `1d` intervals, detecting trend confirmation or structural conflict across durations.

### Module 3: ML Prediction & Validation Engine (`ml.engine.ts`)
- **Responsibility:** Executes direction classification, breakouts, and trend probability calculations.
- **Ensemble Validation Model:**
  - **Primary Model (Numerical Direction / Probabilities):** High-speed tabular gradient boosters (probabilistic matrix models) evaluating breakouts and continuation triggers.
  - **Secondary Model (Ensemble Verification):** Parallel neural sequencers running sequential pattern validations on structured historical vectors to mitigate false positives (e.g., bull traps).

### Module 4: Market Scanner Engine (`scanner.engine.ts`)
- **Responsibility:** Asynchronously aggregates features across hundreds of IDX and Crypto assets simultaneously, executing deep structural filters.
- **Funnels:** Performs aggressive early-stage discards of illiquid stocks, manipulated/spread anomalies, and low-volume setups.
- **Ranking System Formula:**
  $$\text{Final Score} = \frac{\text{Probability} + \text{Momentum} + \text{Liquidity} + \text{Sentiment} + \text{Regime} + \text{RiskReward}}{\text{Volatility Risk} \times \text{Manipulation Risk}}$$

### Module 5: Risk Engine (`risk.engine.ts`)
- **Responsibility:** Identifies systematic and idiosyncratic tail-risks matching institutional profiles.
- **Guardrails:** Computes bid-ask proxy friction, detects artificial volume anomalies (manipulation signatures), measures volatility acceleration, and categorizes overall Market Regime (e.g., Extended Trending, Low Liquidity Range, Panic Reversals).

### Module 6: Sentiment Engine (`sentiment.engine.ts`)
- **Responsibility:** Harvests financial headlines and crypto sentiment streams, dispatching structured classifier tasks.
- **LLM Grounding:** Employs the Gemini 3.5 Flash model with exact structural schemas to output sentiment direction `[positive, negative, neutral]` accompanied by a raw confidence weight. Sentiment serves only as a risk-multiplier, never as a primary direct buy/sell driver.

### Module 7: Memory Learning Engine (`memory.engine.ts`)
- **Responsibility:** Local prediction database audit system.
- **Features:** Writes historical predictions alongside eventual market realizations to a localized ledger file (JSON or SQLite), adapting prediction confidence profiles dynamically over time depending on model accuracy relative to the current market regime.

### Module 8: Explainable AI Engine (`explain.engine.ts`)
- **Responsibility:** Translates raw multi-timeframe quantitative feature vectors, ML confidence numbers, and risk evaluations into clean, concise investor briefs.
- **Implementation:** Prompts `@google/genai` with precise system structures, ensuring explanations cover concrete quant drivers (e.g., ADX trend confirmation, risk profile) and invalidation horizons without ever fabricating information or overriding underlying engine statistics.

---

## 4. Immediate Development Workflow

### Next Execution Phase: Backend Core, API Boundary & Local Database Structure
Following state verification, we will create the core types, APIs, database, and router layers to establish a highly robust framework prior to implementing active math calculations in the engines.
