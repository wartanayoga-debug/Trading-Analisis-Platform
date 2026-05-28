/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { ScannerAsset } from "../../types";

export class ExplainableAIEngine {
  private static instance: ExplainableAIEngine;
  private aiClient: GoogleGenAI | null = null;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): ExplainableAIEngine {
    if (!ExplainableAIEngine.instance) {
      ExplainableAIEngine.instance = new ExplainableAIEngine();
    }
    return ExplainableAIEngine.instance;
  }

  /**
   * Lazily loads GoogleGenAI client with fallback paths
   */
  private getAIClient(): GoogleGenAI | null {
    if (!this.isInitialized) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
        try {
          this.aiClient = new GoogleGenAI({
            apiKey,
            httpOptions: {
              headers: {
                "User-Agent": "aistudio-build",
              },
            },
          });
          console.log(
            "[ExplainableAIEngine] GoogleGenAI SDK initialized successfully.",
          );
        } catch (err) {
          console.error(
            "[ExplainableAIEngine] Failed core initialization:",
            err,
          );
          this.aiClient = null;
        }
      } else {
        console.warn(
          "[ExplainableAIEngine] GEMINI_API_KEY not configured. Enforcing math-grounded template briefs.",
        );
        this.aiClient = null;
      }
      this.isInitialized = true;
    }
    return this.aiClient;
  }

  /**
   * Translates raw mathematical parameters into a highly scannable human analysis brief
   */
  public async generateAssetBrief(
    asset: ScannerAsset,
    lang = "ID",
  ): Promise<string> {
    // High fidelity template fallback
    return this.generateDeterministicBriefTemplate(asset, lang);
  }

  /**
   * Deterministic grounding generator representing active quantitative structures
   */
  private generateDeterministicBriefTemplate(
    asset: ScannerAsset,
    lang = "ID",
  ): string {
    const isBull = asset.trendDirection === "BULLISH";

    if (lang === "ID") {
      const directionPhraseId = isBull
        ? `menunjukkan pemicu breakout berkecepatan tinggi di dekat resistansi Bollinger Bands, dikonfirmasi oleh metrik probabilitas sebesar ${(asset.probability * 100).toFixed(0)}%`
        : `mengindikasikan kelelahan tren dan tekanan jual, dipetakan di bawah model kelanjutan likuiditas rendah`;

      return (
        `Aset "${asset.ticker}" (${asset.name}) dikategorikan di bawah status "${asset.marketRegime}". ` +
        `Model ensemble machine learning kami memproyeksikan probabilitas arah sebesar ${(asset.probability * 100).toFixed(0)}% ` +
        `dengan peringkat kepercayaan terkalibrasi sebesar ${(asset.confidence * 100).toFixed(0)}%.\n\n` +
        `**Analisis Setup Kunci:**\n` +
        `- **Katalis:** Struktur harga ${directionPhraseId}.\n` +
        `- **Profil Risiko:** Indeks volatilitas berada di ${asset.volatilityScore}/100, didorong oleh batas ekspansi ATR. Skor kedalaman likuiditas tercatat di ${asset.liquidityScore}/100.\n` +
        `- **Zona Eksekusi:** Rentang masuk optimal ${asset.entryZone.min.toFixed(2)} - ${asset.entryZone.max.toFixed(2)}. Protective stop loss ditetapkan pada ${asset.stopLoss.toFixed(2)} dengan rasio risiko-terhadap-imbalan ${asset.rrRatio}.\n` +
        `- **Tingkat Pembatalan Tesis:** Penembusan struktural di bawah ${asset.invalidationLevel.toFixed(2)} membatalkan seluruh tesis perdagangan institusional ini, mewajibkan tindakan pengamanan modal segera.`
      );
    }

    const directionPhrase = isBull
      ? `exhibits substantial high-speed breakout triggers near Bollinger Bands resistance, confirmed by a probability metric of ${(asset.probability * 100).toFixed(0)}%`
      : `indicates trend fatigue and selling pressure, mapped under a low-liquidity continuation model`;

    return (
      `The asset "${asset.ticker}" (${asset.name}) is categorized under a "${asset.marketRegime}" stance. ` +
      `Our ensemble machine learning models project a directional probability of ${(asset.probability * 100).toFixed(0)}% ` +
      `with a calibrated confidence rating of ${(asset.confidence * 100).toFixed(0)}%.\n\n` +
      `**Key Setup Analysis:**\n` +
      `- **Catalyst:** The pricing structure ${directionPhrase}.\n` +
      `- **Risk Profile:** Volatility index sits at ${asset.volatilityScore}/100, driven by ATR expansion limits. Liquidity depth scoring is registered at ${asset.liquidityScore}/100.\n` +
      `- **Execution Zones:** Optimal entry spans ${asset.entryZone.min.toFixed(2)} - ${asset.entryZone.max.toFixed(2)}. Protective stop loss stands defined at ${asset.stopLoss.toFixed(2)} with a risk-to-reward ratio of ${asset.rrRatio}.\n` +
      `- **Thesis Invalidation Level:** A structural breakdown below ${asset.invalidationLevel.toFixed(2)} invalidates the institutional trading setup entirely, mandating immediate capital shield action.`
    );
  }
}
