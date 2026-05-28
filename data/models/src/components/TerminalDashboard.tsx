import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  type CandlestickData,
  type LineData,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { ScannerAsset, TechIndicators } from "../types";
import { Maximize2, Activity, Layers, Network, Database } from "lucide-react";
import { translations, Language } from "../utils/translations";

interface TerminalDashboardProps {
  asset: ScannerAsset;
  candles: any[];
  indicators: TechIndicators | null;
  lang: Language;
}

export function TerminalDashboard({
  asset,
  candles,
  indicators,
  lang,
}: TerminalDashboardProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const t = translations[lang];

  useEffect(() => {
    if (!chartContainerRef.current || candles.length === 0) return;

    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current?.clientWidth });
    };

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: "#030712" }, // Tailwind gray-950
        textColor: "#9ca3af", // Tailwind gray-400
      },
      grid: {
        vertLines: { color: "#1f2937" },
        horzLines: { color: "#1f2937" },
      },
      width: chartContainerRef.current.clientWidth,
      height: 300,
    });

    // Main Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    const formattedData: CandlestickData<Time>[] = candles.map((c) => ({
      time: Math.floor(Number(c.time) / 1000) as UTCTimestamp,
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
    }));

    candleSeries.setData(formattedData);

    // BB Upper
    if (indicators) {
      const bbUpperSeries = chart.addSeries(LineSeries, {
        color: "rgba(56, 189, 248, 0.4)",
        lineWidth: 1,
      });
      const bbLowerSeries = chart.addSeries(LineSeries, {
        color: "rgba(56, 189, 248, 0.4)",
        lineWidth: 1,
      });
      // Simulating indicator lines (constant for simple demo)
      const upperData: LineData<Time>[] = formattedData.map((d) => ({
        time: d.time,
        value: Number(indicators.bbUpper),
      }));
      const lowerData: LineData<Time>[] = formattedData.map((d) => ({
        time: d.time,
        value: Number(indicators.bbLower),
      }));
      bbUpperSeries.setData(upperData);
      bbLowerSeries.setData(lowerData);
    }

    chart.timeScale().fitContent();

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [candles, indicators]);

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden shadow-2xl flex flex-col mt-6">
      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-center gap-3">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="font-mono text-xs font-bold text-gray-200 uppercase tracking-wider">
            {asset.ticker} TERMINAL
          </span>
          <span className="ml-2 px-2 py-0.5 rounded bg-gray-800 text-[10px] font-mono text-gray-400 border border-gray-700 uppercase">
            {asset.marketRegime}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Maximize2 className="w-3.5 h-3.5 text-gray-500 cursor-pointer hover:text-cyan-400 transition-colors" />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-px bg-gray-800">
        {/* LEFT PANEL: TradingView Chart */}
        <div className="col-span-12 lg:col-span-8 bg-gray-950 p-1 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 text-[10px] font-mono text-gray-400 uppercase tracking-widest border-b border-gray-900">
            <div className="flex gap-4">
              <span className="text-cyan-400 border-b border-cyan-400 pb-1">
                Price Action
              </span>
              <span className="hover:text-gray-200 cursor-pointer">
                Volume Profile
              </span>
              <span className="hover:text-gray-200 cursor-pointer">
                Orderflow
              </span>
            </div>
            <span>TradingView Engine v2.1</span>
          </div>
          <div
            ref={chartContainerRef}
            className="w-full flex-grow relative"
            style={{ minHeight: "300px" }}
          />
        </div>

        {/* RIGHT PANEL: Dashboards */}
        <div className="col-span-12 lg:col-span-4 bg-gray-950 flex flex-col gap-px">
          {/* Liquidity Heatmap Mock */}
          <div className="bg-gray-900/30 flex-1 p-3 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span className="font-mono text-[10px] text-gray-400 uppercase tracking-widest">
                Liquidity Heatmap
              </span>
            </div>
            <div className="flex-1 flex flex-col gap-1 text-[10px] font-mono justify-center">
              <div className="flex items-center justify-between">
                <span className="text-rose-400">ASK 100.5</span>
                <div className="w-1/2 h-1 bg-rose-500/80 rounded-full"></div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-rose-400">ASK 100.3</span>
                <div className="w-1/3 h-1 bg-rose-500/60 rounded-full"></div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-rose-400">ASK 100.1</span>
                <div className="w-1/4 h-1 bg-rose-500/40 rounded-full"></div>
              </div>
              <div className="my-1 border-t border-gray-800 border-dashed relative">
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gray-950 px-1 text-gray-500 text-[9px]">
                  {asset.price.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-emerald-400">BID 99.9</span>
                <div className="w-3/4 h-1 bg-emerald-500/40 rounded-full"></div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-emerald-400">BID 99.7</span>
                <div className="w-full h-1 bg-emerald-500/60 rounded-full"></div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-emerald-400">BID 99.5</span>
                <div className="w-1/2 h-1 bg-emerald-500/80 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Factor Dashboard Mock */}
          <div className="bg-gray-900/30 flex-1 p-3 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <Network className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono text-[10px] text-gray-400 uppercase tracking-widest">
                Factor Dashboard
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="bg-gray-950 border border-gray-800 p-2 rounded">
                <div className="text-gray-500 mb-1">Momentum (1M)</div>
                <div
                  className={`font-bold ${asset.momentumScore > 50 ? "text-emerald-400" : "text-rose-400"}`}
                >
                  {asset.momentumScore} Z
                </div>
              </div>
              <div className="bg-gray-950 border border-gray-800 p-2 rounded">
                <div className="text-gray-500 mb-1">Value (P/B)</div>
                <div className="font-bold text-gray-300">1.84 x</div>
              </div>
              <div className="bg-gray-950 border border-gray-800 p-2 rounded">
                <div className="text-gray-500 mb-1">Vol (ATR)</div>
                <div className="font-bold text-amber-400">
                  {asset.volatilityScore} %
                </div>
              </div>
              <div className="bg-gray-950 border border-gray-800 p-2 rounded">
                <div className="text-gray-500 mb-1">Quality</div>
                <div className="font-bold text-cyan-400">A+</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
