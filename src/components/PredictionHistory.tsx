/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { HistoricalPrediction } from "../types";
import { CheckCircle2, XCircle, Clock, History, Calendar } from "lucide-react";
import { translations, Language } from "../utils/translations";

interface PredictionHistoryProps {
  predictions: HistoricalPrediction[];
  lang: Language;
}

export const PredictionHistory: React.FC<PredictionHistoryProps> = ({
  predictions,
  lang,
}) => {
  const t = translations[lang];

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-900">
        <div>
          <h2 className="text-base font-display font-semibold text-gray-200 flex items-center gap-2">
            <History className="w-4 h-4 text-cyan-400" /> {t.walkForwardLedger}
          </h2>
          <p className="text-gray-500 text-xs font-mono">{t.ledgerDesc}</p>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[300px] overflow-y-auto pr-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-900 text-gray-500 text-[10px] font-mono uppercase tracking-wider">
              <th className="py-2.5 px-3">{t.colScanDate}</th>
              <th className="py-2.5 px-3">{t.colAsset}</th>
              <th className="py-2.5 px-3">{t.colClass}</th>
              <th className="py-2.5 px-3 text-center">{t.colDirection}</th>
              <th className="py-2.5 px-3 text-right">{t.colInitialPrice}</th>
              <th className="py-2.5 px-3 text-right">{t.colRealizedPrice}</th>
              <th className="py-2.5 px-3 text-right">{t.colDelta}</th>
              <th className="py-2.5 px-3 text-right">{t.colAuditStatus}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-900 text-xs font-mono">
            {predictions.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-gray-500">
                  {t.noPredictions}
                </td>
              </tr>
            ) : (
              [...predictions].reverse().map((pred) => {
                const dateRep = new Date(pred.timestamp).toLocaleTimeString();
                const isBull = pred.predictedDirection === "BULLISH";
                const isBear = pred.predictedDirection === "BEARISH";

                // Audited status variables
                const isRealized = pred.success !== undefined;
                const changeIsPositive = (pred.realizedPercent ?? 0) >= 0;

                return (
                  <tr
                    key={pred.id}
                    className="hover:bg-gray-900/10 transition-colors"
                  >
                    <td className="py-2.5 px-3 text-gray-400 font-mono text-[11px] flex items-center gap-1.5 whitespace-nowrap">
                      <Calendar className="w-3 h-3 text-gray-600" />
                      {dateRep}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-gray-300">
                      {pred.ticker}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 text-[10px]">
                      {pred.assetClass}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isBull
                            ? "bg-emerald-950/20 text-emerald-400"
                            : isBear
                              ? "bg-rose-950/20 text-rose-400"
                              : "bg-gray-900 text-gray-400"
                        }`}
                      >
                        {pred.predictedDirection}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-gray-400">
                      {pred.assetClass === "CRYPTO" ? "$" : "Rp"}
                      {pred.initialPrice.toLocaleString(undefined, {
                        maximumFractionDigits:
                          pred.assetClass === "CRYPTO" ? 2 : 0,
                      })}
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-400 font-bold">
                      {isRealized ? (
                        <>
                          {pred.assetClass === "CRYPTO" ? "$" : "Rp"}
                          {pred.actualPrice?.toLocaleString(undefined, {
                            maximumFractionDigits:
                              pred.assetClass === "CRYPTO" ? 2 : 0,
                          })}
                        </>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-bold ${
                        isRealized
                          ? changeIsPositive
                            ? "text-emerald-400"
                            : "text-rose-400"
                          : "text-gray-600"
                      }`}
                    >
                      {isRealized ? (
                        <>
                          {changeIsPositive ? "+" : ""}
                          {pred.realizedPercent?.toFixed(2)}%
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {isRealized ? (
                        pred.success ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-[10px] uppercase bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-950/50">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />{" "}
                            {t.truePositive}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-bold text-[10px] uppercase bg-rose-950/20 px-2 py-0.5 rounded border border-rose-950/50">
                            <XCircle className="w-3 h-3 text-rose-500" />{" "}
                            {t.missed}
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 text-gray-500 font-bold text-[10px] uppercase bg-gray-900/60 px-2 py-0.5 rounded border border-gray-900">
                          <Clock className="w-3 h-3 text-gray-500" />{" "}
                          {t.pendingAudit}
                        </span>
                      )}
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
