/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { SystemCalibration } from "../types";
import { Cpu, ShieldAlert, Award, RefreshCw, Layers } from "lucide-react";
import { translations, Language } from "../utils/translations";

interface MetricCardsProps {
  calibration: SystemCalibration | null;
  scannedCount: number;
  lastScannedTime: string | null;
  onAuditTrigger: () => void;
  isAuditing: boolean;
  lang: Language;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  calibration,
  scannedCount,
  lastScannedTime,
  onAuditTrigger,
  isAuditing,
  lang,
}) => {
  const t = translations[lang];
  const globalAccuracy = calibration?.globalAccuracyTracker.overallAccuracy ?? 0.0;
  const totalAudits = calibration?.globalAccuracyTracker.totalPredictions ?? 0;
  const idxWeight = calibration?.idxWeight ?? 1.0;
  const cryptoWeight = calibration?.cryptoWeight ?? 1.0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {/* CARD 1: MODEL ACCURACY */}
      <div className="bg-gray-950 border border-gray-800 p-5 rounded-lg flex flex-col justify-between">
        <div className="flex items-center justify-between mb-3">
          <span className="text-gray-400 text-xs uppercase font-mono tracking-wider font-semibold">
            {t.globalAccuracy}
          </span>
          <Award className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <div className="text-2xl md:text-3xl font-display font-bold text-gray-100 mb-1">
            {(globalAccuracy * 100).toFixed(1)}%
          </div>
          <p className="text-gray-500 text-[11px] font-mono">
            {t.verifiedWalkForward.replace("{count}", totalAudits.toString())}
          </p>
        </div>
      </div>

      {/* CARD 2: IDX ACCURACY CALIBRATION */}
      <div className="bg-gray-950 border border-gray-800 p-5 rounded-lg flex flex-col justify-between">
        <div className="flex items-center justify-between mb-3">
          <span className="text-gray-400 text-xs uppercase font-mono tracking-wider font-semibold">
            {t.idxBias}
          </span>
          <Cpu className="w-4 h-4 text-cyan-400" />
        </div>
        <div>
          <div className="text-2xl md:text-3xl font-display font-medium text-cyan-400 mb-1">
            x{idxWeight.toFixed(3)}
          </div>
          <p className="text-gray-500 text-[11px] font-mono">
            {t.calibratedIdx}
          </p>
        </div>
      </div>

      {/* CARD 3: CRYPTO ACCURACY CALIBRATION */}
      <div className="bg-gray-950 border border-gray-800 p-5 rounded-lg flex flex-col justify-between">
        <div className="flex items-center justify-between mb-3">
          <span className="text-gray-400 text-xs uppercase font-mono tracking-wider font-semibold">
            {t.cryptoBias}
          </span>
          <Layers className="w-4 h-4 text-amber-500" />
        </div>
        <div>
          <div className="text-2xl md:text-3xl font-display font-medium text-amber-400 mb-1">
            x{cryptoWeight.toFixed(3)}
          </div>
          <p className="text-gray-500 text-[11px] font-mono">
            {t.calibratedCrypto}
          </p>
        </div>
      </div>

      {/* CARD 4: WALK-FORWARD TRIGGER AUDITS */}
      <div className="bg-gray-950 border border-emerald-500/20 shadow-lg shadow-emerald-950/20 p-5 rounded-lg flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-xs uppercase font-mono tracking-wider font-semibold">
            {t.adaptiveCalibration}
          </span>
          <ShieldAlert className="w-4 h-4 text-emerald-400 animate-pulse" />
        </div>
        <div>
          <button
            onClick={onAuditTrigger}
            disabled={isAuditing}
            className={`w-full py-2 px-3 text-xs font-mono font-medium rounded border flex items-center justify-center gap-2 transition-all ${
              isAuditing
                ? "bg-gray-900 border-gray-800 text-gray-500 cursor-not-allowed"
                : "bg-emerald-950/40 hover:bg-emerald-950/80 border-emerald-800 hover:border-emerald-600 text-emerald-300 active:scale-[0.98]"
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? "animate-spin" : ""}`} />
            {isAuditing ? t.recalibrating : t.auditButton}
          </button>
          <p className="text-gray-500 text-[10px] font-mono mt-2 text-center">
            {lastScannedTime 
              ? t.aggregatedScan.replace("{count}", scannedCount.toString()) 
              : t.requireScan}
          </p>
        </div>
      </div>
    </div>
  );
};
