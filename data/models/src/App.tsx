/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { ScannerAsset, HistoricalPrediction, SystemCalibration, TechIndicators } from "./types";
import { MetricCards } from "./components/MetricCards";
import { ScannerTable } from "./components/ScannerTable";
import { AssetDetail } from "./components/AssetDetail";
import { PredictionHistory } from "./components/PredictionHistory";
import { Activity, ShieldCheck, Database, Sliders, AlertCircle } from "lucide-react";
import { translations, Language } from "./utils/translations";

export default function App() {
  const [lang, setLang] = useState<Language>("ID");
  const [scannedAssets, setScannedAssets] = useState<ScannerAsset[]>([]);
  const [predictions, setPredictions] = useState<HistoricalPrediction[]>([]);
  const [calibration, setCalibration] = useState<SystemCalibration | null>(null);
  
  // Selection and details
  const [selectedAsset, setSelectedAsset] = useState<ScannerAsset | null>(null);
  const [selectedIndicators, setSelectedIndicators] = useState<TechIndicators | null>(null);
  const [selectedCandles, setSelectedCandles] = useState<any[]>([]);

  // States
  const [activeTimeframe, setActiveTimeframe] = useState<"15m" | "30m" | "1h">("15m");
  const [isLoadingScan, setIsLoadingScan] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScanTimestamp, setLastScanTimestamp] = useState<string | null>(null);

  const t = translations[lang];

  // Initial asset trigger
  useEffect(() => {
    fetchInitialSystemData();
  }, []);

  const fetchInitialSystemData = async () => {
    setError(null);
    try {
      // 1. Fetch System Calibration configurations
      const calRes = await fetch("/api/calibration");
      const calData = await calRes.json();
      if (calData.success) {
        setCalibration(calData.calibration);
      }

      // 2. Fetch Backtest Ledger Predictions
      await refreshPredictionLedger();
    } catch (err: any) {
      console.error("[App] Initialization data fetch failed:", err);
      setError(t.dbOffline);
    }
  };

  const refreshPredictionLedger = async () => {
    try {
      const histRes = await fetch("/api/history");
      const histData = await histRes.json();
      if (histData.success) {
        setPredictions(histData.predictions);
      }
    } catch (err) {
      console.error("[App] Failed updating historical prediction logs:", err);
    }
  };

  /**
   * Action: Run Parallel scan sweeps on chosen Asset Class (IDX or CRYPTO) targeting 15m Scalping
   */
  const processMarketScan = async (assetClass?: any, timeframe: "15m" | "30m" | "1h" = "15m", manualTicker?: string) => {
    setIsLoadingScan(true);
    setActiveTimeframe(timeframe);
    setError(null);
    try {
      // Default to "IDX" if not provided
      const targetClass = (assetClass && assetClass !== "ALL") ? assetClass : "IDX";
      let url = `/api/scanner/scan?assetClass=${targetClass}&timeframe=${timeframe}`;
      if (manualTicker && manualTicker.trim() !== "") {
        url += `&ticker=${encodeURIComponent(manualTicker.trim())}`;
      }
      
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.success) {
        setScannedAssets(data.scannedAssets);
        setLastScanTimestamp(data.scanTimestamp);
        // Refresh prediction audit ledger
        await refreshPredictionLedger();
      } else {
        throw new Error(data.error || "Execution timeout.");
      }
    } catch (err: any) {
      console.error("[App] Market scanning failed:", err);
      setError(t.apiOffline);
    } finally {
      setIsLoadingScan(false);
    }
  };

  /**
   * Action: Retrieve quantitative variables and AI grounding brief for individual ticker
   */
  const handleSelectAsset = async (ticker: string) => {
    setIsLoadingDetail(true);
    setError(null);
    
    // Quick optimistic visual focus (scrolling view target layout)
    const element = document.getElementById("asset-deep-dive-anchor");
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    try {
      const res = await fetch(`/api/assets/${ticker}?timeframe=${activeTimeframe}&lang=${lang}`);
      const data = await res.json();

      if (data.success) {
        setSelectedAsset(data.asset);
        setSelectedIndicators(data.indicators);
        setSelectedCandles(data.candles || []);
      } else {
        throw new Error(data.error || "Could not retrieve asset details.");
      }
    } catch (err: any) {
      console.error("[App] Asset details load exception:", err);
      setError(err.message || t.deepCalcError);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  /**
   * Action: Self-Learning Calibration and walk-forward verification
   */
  const handleTriggerWalkForwardAudit = async () => {
    setIsAuditing(true);
    setError(null);
    try {
      const res = await fetch("/api/audit/trigger", { method: "POST" });
      const data = await res.json();

      if (data.success) {
        setCalibration(data.calibratedWeights);
        await refreshPredictionLedger();
      } else {
        throw new Error(data.error || "Calibration audit failed.");
      }
    } catch (err: any) {
      console.error("[App] Walk-forward calibration audit failed:", err);
      setError(t.calibrationIndicesSyncError);
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* HEADER BAR */}
      <header className="border-b border-gray-900 bg-gray-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-cyan-500/15 p-2 rounded-lg border border-cyan-500/20">
              <Activity className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <h1 className="text-md sm:text-lg font-display font-bold tracking-tight text-gray-100 uppercase">
                {t.appTitle}
              </h1>
              <p className="text-[10px] text-gray-500 font-mono">
                {t.appSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-mono text-gray-400">
            {/* Bilingual toggle button switcher */}
            <div className="flex bg-gray-900 border border-gray-800 rounded-md p-1 items-center gap-1">
              <button
                onClick={() => setLang("ID")}
                className={`px-2.5 py-1 text-[10px] font-mono leading-none rounded transition-all cursor-pointer ${
                  lang === "ID"
                    ? "bg-gray-800 text-cyan-400 font-bold border border-gray-700/50"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                ID
              </button>
              <button
                onClick={() => setLang("EN")}
                className={`px-2.5 py-1 text-[10px] font-mono leading-none rounded transition-all cursor-pointer ${
                  lang === "EN"
                    ? "bg-gray-800 text-cyan-400 font-bold border border-gray-705/50"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                EN
              </button>
            </div>

            <div className="hidden md:flex items-center gap-1.5 bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.securityGuard}</span>
            </div>
            <div className="hidden lg:flex items-center gap-1.5 bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-full">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t.persistence}</span>
            </div>
          </div>
        </div>
      </header>

      {/* BODY CONTENT GRID */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* EXPLAINER NOTIFICATION BANNER */}
        {error && (
          <div className="col-span-12 mb-5 bg-rose-950/40 border-l-4 border-rose-500 text-rose-300 text-xs font-mono p-4 rounded flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">{t.executionWarning}</p>
              <p className="text-[11px] text-rose-400/80 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* METRICS & CALIBRATIONS HEADER */}
        <MetricCards
          calibration={calibration}
          scannedCount={scannedAssets.length}
          lastScannedTime={lastScanTimestamp}
          onAuditTrigger={handleTriggerWalkForwardAudit}
          isAuditing={isAuditing}
          lang={lang}
        />

        {/* WORKSPACE MIDDLE PANELS */}
        <div className="grid grid-cols-1 gap-6">
          {/* PRIMARY SCAN TABLE */}
          <ScannerTable
            assets={scannedAssets}
            isLoading={isLoadingScan}
            onScanTrigger={processMarketScan}
            onSelectAsset={handleSelectAsset}
            lang={lang}
            lastScanTimestamp={lastScanTimestamp}
          />

          {/* ASSET DEEP DIVE FOCUS CONTAINER Anchor */}
          <div id="asset-deep-dive-anchor" />
          
          {(selectedAsset || isLoadingDetail) && (
            <AssetDetail
              asset={selectedAsset}
              indicators={selectedIndicators}
              candles={selectedCandles}
              onClose={() => {
                setSelectedAsset(null);
                setSelectedIndicators(null);
                setSelectedCandles([]);
              }}
              isLoading={isLoadingDetail}
              lang={lang}
              timeframe={activeTimeframe}
            />
          )}

          {/* BACKTESTING LEDGER EVENT LOG */}
          <PredictionHistory predictions={predictions} lang={lang} />
        </div>
      </main>

      {/* APP FOOTER BACKGROUNDS */}
      <footer className="border-t border-gray-900 bg-gray-950 py-6 mt-12 text-center text-xs font-mono text-gray-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>IDX & Crypto AI Quant Engine - Swiss-Mono Slate Interface</span>
          </div>
          <div className="text-[10px] text-gray-600">
            {lastScanTimestamp ? `System synchronized scan timestamp: ${new Date(lastScanTimestamp).toLocaleTimeString()}` : "Market feed pending sweep synchronization."}
          </div>
        </div>
      </footer>
    </div>
  );
}
