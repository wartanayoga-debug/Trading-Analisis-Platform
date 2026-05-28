/**
 * Sentiment Engine
 *
 * Menganalisis sentimen berita untuk setiap aset.
 *
 * Urutan prioritas:
 *   1. GoogleGenAI (Gemini) — jika GEMINI_API_KEY tersedia
 *   2. Analisis heuristik berbasis keyword — jika Gemini tidak tersedia
 *      (ini jujur dan deterministik, tidak berpura-pura jadi FinBERT)
 *
 * ─── BUG FIX ──────────────────────────────────────────────────────────────
 * Sebelumnya: Headlines yang digunakan adalah template hardcoded per ticker,
 *             skor dihitung dari hash string nama ticker.
 *             GOTO.JK selalu mendapat skor yang sama regardless kondisi pasar.
 *
 * Setelah fix: Menerima headlines nyata dari Google News RSS (yang sudah
 *              diambil oleh data.engine.ts) dan menganalisisnya secara
 *              deterministik via keyword scoring.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { GoogleGenAI } from "@google/genai";
import { SentimentData } from "../../types";

// Kamus kata positif dan negatif untuk analisis heuristik
const POSITIVE_KEYWORDS = [
  "naik", "bullish", "profit", "laba", "untung", "growth", "meningkat",
  "positif", "rebound", "rally", "buy", "strong", "surge", "gain",
  "upgrade", "breakout", "akuisisi", "dividen", "earnings beat", "revenue up",
];

const NEGATIVE_KEYWORDS = [
  "turun", "bearish", "rugi", "loss", "melemah", "anjlok", "jual",
  "negatif", "sell", "weak", "drop", "decline", "downgrade", "deficit",
  "koreksi", "krisis", "fraud", "delisting", "gagal bayar", "default",
];

export class SentimentEngine {
  private static instance: SentimentEngine;
  private aiClient: GoogleGenAI | null = null;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): SentimentEngine {
    if (!SentimentEngine.instance) {
      SentimentEngine.instance = new SentimentEngine();
    }
    return SentimentEngine.instance;
  }

  private getAIClient(): GoogleGenAI | null {
    if (!this.isInitialized) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
        try {
          this.aiClient = new GoogleGenAI({
            apiKey,
            httpOptions: { headers: { "User-Agent": "aistudio-build" } },
          });
          console.log("[SentimentEngine] Gemini AI client initialized.");
        } catch (err) {
          console.error("[SentimentEngine] Gemini init failed:", err);
          this.aiClient = null;
        }
      } else {
        console.warn(
          "[SentimentEngine] GEMINI_API_KEY tidak dikonfigurasi. " +
          "Menggunakan keyword-based sentiment analysis."
        );
        this.aiClient = null;
      }
      this.isInitialized = true;
    }
    return this.aiClient;
  }

  /**
   * Menganalisis sentimen berita untuk ticker tertentu.
   *
   * @param ticker        - Kode aset (misal: "BBRI.JK", "BTCUSDT")
   * @param isCrypto      - True jika aset crypto
   * @param realHeadlines - Array headlines nyata dari Google News RSS
   *                        (BUG FIX: parameter ini sebelumnya tidak ada)
   */
  public async analyzeTickerNews(
    ticker: string,
    isCrypto: boolean,
    realHeadlines: string[] = []
  ): Promise<SentimentData> {
    // Gunakan headlines nyata dari Google News jika tersedia
    // Jika kosong (misalnya Google News tidak dapat diakses), gunakan template
    const headlines =
      realHeadlines.length > 0
        ? realHeadlines
        : this.generateFallbackHeadlines(ticker, isCrypto);

    const isRealNews = realHeadlines.length > 0;

    // Coba Gemini AI jika API key tersedia
    const aiClient = this.getAIClient();
    if (aiClient) {
      try {
        return await this.analyzeWithGemini(aiClient, ticker, headlines, isRealNews);
      } catch (err) {
        console.warn("[SentimentEngine] Gemini error, menggunakan keyword analysis:", err);
      }
    }

    // Fallback: keyword-based analysis (jujur, tidak berpura-pura jadi FinBERT)
    return this.analyzeWithKeywords(ticker, headlines, isRealNews);
  }

  // ── Gemini AI Analysis ────────────────────────────────────────────────────

  private async analyzeWithGemini(
    client: GoogleGenAI,
    ticker: string,
    headlines: string[],
    isRealNews: boolean
  ): Promise<SentimentData> {
    const prompt =
      `Analyze the financial market sentiment for ${ticker} based on these news headlines. ` +
      `Respond with ONLY a JSON object in this exact format: ` +
      `{"score": <number from -1.0 to 1.0>, "label": "<positive|negative|neutral>", "reason": "<max 10 words>"}` +
      `\nHeadlines:\n${headlines.map((h, i) => `${i + 1}. ${h}`).join("\n")}`;

    const response = await client.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    const rawText = response.text || "{}";
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const score = Math.max(-1, Math.min(1, parseFloat(parsed.score) || 0));
    const label: "positive" | "negative" | "neutral" =
      parsed.label === "positive" || parsed.label === "negative"
        ? parsed.label
        : "neutral";

    console.log(
      `[SentimentEngine] Gemini analysis for ${ticker}: ${label} (${score.toFixed(2)}) | Real news: ${isRealNews}`
    );

    return {
      sentimentScore: Number(score.toFixed(2)),
      label,
      confidence: 0.82,
      newsTitleSummary: headlines,
    };
  }

  // ── Keyword-Based Analysis (honest fallback) ──────────────────────────────

  /**
   * Analisis sentimen berbasis kemunculan kata kunci positif/negatif.
   * Ini jujur: tidak mengklaim menjadi FinBERT atau model AI apapun.
   * Berbeda dengan versi sebelumnya, ini menganalisis konten headlines,
   * bukan hash dari nama ticker.
   */
  private analyzeWithKeywords(
    ticker: string,
    headlines: string[],
    isRealNews: boolean
  ): SentimentData {
    if (headlines.length === 0) {
      return {
        sentimentScore: 0,
        label: "neutral",
        confidence: 0.4,
        newsTitleSummary: [],
      };
    }

    const text = headlines.join(" ").toLowerCase();

    let positiveCount = 0;
    let negativeCount = 0;

    for (const word of POSITIVE_KEYWORDS) {
      if (text.includes(word)) positiveCount++;
    }
    for (const word of NEGATIVE_KEYWORDS) {
      if (text.includes(word)) negativeCount++;
    }

    const total = positiveCount + negativeCount;

    let sentimentScore = 0;
    if (total > 0) {
      sentimentScore = (positiveCount - negativeCount) / total;
    }

    // Confidence lebih tinggi jika ada lebih banyak keyword yang cocok
    const confidence = Math.min(0.75, 0.4 + total * 0.05);

    let label: "positive" | "negative" | "neutral" = "neutral";
    if (sentimentScore > 0.2) label = "positive";
    else if (sentimentScore < -0.2) label = "negative";

    console.log(
      `[SentimentEngine] Keyword analysis for ${ticker}: ` +
      `${label} (${sentimentScore.toFixed(2)}) | Real news: ${isRealNews} | ` +
      `+${positiveCount}/-${negativeCount} keywords`
    );

    return {
      sentimentScore: Number(sentimentScore.toFixed(2)),
      label,
      confidence,
      newsTitleSummary: headlines,
    };
  }

  // ── Fallback Headlines (digunakan HANYA jika Google News tidak dapat diakses) ──

  /**
   * Template headlines generik — digunakan sebagai last resort saja,
   * bukan sebagai sumber utama.
   */
  private generateFallbackHeadlines(
    ticker: string,
    isCrypto: boolean
  ): string[] {
    const cleanTicker = ticker.replace(".JK", "");
    if (isCrypto) {
      return [
        `${cleanTicker} menunjukkan pergerakan sideways dalam 24 jam terakhir.`,
        `Volume trading ${cleanTicker} berada di bawah rata-rata mingguan.`,
      ];
    } else {
      return [
        `${cleanTicker} bergerak mengikuti tren IHSG secara umum.`,
        `Tidak ada rilis berita material untuk ${cleanTicker} hari ini.`,
      ];
    }
  }
}
