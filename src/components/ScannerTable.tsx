/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import { ScannerAsset, AssetClass } from "../types";
import {
  Search,
  SlidersHorizontal,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from "lucide-react";
import { translations, Language } from "../utils/translations";

interface ScannerTableProps {
  assets: ScannerAsset[];
  isLoading: boolean;
  onScanTrigger: (
    assetClass: AssetClass,
    timeframe: "15m" | "30m" | "1h",
    manualTicker?: string,
  ) => void;
  onSelectAsset: (ticker: string) => void;
  lang: Language;
  lastScanTimestamp: string | null;
}

export const ScannerTable: React.FC<ScannerTableProps> = ({
  assets,
  isLoading,
  onScanTrigger,
  onSelectAsset,
  lang,
  lastScanTimestamp,
}) => {
  const [manualTicker, setManualTicker] = useState("");
  const [assetClassFilter, setAssetClassFilter] = useState<AssetClass>("IDX");
  const [activeInterval, setActiveInterval] = useState<"15m" | "30m" | "1h">(
    "15m",
  );

  const t = translations[lang];

  // Simulated queue and filtering states for visual accuracy
  const [simulatedScanning, setSimulatedScanning] = useState(false);
  const [simulatedQueue, setSimulatedQueue] = useState(0);
  const [simulatedSuccessFilters, setSimulatedSuccessFilters] = useState(0);

  const filteredAndSortedAssets = useMemo(() => {
    let result = [...assets];

    // Asset Class filter check
    result = result.filter((a) => a.assetClass === assetClassFilter);

    // Default: Math Score Rank desc
    result.sort((a, b) => {
      return b.probability * b.rrRatio - a.probability * a.rrRatio;
    });

    return result;
  }, [assets, assetClassFilter]);

  // Effect to manage high-fidelity scanning simulations
  useEffect(() => {
    if (isLoading) {
      setSimulatedScanning(true);
      let initialQueue = 100;
      if (assetClassFilter === "IDX") {
        initialQueue = 200;
      } else if (assetClassFilter === "CRYPTO") {
        initialQueue = 100;
      }

      setSimulatedQueue(initialQueue);
      setSimulatedSuccessFilters(0);

      const interval = setInterval(() => {
        setSimulatedQueue((prev) => {
          if (prev <= 0) {
            clearInterval(interval);
            return 0;
          }
          const step = 15;
          const next = Math.max(0, prev - step);

          setSimulatedSuccessFilters((sPrev) => {
            if (next === 0) return sPrev;
            return sPrev + (Math.random() > 0.65 ? 1 : 0);
          });

          return next;
        });
      }, 100);

      return () => clearInterval(interval);
    } else {
      setSimulatedScanning(false);
      setSimulatedQueue(0);
      setSimulatedSuccessFilters(filteredAndSortedAssets.length);
    }
  }, [isLoading, assetClassFilter, filteredAndSortedAssets.length]);

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-lg p-5">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-display font-semibold text-gray-200 flex items-center gap-2">
            {t.realtimeScanner}
          </h2>
          <p className="text-gray-500 text-xs font-mono">{t.scannerDesc}</p>
        </div>

        {/* STATUS INDICATORS PANEL */}
        {(isLoading || simulatedScanning) && (
          <div className="flex flex-wrap items-center gap-4 bg-gray-900/60 border border-cyan-900/30 rounded-lg py-2 px-4 shadow-inner">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span className="text-[11px] font-mono font-semibold text-amber-400 uppercase tracking-wider">
                {t.scanInProgress}
              </span>
            </div>

            <div className="h-4 w-px bg-gray-800"></div>

            <div className="text-[11px] font-mono text-gray-400">
              {t.batchQueueSize}:{" "}
              <span className="font-bold text-gray-200">{simulatedQueue}</span>
            </div>

            <div className="h-4 w-px bg-gray-800"></div>

            <div className="text-[11px] font-mono text-gray-400">
              {t.successfulFilters}:{" "}
              <span className="font-bold text-emerald-400">
                {simulatedSuccessFilters}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* FILTER & SCAN BAR ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6 bg-gray-900/40 p-4 border border-gray-800/60 rounded-lg">
        {/* Manual Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder={
              assetClassFilter === "IDX"
                ? "Tambah Ticker (Cth: BBCA.JK)"
                : "Tambah Kripto (Cth: BTCUSDT)"
            }
            value={manualTicker}
            onChange={(e) => setManualTicker(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && manualTicker.trim() !== "") {
                onSelectAsset(manualTicker.trim().toUpperCase());
              }
            }}
            className="w-full bg-gray-900 border border-gray-800 text-gray-200 text-xs font-mono rounded-md pl-9 pr-3 py-2.5 focus:outline-none focus:border-cyan-700 uppercase"
          />
        </div>

        {/* Asset class tabs */}
        <div className="flex bg-gray-900 border border-gray-800 rounded-md p-1 items-center">
          {(["IDX", "CRYPTO"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setAssetClassFilter(tab)}
              className={`flex-1 text-center py-1.5 rounded text-xs font-mono transition-all uppercase ${
                assetClassFilter === tab
                  ? "bg-gray-800 text-cyan-400 font-bold"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {tab === "IDX" ? "SAHAM (IDX)" : "KRIPTO (CRYPTO)"}
            </button>
          ))}
        </div>

        {/* Timeframe Interval tabs */}
        <div className="flex bg-gray-900 border border-gray-800 rounded-md p-1 items-center">
          {(["15m", "30m", "1h"] as const).map((interval) => (
            <button
              key={interval}
              onClick={() => setActiveInterval(interval)}
              className={`flex-1 text-center py-1.5 rounded text-xs font-mono transition-all ${
                activeInterval === interval
                  ? "bg-gray-800 text-cyan-400 font-bold"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {interval}
            </button>
          ))}
        </div>

        {/* Start scan button - Positioned on far right */}
        <button
          onClick={() =>
            onScanTrigger(assetClassFilter, activeInterval, manualTicker.trim())
          }
          disabled={isLoading}
          className={`w-full py-2.5 font-mono text-xs font-semibold rounded flex items-center justify-center gap-2 border transition-all ${
            isLoading
              ? "bg-gray-950 border-gray-800 text-gray-600 cursor-not-allowed"
              : "bg-cyan-950/40 border-cyan-800 hover:border-cyan-600 text-cyan-400 active:scale-[0.98] cursor-pointer"
          }`}
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}
          />
          {isLoading ? t.scanning : t.processScan}
        </button>
      </div>

      {/* MATRIX TABLE LAYOUT */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-900 text-gray-500 text-[11px] font-mono uppercase tracking-wider">
              <th className="py-3 px-4">{t.tableAsset}</th>
              <th className="py-3 px-4">{t.tablePrice}</th>
              <th className="py-3 px-3 text-center">{t.tableTrend}</th>
              <th className="py-3 px-4 text-center">{t.tableMlProb}</th>
              <th className="py-3 px-4 text-center">{t.tableVolatility}</th>
              <th className="py-3 px-4 text-center">{t.tableLiquidity}</th>
              <th className="py-3 px-4 text-center">{t.tableSentiment}</th>
              <th className="py-3 px-4 text-right">{t.tableRankScore}</th>
              <th className="py-3 px-4 text-right">{t.tableActions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-900 text-xs font-mono">
            {lastScanTimestamp === null ? (
              <tr>
                <td colSpan={9} className="py-16 text-center text-gray-400">
                  <div className="max-w-md mx-auto flex flex-col items-center gap-3 bg-gray-900/40 p-6 border border-gray-800/60 rounded-lg">
                    <SlidersHorizontal className="w-8 h-8 text-cyan-500 animate-pulse mb-1" />
                    <p className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
                      Pemindai Pasar Real-Time Kosong
                    </p>
                    <p className="text-[11px] text-gray-400 font-sans leading-relaxed">
                      Silakan tentukan pilihan kelas aset Anda (
                      <strong>SAHAM (IDX)</strong> atau{" "}
                      <strong>KRIPTO (CRYPTO)</strong>) di atas, lalu klik
                      tombol <strong>Mulai Pindai</strong> untuk mendownload dan
                      menghitung data matematika momentum secara langsung.
                    </p>
                  </div>
                </td>
              </tr>
            ) : filteredAndSortedAssets.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-gray-500">
                  {isLoading ? t.scansRunningApi : t.noScanData}
                </td>
              </tr>
            ) : (
              filteredAndSortedAssets.map((asset) => {
                const isBull = asset.trendDirection === "BULLISH";
                const isBear = asset.trendDirection === "BEARISH";
                const changeIsPositive = asset.changePercent >= 0;

                const sentimentColor =
                  asset.sentimentScore > 0.2
                    ? "text-emerald-400"
                    : asset.sentimentScore < -0.2
                      ? "text-rose-500"
                      : "text-gray-400";

                return (
                  <tr
                    key={asset.ticker}
                    className="hover:bg-gray-900/40 transition-colors group"
                  >
                    {/* ASSET DETAILS */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-gray-200 group-hover:text-cyan-400 transition-colors">
                        {asset.ticker}
                      </div>
                      <div className="text-gray-500 text-[10px] max-w-[180px] truncate">
                        {asset.name}
                      </div>
                    </td>

                    {/* PRICING */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-gray-200">
                        {asset.assetClass === "CRYPTO" ? "$" : "Rp"}
                        {asset.price.toLocaleString(undefined, {
                          minimumFractionDigits:
                            asset.assetClass === "CRYPTO" ? 2 : 0,
                          maximumFractionDigits:
                            asset.assetClass === "CRYPTO" ? 4 : 0,
                        })}
                      </div>
                      <div
                        className={`text-[10px] flex items-center gap-0.5 font-bold ${
                          changeIsPositive
                            ? "text-emerald-400"
                            : "text-rose-500"
                        }`}
                      >
                        {changeIsPositive ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3" />
                        )}
                        {changeIsPositive ? "+" : ""}
                        {asset.changePercent.toFixed(2)}%
                      </div>
                    </td>

                    {/* DIRECTION */}
                    <td className="py-3.5 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          isBull
                            ? "bg-emerald-950/40 text-emerald-300 border border-emerald-800/20"
                            : isBear
                              ? "bg-rose-950/40 text-rose-300 border border-rose-800/20"
                              : "bg-gray-900 text-gray-400 border border-gray-800"
                        }`}
                      >
                        {isBull ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : isBear ? (
                          <TrendingDown className="w-3 h-3" />
                        ) : null}
                        {asset.trendDirection}
                      </span>
                    </td>

                    {/* PROBABILITY */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="font-bold text-gray-300">
                        {(asset.probability * 100).toFixed(0)}%
                      </div>
                      <div className="w-16 bg-gray-900 h-1.5 rounded-full mx-auto overflow-hidden">
                        <div
                          className="bg-cyan-500 h-full rounded-full"
                          style={{ width: `${asset.probability * 100}%` }}
                        />
                      </div>
                    </td>

                    {/* VOLATILITY */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="text-gray-300 font-bold">
                        {asset.volatilityScore}%
                      </span>
                      <p className="text-[9px] text-gray-500 lowercase">
                        ATR ratio
                      </p>
                    </td>

                    {/* LIQUIDITY */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="text-gray-300 font-bold">
                        {asset.liquidityScore}%
                      </span>
                      <p className="text-[9px] text-gray-500 lowercase">
                        volume proxy
                      </p>
                    </td>

                    {/* SENTIMENT */}
                    <td
                      className={`py-3.5 px-4 text-center font-bold ${sentimentColor}`}
                    >
                      {asset.sentimentScore > 0.2
                        ? "Positif"
                        : asset.sentimentScore < -0.2
                          ? "Negatif"
                          : "Netral"}
                    </td>

                    {/* RANK SCORE */}
                    <td className="py-3.5 px-4 text-right font-bold text-cyan-400">
                      {(asset.probability * asset.rrRatio * 10).toFixed(1)}
                    </td>

                    {/* ACTIONS */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => onSelectAsset(asset.ticker)}
                        className="bg-gray-900 border border-gray-800 hover:border-cyan-800 hover:bg-cyan-950/20 text-cyan-400 text-[10px] px-2.5 py-1.5 rounded transition-all active:scale-95 cursor-pointer font-bold"
                      >
                        {t.deepAnalysisBtn}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
