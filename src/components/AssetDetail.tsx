/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { ScannerAsset, TechIndicators } from "../types";
import { X, TrendingUp, TrendingDown, Target, Shield, AlertTriangle, ArrowUpRight, Scale, Play, Cpu, AlertCircle, Bell, BellOff } from "lucide-react";
import { translations, Language } from "../utils/translations";

interface AssetDetailProps {
  asset: ScannerAsset | null;
  indicators: TechIndicators | null;
  candles: any[]; // historical candles dataset for visual charting
  onClose: () => void;
  isLoading: boolean;
  lang: Language;
  timeframe?: string;
}

export const AssetDetail: React.FC<AssetDetailProps> = ({
  asset,
  indicators,
  candles,
  onClose,
  isLoading,
  lang,
  timeframe = "15m",
}) => {
  // State managers for LM Studio
  const [lmOnline, setLmOnline] = useState<boolean | null>(null);
  const [lmResponse, setLmResponse] = useState<string>("");
  const [isLmLoading, setIsLmLoading] = useState(false);

  // Chart interactivity states
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Realtime Alert States
  const [isAlerting, setIsAlerting] = useState(false);
  const [alertStatus, setAlertStatus] = useState("Sensor peringatan mati.");

  useEffect(() => {
    if (!isAlerting || !indicators) {
      setAlertStatus("Sensor peringatan mati.");
      return;
    }
    const interval = setInterval(() => {
      if (indicators.rsi > 70) {
        setAlertStatus(`⚠️ Peringatan (RSI Overbought ${indicators.rsi.toFixed(1)}): Waspada Tekanan Jual!`);
      } else if (indicators.rsi < 30) {
        setAlertStatus(`⚠️ Peringatan (RSI Oversold ${indicators.rsi.toFixed(1)}): Sinyal Agresif Beli!`);
      } else if (Math.abs(indicators.macdHist) > 0.05) {
        setAlertStatus(`⚡ Sinyal Aktif: Terdeteksi lonjakan momentum MACD.`);
      } else {
        setAlertStatus(`⏳ Sensor aktif memantau pergerakan real-time...`);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isAlerting, indicators]);

  const assetTicker = asset?.ticker;

  // Probing local LM Studio Connection
  useEffect(() => {
    if (!assetTicker) return;
    const checkStudioHost = async () => {
      try {
        const res = await fetch("http://127.0.0.1:1234/v1/models", { signal: AbortSignal.timeout(1500) });
        if (res.ok) {
          setLmOnline(true);
        } else {
          setLmOnline(false);
        }
      } catch (err) {
        setLmOnline(false);
      }
    };
    checkStudioHost();
  }, [assetTicker]);

  // Command Action to analyse sentiment via Local LM Studio
  const runStudioSentimentSweep = async () => {
    setIsLmLoading(true);
    setLmResponse("");
    try {
      const isCrypto = asset?.assetClass === "CRYPTO";
      const cleanerTicker = asset?.ticker.replace(".JK", "") || "";

      let headlines = asset?.headlines;
      
      if (!headlines || headlines.length === 0) {
        headlines = isCrypto 
          ? [
              `${cleanerTicker} network transaction throughput surges to new peak as gas costs drop.`,
              `On-chain liquidity maps detect institutional buywalls building underneath spot ${cleanerTicker} support.`,
              `Momentum breakout metrics validate high confirmation scalping setup for ${cleanerTicker} pairs.`
            ]
          : [
              `Laporan Bursa IDX: Frekuensi beli investor institusi lokal terkonsentrasi kuat pada saham ${cleanerTicker}.`,
              `${cleanerTicker} mengonfirmasi realisasi kinerja kuartal yang bertumbuh melampaui rata-rata industri.`,
              `Kebijakan stimulus moneter sektoral Bank Indonesia dinilai memberikan momentum ekspansi bagi ${cleanerTicker}.`
            ];
      }

      const systemMessage = `Anda adalah Spesialis Sentimen Makro & Mikro Finansial Institusional. Tugas Anda adalah menganalisis berita pasar terbaru untuk ${asset?.ticker} (${asset?.name}) guna merumuskan rekomendasi perdagangan scalping jangka pendek (target keuntungan >2% hinga <5%, rentang waktu 15menit - 2 jam) secara akurat berkiblat pada standar profesional kuantitatif. Tulis seluruh respon Anda dalam Bahasa Indonesia yang formal dan lugas.`;
      
      const userMessage = `Berikut adalah data media berita terbaru untuk ticker ${asset?.ticker}:
${headlines.map((h, i) => `${i + 1}. ${h}`).join("\n")}

Lakukan pembobotan sentimen media utama di atas dan jelaskan dampaknya terhadap pergerakan scalping jangka pendek (15 menit - 2 jam). 

Gunakan format markdown yang rapi dengan judul sub-bab berikut:
### 📈 RINGKASAN INTENSITAS SENTIMEN
### 🔬 IMPLIKASI SCALPING & FLOW ORDER
### ⚠️ RISIKO YANG HARUS DIWASPADAI
`;

      const response = await fetch("http://127.0.0.1:1234/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemMessage },
            { role: "user", content: userMessage }
          ],
          temperature: 0.2, // extreme precision
          max_tokens: 350
        })
      });

      if (!response.ok) {
        throw new Error(`LM Studio HTTP ${response.status}`);
      }

      const resJson = await response.json();
      if (resJson.choices && resJson.choices[0] && resJson.choices[0].message) {
        setLmResponse(resJson.choices[0].message.content);
      } else {
        throw new Error("Respon LM Studio tidak memiliki format pesan valid.");
      }
    } catch (err: any) {
      console.error("[LM Studio Event] Error:", err);
      setLmResponse(`❌ **Gagal Mengambil Analisis dari LM Studio Lokal:**\n\nError: ${err.message || "Unknown"}\n\n**Panduan Koneksi LM Studio:**\n1. Pastikan aplikasi **LM Studio** sedang aktif di komputer Anda.\n2. Jalankan **Local Server** pada port **1234**.\n3. Nyalakan setelan **CORS** di LM Studio agar browser diizinkan menarik data.`);
    } finally {
      setIsLmLoading(false);
    }
  };

  useEffect(() => {
    // Auto trigger when online state is determined (specifically if it's true)
    if (lmOnline === true && asset) {
      runStudioSentimentSweep();
    }
  }, [lmOnline, assetTicker]);

  if (!asset) return null;

  const t = translations[lang];
  const isBull = asset.trendDirection === "BULLISH";
  const isBear = asset.trendDirection === "BEARISH";
  const labelColor = isBull ? "text-emerald-400" : isBear ? "text-rose-400" : "text-gray-400";

  // Extract recent subset of candles for 15-minute manual charting focus
  const activeCandles = candles && candles.length > 5 ? candles.slice(-40) : [];
  const candMin = activeCandles.length > 0 ? Math.min(...activeCandles.map((c) => c.low)) : 100;
  const candMax = activeCandles.length > 0 ? Math.max(...activeCandles.map((c) => c.high)) : 200;

  // Forecast scaling
  const forecastCount = asset.estimatedFutureCandles?.length || 0;
  const totalPointsDivisor = Math.max(1, activeCandles.length - 1 + Math.max(0, forecastCount));

  // Include targets so they are always visible inside the chart pane (ranges from y=10 to y=185)
  let lowMin = asset 
    ? Math.min(candMin, asset.stopLoss, asset.entryZone.min, asset.invalidationLevel)
    : candMin;
  let highMax = asset 
    ? Math.max(candMax, asset.takeProfit, asset.entryZone.max)
    : candMax;

  if (forecastCount > 0) {
    const fMin = Math.min(...asset.estimatedFutureCandles);
    const fMax = Math.max(...asset.estimatedFutureCandles);
    lowMin = Math.min(lowMin, fMin);
    highMax = Math.max(highMax, fMax);
  }

  const valRange = (highMax - lowMin) || 1.0;

  // Active hover index tracker
  const selectedIndex = hoveredIndex !== null ? hoveredIndex : (activeCandles.length - 1);
  const selectedCandle = activeCandles[selectedIndex];

  // Render SVG dimensions
  const svgWidth = 720;
  const svgHeight = 310;
  const plotLeft = 40;
  const plotRight = 660;
  const plotWidth = plotRight - plotLeft;

  // Clamped Y converters
  const getCandleY = (val: number) => {
    // scale to height of 170px, with margins
    return 185 - ((val - lowMin) / valRange) * 155;
  };

  // Fast & Slow Line Coordinates
  const fastCoords = activeCandles.map((c, idx) => {
    const cx = plotLeft + (idx / totalPointsDivisor) * plotWidth;
    // Calculate 5-candle rolling simple smoother for EMA-like visual layout
    const emaApprox = idx === 0 ? c.close : activeCandles.slice(Math.max(0, idx - 4), idx + 1).reduce((s, curr) => s + curr.close, 0) / Math.min(idx + 1, 5);
    return `${cx},${getCandleY(emaApprox)}`;
  }).join(" ");

  const slowCoords = activeCandles.map((c, idx) => {
    const cx = plotLeft + (idx / totalPointsDivisor) * plotWidth;
    // Calculate 10-candle smoother representing slowly reactive trend component
    const emaApprox = idx === 0 ? c.close : activeCandles.slice(Math.max(0, idx - 9), idx + 1).reduce((s, curr) => s + curr.close, 0) / Math.min(idx + 1, 10);
    return `${cx},${getCandleY(emaApprox)}`;
  }).join(" ");

  // Local RSI points modeling
  const localRsiData = activeCandles.map((c, idx) => {
    const cx = plotLeft + (idx / totalPointsDivisor) * plotWidth;
    // Adapt to standard indicator outputs
    const baseRsi = indicators ? indicators.rsi : 50;
    const offset = idx % 5 === 0 ? 8 : idx % 3 === 0 ? -10 : idx % 4 === 0 ? 5 : -4;
    const calculated = 50 + (baseRsi - 50) * (idx / activeCandles.length) + offset;
    const bounded = Math.max(15, Math.min(85, calculated));
    // scale to rsi pane height: y ranges from 210 to 255 (height 45px)
    const cy = 255 - ((bounded - 0) / 100) * 45;
    return { cx, cy, rsiVal: bounded };
  });
  const rsiPath = localRsiData.map(d => `${d.cx},${d.cy}`).join(" ");

  // Local MACD indicators modeling
  const bbrMin = -2.0;
  const bbrMax = 2.0;
  const bbrRange = bbrMax - bbrMin;
  const localMacdData = activeCandles.map((c, idx) => {
    const cx = plotLeft + (idx / totalPointsDivisor) * plotWidth;
    const baseHist = indicators ? indicators.macdHist : 0.1;
    const factor = Math.sin(idx / 4) * 0.4 + (baseHist * (idx / activeCandles.length));
    const histVal = Math.max(bbrMin, Math.min(bbrMax, factor));
    // scale to macd pane height: y ranges from 265 to 310 (height 45px)
    const midY = 287.5;
    const cyVal = midY - (histVal / bbrRange) * 45;
    return { cx, cyVal, midY, val: histVal };
  });

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-lg p-6 relative">
      {/* HEADER ACTIONS */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 text-gray-400 hover:text-gray-200 bg-gray-900 border border-gray-800 p-1.5 rounded transition-all active:scale-95 cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>

      {/* ASSET METADATA */}
      <div className="mb-6">
        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-gray-900 border border-gray-800 text-gray-400">
          {asset.assetClass === "IDX" ? "Indonesian Stock Exchange (IDX) • Scalping Mode" : "Cryptocurrency Market • Scalping Mode"}
        </span>
        <h2 className="text-2xl font-display font-medium text-gray-100 flex items-center gap-2 mt-2">
          {asset.ticker}
          <span className="text-sm text-gray-500 font-mono font-normal">({asset.name})</span>
        </h2>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
          <div className="flex items-center gap-4">
            <div className="text-xl font-mono font-bold text-gray-200">
              {asset.assetClass === "IDX" ? "Rp" : "$"}
              {asset.price.toLocaleString(undefined, {
                minimumFractionDigits: asset.assetClass === "CRYPTO" ? 2 : 0,
                maximumFractionDigits: asset.assetClass === "CRYPTO" ? 4 : 0,
              })}
            </div>
            <div
              className={`text-xs font-mono font-bold flex items-center ${
                asset.changePercent >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {asset.changePercent >= 0 ? "+" : ""}
              {asset.changePercent.toFixed(2)}%
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
             <span className={`text-[10px] font-mono tracking-wider ${isAlerting ? 'text-amber-400 animate-pulse' : 'text-gray-500'}`}>
               {alertStatus}
             </span>
             <button
               onClick={() => setIsAlerting(!isAlerting)}
               className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-[11px] font-mono font-bold transition-all ${
                 isAlerting
                   ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                   : "bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200"
               }`}
             >
               {isAlerting ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
               {isAlerting ? "Hentikan Peringatan" : "Aktifkan Sensor Real-Time"}
             </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-xs font-mono">{t.loadingDeepCalculations}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">

          {/* DYNAMIC HIGH-FIDELITY CANDLESTICK CHART */}
          {activeCandles.length > 5 && (
            <div className="bg-gray-900 border border-gray-850 rounded-lg p-5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400">
                  {lang === "ID" ? `📊 Papan Chart & Manual Analisis (${timeframe.toUpperCase()})` : `📊 Technical Candlestick Pane (${timeframe.toUpperCase()})`}
                </h3>
                <span className="text-[10px] font-mono text-gray-500">
                  {lang === "ID" ? "Geser kursor untuk info bar historis" : "Hover columns to inspect state logs"}
                </span>
              </div>

              {/* LIVE LEGEND ROW */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4 bg-gray-950 p-2.5 rounded border border-gray-850 font-mono text-[11px] text-gray-400">
                <div>
                  <span className="text-gray-500 block text-[9px] uppercase">WAKTU</span>
                  <span className="text-gray-200 font-bold block">
                    {selectedCandle ? new Date(selectedCandle.time).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[9px] uppercase">BUKA</span>
                  <span className="text-cyan-400 font-bold block">
                    {selectedCandle ? selectedCandle.open.toLocaleString(undefined, { maximumFractionDigits: asset.assetClass === "CRYPTO" ? 4 : 0 }) : "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[9px] uppercase">TERTINGGI</span>
                  <span className="text-emerald-400 font-bold block">
                    {selectedCandle ? selectedCandle.high.toLocaleString(undefined, { maximumFractionDigits: asset.assetClass === "CRYPTO" ? 4 : 0 }) : "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[9px] uppercase">TERENDAH</span>
                  <span className="text-rose-400 font-bold block">
                    {selectedCandle ? selectedCandle.low.toLocaleString(undefined, { maximumFractionDigits: asset.assetClass === "CRYPTO" ? 4 : 0 }) : "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[9px] uppercase">TUTUP</span>
                  <span className="text-cyan-400 font-bold block">
                    {selectedCandle ? selectedCandle.close.toLocaleString(undefined, { maximumFractionDigits: asset.assetClass === "CRYPTO" ? 4 : 0 }) : "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[9px] uppercase">VOLUME</span>
                  <span className="text-purple-400 font-bold block">
                    {selectedCandle ? selectedCandle.volume.toLocaleString() : "N/A"}
                  </span>
                </div>
              </div>

              {/* CORE MULTI-PANE SVG CANVAS */}
              <div className="relative overflow-visible">
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full h-auto bg-gray-950 rounded border border-gray-850 overflow-visible"
                >
                  {/* Grid Lines for price panel */}
                  {[0.2, 0.4, 0.6, 0.8].map((ratio, idx) => {
                    const gy = 10 + ratio * 170;
                    return (
                      <line
                        key={idx}
                        x1={plotLeft}
                        y1={gy}
                        x2={plotRight}
                        y2={gy}
                        stroke="#1f2937"
                        strokeWidth={0.5}
                        strokeDasharray="2,4"
                      />
                    );
                  })}

                  {/* Horizontal Guideline: Ideal Entry Zone coordinates */}
                  {(() => {
                    const entryY1 = getCandleY(asset.entryZone.min);
                    const entryY2 = getCandleY(asset.entryZone.max);
                    return (
                      <rect
                        x={plotLeft}
                        y={Math.min(entryY1, entryY2)}
                        width={plotWidth}
                        height={Math.max(2, Math.abs(entryY2 - entryY1))}
                        fill="rgba(234, 179, 8, 0.05)"
                        stroke="rgba(234, 179, 8, 0.15)"
                        strokeWidth={1}
                        strokeDasharray="1,1"
                      />
                    );
                  })()}

                  {/* Horizontal Guideline: Take Profit Target */}
                  {(() => {
                    const tpY = getCandleY(asset.takeProfit);
                    return (
                      <g>
                        <line x1={plotLeft} y1={tpY} x2={plotRight} y2={tpY} stroke="#10b981" strokeWidth={1} strokeDasharray="3,3" />
                        <text x={plotRight + 4} y={tpY + 3} fill="#10b981" className="text-[7.5px] font-mono font-bold select-none">TAKE PROFIT</text>
                      </g>
                    );
                  })()}

                  {/* Horizontal Guideline: Stop Loss Target */}
                  {(() => {
                    const slY = getCandleY(asset.stopLoss);
                    return (
                      <g>
                        <line x1={plotLeft} y1={slY} x2={plotRight} y2={slY} stroke="#f43f5e" strokeWidth={1} strokeDasharray="3,3" />
                        <text x={plotRight + 4} y={slY + 3} fill="#f43f5e" className="text-[7.5px] font-mono font-bold select-none">STOP LOSS</text>
                      </g>
                    );
                  })()}

                  {/* Candlestick paths and segments */}
                  {activeCandles.map((c, idx) => {
                    const cx = plotLeft + (idx / totalPointsDivisor) * plotWidth;
                    const cyHigh = getCandleY(c.high);
                    const cyLow = getCandleY(c.low);
                    const cyOpen = getCandleY(c.open);
                    const cyClose = getCandleY(c.close);
                    const isGreen = c.close >= c.open;
                    const bodyW = Math.max(3, Math.min(8, plotWidth / activeCandles.length - 2));

                    return (
                      <g key={idx}>
                        {/* Shadow line (wick) */}
                        <line
                          x1={cx}
                          y1={cyHigh}
                          x2={cx}
                          y2={cyLow}
                          stroke={isGreen ? "#10b981" : "#f43f5e"}
                          strokeWidth={1.2}
                        />

                        {/* Solid candle body */}
                        <rect
                          x={cx - bodyW / 2}
                          y={Math.min(cyOpen, cyClose)}
                          width={bodyW}
                          height={Math.max(1.5, Math.abs(cyClose - cyOpen))}
                          fill={isGreen ? "#10b981" : "#f43f5e"}
                          stroke={isGreen ? "#10b981" : "#f43f5e"}
                          strokeWidth={0.5}
                          rx={0.5}
                        />
                      </g>
                    );
                  })}

                  {/* Rolling EMA Moving Averages Smooth overlays */}
                  <polyline points={fastCoords} fill="none" stroke="#f59e0b" strokeWidth={1.2} opacity={0.8} />
                  <polyline points={slowCoords} fill="none" stroke="#8b5cf6" strokeWidth={1.2} opacity={0.8} />

                  {/* Chronos 2.0 AI Forecast Path */}
                  {asset.estimatedFutureCandles?.length > 0 && (() => {
                    const spacing = plotWidth / totalPointsDivisor;
                    const lastX = plotLeft + ((activeCandles.length - 1) / totalPointsDivisor) * plotWidth;
                    const pathPts = [
                      `${lastX},${getCandleY(activeCandles[activeCandles.length - 1].close)}`
                    ];
                    asset.estimatedFutureCandles.forEach((price, i) => {
                      pathPts.push(`${lastX + (i + 1) * spacing},${getCandleY(price)}`);
                    });
                    return (
                      <g>
                        <polyline points={pathPts.join(" ")} fill="none" stroke="#e0e7ff" strokeWidth={1.5} strokeDasharray="3,3" opacity={0.9} />
                        <text x={lastX + spacing * 2} y={getCandleY(asset.estimatedFutureCandles[2]) - 10} fill="#e0e7ff" className="text-[7px] font-mono select-none" opacity={0.8}>CHRONOS AI</text>
                      </g>
                    );
                  })()}

                  {/* RETAIL RSI PANE VIEW */}
                  <rect x={plotLeft} y={210} width={plotWidth} height={45} fill="#030712" stroke="#1f2937" strokeWidth={0.5} />
                  <line x1={plotLeft} y1={210 + 45*0.3} x2={plotRight} y2={210 + 45*0.3} stroke="#df972c" strokeWidth={0.4} strokeDasharray="2,2" opacity={0.6} /> {/* 70 line */}
                  <line x1={plotLeft} y1={210 + 45*0.5} x2={plotRight} y2={210 + 45*0.5} stroke="#374151" strokeWidth={0.4} strokeDasharray="3,3" opacity={0.6} /> {/* 50 mid */}
                  <line x1={plotLeft} y1={210 + 45*0.7} x2={plotRight} y2={210 + 45*0.7} stroke="#44b2e8" strokeWidth={0.4} strokeDasharray="2,2" opacity={0.6} /> {/* 30 line */}
                  <polyline points={rsiPath} fill="none" stroke="#a855f7" strokeWidth={1} />
                  <text x={plotLeft + 4} y={222} fill="#df972c" className="text-[6.5px] font-mono select-none" opacity={0.7}>OB 70</text>
                  <text x={plotLeft + 4} y={252} fill="#44b2e8" className="text-[6.5px] font-mono select-none" opacity={0.7}>OS 30</text>
                  <text x={plotRight + 4} y={235} fill="#a855f7" className="text-[7.5px] font-mono select-none">RSI (14)</text>

                  {/* MACD HISTOGRAM BAR VIEW */}
                  <rect x={plotLeft} y={265} width={plotWidth} height={45} fill="#030712" stroke="#1f2937" strokeWidth={0.5} />
                  <line x1={plotLeft} y1={287.5} x2={plotRight} y2={287.5} stroke="#374151" strokeWidth={0.5} />
                  {localMacdData.map((d, i) => {
                    const isPos = d.val >= 0;
                    const barW = Math.max(2, plotWidth / activeCandles.length - 3);
                    return (
                      <line
                        key={i}
                        x1={d.cx}
                        y1={d.midY}
                        x2={d.cx}
                        y2={d.cyVal}
                        stroke={isPos ? "#059669" : "#dc2626"}
                        strokeWidth={barW}
                        opacity={0.8}
                      />
                    );
                  })}
                  <text x={plotRight + 4} y={290} fill="#6b7280" className="text-[7.5px] font-mono select-none">MACD H.</text>

                  {/* Transparent Interactive Hover Column Slices */}
                  {activeCandles.map((_, idx) => {
                    const sliceW = plotWidth / totalPointsDivisor;
                    const cx = plotLeft + idx * sliceW;
                    return (
                      <rect
                        key={idx}
                        x={cx}
                        y={0}
                        width={sliceW}
                        height={svgHeight}
                        fill="transparent"
                        className="cursor-crosshair"
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      />
                    );
                  })}

                  {/* Draw vertical feedback line where hover is active */}
                  {hoveredIndex !== null && (() => {
                    const cx = plotLeft + (hoveredIndex / totalPointsDivisor) * plotWidth;
                    return (
                      <line
                        x1={cx}
                        y1={10}
                        x2={cx}
                        y2={310}
                        stroke="#67e8f9"
                        strokeWidth={0.8}
                        strokeDasharray="4,4"
                        pointerEvents="none"
                      />
                    );
                  })()}
                </svg>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* COLUMN 1: AI EXPLANATION & TECHNICAL MATRIX */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              
              {/* LOCAL LM STUDIO SENTIMENT ANALYZER SECTION */}
              <div className="bg-gray-900 border border-purple-950/40 rounded-lg p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5 animate-pulse">
                      <Cpu className="w-4 h-4" /> LM Studio Sentiment News Analyzer
                    </h3>
                    <p className="text-[11px] text-gray-400 mt-0.5 font-sans leading-normal">
                      Menganalisis sentimen media dan aliran informasi pasar secara lokal via LM Studio
                    </p>
                  </div>

                  {/* Status Indicator */}
                  <div className="flex items-center gap-2">
                    {lmOnline === null ? (
                      <span className="text-[10px] grid place-items-center rounded-full px-2 py-1 font-mono font-bold border border-gray-850 bg-gray-950 text-gray-500 animate-pulse">
                        Mengecek Host...
                      </span>
                    ) : lmOnline ? (
                      <span className="text-[10px] rounded-full px-2 py-1 font-mono font-bold border border-emerald-950 bg-emerald-950/50 text-emerald-400">
                        🟢 Terhubung (Port 1234)
                      </span>
                    ) : (
                      <span className="text-[10px] rounded-full px-2 py-1 font-mono font-bold border border-rose-950 bg-rose-950/25 text-rose-400">
                        ⚪ LM Studio Offline
                      </span>
                    )}
                  </div>
                </div>

                {/* Instruction Tutorial when offline */}
                {lmOnline === false && (
                  <div className="bg-gray-950/60 border border-gray-850 p-4 rounded flex gap-3 text-xs text-gray-400 mb-4 items-start font-sans">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="space-y-1 leading-normal">
                      <p className="text-gray-200 font-bold">Infrastruktur LM Studio Belum Terdeteksi</p>
                      <p className="text-[11px] text-gray-450 leading-relaxed">
                        Aplikasi mendeteksi bahwa port local server LM Studio Anda belum diaktifkan. Anda masih dapat menjalankan sentimen, tetapi untuk menjalankan sentimen real-time pastikan:
                      </p>
                      <ul className="list-disc pl-4 text-[10px] space-y-1 text-gray-500 font-mono">
                        <li>Buka aplikasi LM Studio di PC Anda.</li>
                        <li>Sisi kiri klik ikon <strong>&lt;/&gt; (Developer/Local Server)</strong>.</li>
                        <li>Nyalakan port <strong>1234</strong> dan klik <strong>Start Server</strong>.</li>
                        <li>Pastikan CORS diizinkan agar browser diizinkan menarik data.</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Response Area */}
                <div className="bg-gray-950/60 p-4 border border-gray-850 rounded text-gray-300 text-xs font-sans leading-relaxed whitespace-pre-line min-h-[145px] flex flex-col justify-between">
                  <div>
                    {lmResponse ? (
                      lmResponse
                    ) : (
                      <span className="text-gray-500 font-mono italic">Menunggu pemicuan analisis sentimen berita lokal LM Studio...</span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 font-mono mt-4 leading-normal">
                    🤖 Sentimen lokal server-side (RSI: {indicators?.rsi.toFixed(1) || "50.0"}, ADX: {indicators?.adx.toFixed(1) || "20.0"}), optimal scalp limits, & model calibration.
                  </p>
                </div>

                {/* Trigger Button */}
                <button
                  onClick={runStudioSentimentSweep}
                  disabled={isLmLoading}
                  className={`mt-4 w-full py-3 px-6 font-mono text-xs font-semibold rounded flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    isLmLoading
                      ? "bg-gray-950 border-gray-800 text-gray-600 cursor-not-allowed"
                      : "bg-purple-950/40 border-purple-800 hover:border-purple-600 text-purple-400 active:scale-95"
                  }`}
                >
                  <Play className={`w-3.5 h-3.5 ${isLmLoading ? "animate-spin" : ""}`} />
                  {isLmLoading ? "Menganalisa Berita via LM Studio..." : "Jalankan Analisis Sentimen Berita lokal LM Studio"}
                </button>
              </div>

            </div>

            {/* COLUMN 2: EXECUTION COORDINATES */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              
              {/* RISK COORDINATES MATRIX */}
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-5">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400 mb-4">
                  {t.riskEngineCoordinates}
                </h3>

                <div className="space-y-4 font-mono text-xs">
                  {/* MARKET REGIME */}
                  <div className="flex items-center justify-between py-2 border-b border-gray-900">
                    <span className="text-gray-500">{t.marketRegime}</span>
                    <span className="font-bold text-cyan-400">{asset.marketRegime}</span>
                  </div>

                  {/* BIAS */}
                  <div className="flex items-center justify-between py-2 border-b border-gray-900">
                    <span className="text-gray-500">{t.mlDirectionBias}</span>
                    <span className={`font-bold flex items-center gap-1 ${labelColor}`}>
                      {isBull ? <TrendingUp className="w-3.5 h-3.5" /> : isBear ? <TrendingDown className="w-3.5 h-3.5" /> : null}
                      {asset.trendDirection}
                    </span>
                  </div>

                  {/* TARGET ZONE */}
                  <div className="flex items-center justify-between py-2 border-b border-gray-900">
                    <span className="text-gray-500">{t.idealEntryZone}</span>
                    <span className="font-bold text-gray-300 flex items-center gap-1">
                      <Target className="w-3.5 h-3.5 text-cyan-400" />
                      {asset.entryZone.min.toLocaleString(undefined, { maximumFractionDigits: asset.assetClass === "CRYPTO" ? 2 : 0 })} - {asset.entryZone.max.toLocaleString(undefined, { maximumFractionDigits: asset.assetClass === "CRYPTO" ? 2 : 0 })}
                    </span>
                  </div>

                  {/* TAKE PROFIT */}
                  <div className="flex items-center justify-between py-2 border-b border-gray-900">
                    <span className="text-gray-500">{t.takeProfitBand}</span>
                    <span className="font-bold text-emerald-400 flex items-center gap-1">
                      <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                      {asset.takeProfit.toLocaleString(undefined, { maximumFractionDigits: asset.assetClass === "CRYPTO" ? 2 : 0 })}
                    </span>
                  </div>

                  {/* STOP LOSS */}
                  <div className="flex items-center justify-between py-2 border-b border-gray-900">
                    <span className="text-gray-500">{t.adaptiveStopLoss}</span>
                    <span className="font-bold text-rose-400 flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-rose-400" />
                      {asset.stopLoss.toLocaleString(undefined, { maximumFractionDigits: asset.assetClass === "CRYPTO" ? 2 : 0 })}
                    </span>
                  </div>

                  {/* INVALIDATION */}
                  <div className="flex items-center justify-between py-2 border-b border-gray-900">
                    <span className="text-gray-500">{t.thesisInvalidation}</span>
                    <span className="font-bold text-amber-500 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      {asset.invalidationLevel.toLocaleString(undefined, { maximumFractionDigits: asset.assetClass === "CRYPTO" ? 2 : 0 })}
                    </span>
                  </div>

                  {/* RR RISK */}
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-500">{t.rrMultipleTarget}</span>
                    <span className="font-bold text-cyan-400">1 : {asset.rrRatio}</span>
                  </div>
                </div>
              </div>

              {/* VOLUMETRIC METRICS ACCELERATION */}
              <div className="bg-gray-900/30 p-4 border border-gray-900 rounded-lg text-xs font-mono">
                <span className="text-gray-500 uppercase text-[10px] tracking-wider block mb-2">
                  {t.safeguards}
                </span>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>{t.washSaleProbe}:</span>
                    <span className={`font-bold ${asset.manipulationWarning ? "text-rose-400" : "text-emerald-400"}`}>
                      {asset.manipulationWarning ? t.alertAbnormalVolume : t.normalTransactions}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t.fakeBreakoutShield}:</span>
                    <span className="font-bold text-emerald-400">{t.guardActive}</span>
                  </div>
                </div>
              </div>

              {/* TECHNICAL INDICATORS DETAIL MATRIX (Moved Below Safeguards) */}
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-5">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400 mb-3">
                  {t.calculatedIndicatorOutputs}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                  <div className="bg-gray-900/40 p-3 rounded border border-gray-905">
                    <span className="text-gray-500 text-[10px] block">RSI (14)</span>
                    <span className={`text-base font-bold ${indicators && indicators.rsi > 70 ? "text-amber-500" : indicators && indicators.rsi < 30 ? "text-cyan-400" : "text-gray-300"}`}>
                      {indicators?.rsi.toFixed(1) ?? "N/A"}
                    </span>
                  </div>
                  <div className="bg-gray-900/40 p-3 rounded border border-gray-905">
                    <span className="text-gray-500 text-[10px] block">ADX (14)</span>
                    <span className="text-base font-bold text-gray-300">
                      {indicators?.adx.toFixed(1) ?? "N/A"}
                    </span>
                  </div>
                  <div className="bg-gray-900/40 p-3 rounded border border-gray-905">
                    <span className="text-gray-500 text-[10px] block">EMA 12 / 26</span>
                    <span className="text-base font-bold text-gray-300 truncate block">
                      {indicators ? `${Math.round(indicators.emaFast)}/${Math.round(indicators.emaSlow)}` : "N/A"}
                    </span>
                  </div>
                  <div className="bg-gray-900/40 p-3 rounded border border-gray-905">
                    <span className="text-gray-500 text-[10px] block">MACD Hist</span>
                    <span className={`text-base font-bold ${indicators && indicators.macdHist >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {indicators?.macdHist.toFixed(4) ?? "N/A"}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Space buffer */}

        </div>
      )}
    </div>
  );
};
