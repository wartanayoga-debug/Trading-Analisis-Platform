/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from "express";
import { LocalDatabase } from "../utils/db";
import { MarketScannerEngine } from "../engines/scanner.engine";
import { SentimentEngine } from "../engines/sentiment.engine";
import { ExplainableAIEngine } from "../engines/explain.engine";
import { MemoryLearningEngine } from "../engines/memory.engine";
import { MarketDataEngine } from "../engines/data.engine";
import { FeatureEngineeringEngine } from "../engines/feature.engine";
import { MLPredictionEngine } from "../engines/ml.engine";
import { RiskEngine } from "../engines/risk.engine";
import { RegimeAwareAllocator } from "../engines/allocation_engine";
import { PortfolioIntelligence } from "../engines/portfolio_intelligence";
import { EventBus } from "../engines/event_bus"; // Phase 4 Event Bus

const router = Router();
const db = LocalDatabase.getInstance();
const scannerEngine = MarketScannerEngine.getInstance();
const sentimentEngine = SentimentEngine.getInstance();
const explainEngine = ExplainableAIEngine.getInstance();
const memoryEngine = MemoryLearningEngine.getInstance();
const dataEngine = MarketDataEngine.getInstance();
const featureEngine = FeatureEngineeringEngine.getInstance();
const mlEngine = MLPredictionEngine.getInstance();
const riskEngine = RiskEngine.getInstance();

// COMPREHENSIVE ASSET REGISTRY
// IDX tickers use Yahoo Finance standard '.JK' suffix.
// Crypto tickers use Binance standard 'USDT' pairs.
const COMPREHENSIVE_ASSETS = [
  // Indonesian Stock Market (IDX) - 200 POPULAR STOCKS
  {
    ticker: "BBRI.JK",
    name: "Bank Rakyat Indonesia (Persero) Tbk",
    assetClass: "IDX" as const,
    sector: "Financials",
  },
  {
    ticker: "BBCA.JK",
    name: "Bank Central Asia Tbk",
    assetClass: "IDX" as const,
    sector: "Financials",
  },
  {
    ticker: "BMRI.JK",
    name: "Bank Mandiri (Persero) Tbk",
    assetClass: "IDX" as const,
    sector: "Financials",
  },
  {
    ticker: "BBNI.JK",
    name: "Bank Negara Indonesia (Persero) Tbk",
    assetClass: "IDX" as const,
    sector: "Financials",
  },
  {
    ticker: "TLKM.JK",
    name: "Telkom Indonesia (Persero) Tbk",
    assetClass: "IDX" as const,
    sector: "Infrastructure & Comm",
  },
  {
    ticker: "ASII.JK",
    name: "Astra International Tbk",
    assetClass: "IDX" as const,
    sector: "Industrials",
  },
  {
    ticker: "UNVR.JK",
    name: "Unilever Indonesia Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "GOTO.JK",
    name: "GoTo Gojek Tokopedia Tbk",
    assetClass: "IDX" as const,
    sector: "Technology",
  },
  {
    ticker: "ADRO.JK",
    name: "Adaro Energy Indonesia Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "PGAS.JK",
    name: "Perusahaan Gas Negara Tbk",
    assetClass: "IDX" as const,
    sector: "Utilities",
  },
  {
    ticker: "ANTM.JK",
    name: "Aneka Tambang Tbk",
    assetClass: "IDX" as const,
    sector: "Basic Materials",
  },
  {
    ticker: "PTBA.JK",
    name: "Bukit Asam Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "KLBF.JK",
    name: "Kalbe Farma Tbk",
    assetClass: "IDX" as const,
    sector: "Healthcare",
  },
  {
    ticker: "ICBP.JK",
    name: "Indofood CBP Sukses Makmur Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "INDF.JK",
    name: "Indofood Sukses Makmur Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "BRIS.JK",
    name: "Bank Syariah Indonesia Tbk",
    assetClass: "IDX" as const,
    sector: "Financials",
  },
  {
    ticker: "BUMI.JK",
    name: "Bumi Resources Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "MEDC.JK",
    name: "Medco Energi Internasional Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "UNTR.JK",
    name: "United Tractors Tbk",
    assetClass: "IDX" as const,
    sector: "Industrials",
  },
  {
    ticker: "AMRT.JK",
    name: "Sumber Alfaria Trijaya Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Cyclical",
  },
  {
    ticker: "BRPT.JK",
    name: "Barito Pacific Tbk",
    assetClass: "IDX" as const,
    sector: "Basic Materials",
  },
  {
    ticker: "TPIA.JK",
    name: "Chandra Asri Pacific Tbk",
    assetClass: "IDX" as const,
    sector: "Basic Materials",
  },
  {
    ticker: "BYAN.JK",
    name: "Bayan Resources Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "MDKA.JK",
    name: "Merdeka Copper Gold Tbk",
    assetClass: "IDX" as const,
    sector: "Basic Materials",
  },
  {
    ticker: "ITMG.JK",
    name: "Indo Tambangraya Megah Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "HRUM.JK",
    name: "Harum Energy Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "INCO.JK",
    name: "Vale Indonesia Tbk",
    assetClass: "IDX" as const,
    sector: "Basic Materials",
  },
  {
    ticker: "DOID.JK",
    name: "Delta Dunia Makmur Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "INDY.JK",
    name: "Indika Energy Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "CPIN.JK",
    name: "Charoen Pokphand Indonesia Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "JPFA.JK",
    name: "Japfa Comfeed Indonesia Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "EXCL.JK",
    name: "XL Axiata Tbk",
    assetClass: "IDX" as const,
    sector: "Infrastructure & Comm",
  },
  {
    ticker: "ISAT.JK",
    name: "Indosat Tbk",
    assetClass: "IDX" as const,
    sector: "Infrastructure & Comm",
  },
  {
    ticker: "SMGR.JK",
    name: "Semen Indonesia (Persero) Tbk",
    assetClass: "IDX" as const,
    sector: "Basic Materials",
  },
  {
    ticker: "INTP.JK",
    name: "Indocement Tunggal Prakarsa Tbk",
    assetClass: "IDX" as const,
    sector: "Basic Materials",
  },
  {
    ticker: "JSMR.JK",
    name: "Jasa Marga (Persero) Tbk",
    assetClass: "IDX" as const,
    sector: "Infrastructure",
  },
  {
    ticker: "MYOR.JK",
    name: "Mayora Indah Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "HMSP.JK",
    name: "HM Sampoerna Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "GGRM.JK",
    name: "Gudang Garam Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "ACES.JK",
    name: "Aspirasi Hidup Indonesia Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Cyclical",
  },
  {
    ticker: "ERAA.JK",
    name: "Erajaya Swasembada Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Cyclical",
  },
  {
    ticker: "CTRA.JK",
    name: "Ciputra Development Tbk",
    assetClass: "IDX" as const,
    sector: "Real Estate",
  },
  {
    ticker: "BSDE.JK",
    name: "Bumi Serpong Damai Tbk",
    assetClass: "IDX" as const,
    sector: "Real Estate",
  },
  {
    ticker: "PWON.JK",
    name: "Pakuwon Jati Tbk",
    assetClass: "IDX" as const,
    sector: "Real Estate",
  },
  {
    ticker: "SMRA.JK",
    name: "Summarecon Agung Tbk",
    assetClass: "IDX" as const,
    sector: "Real Estate",
  },
  {
    ticker: "ASRI.JK",
    name: "Alam Sutera Realty Tbk",
    assetClass: "IDX" as const,
    sector: "Real Estate",
  },
  {
    ticker: "ADMR.JK",
    name: "Adaro Minerals Indonesia Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "ARTO.JK",
    name: "Bank Jago Tbk",
    assetClass: "IDX" as const,
    sector: "Financials",
  },
  {
    ticker: "BBTN.JK",
    name: "Bank Tabungan Negara (Persero) Tbk",
    assetClass: "IDX" as const,
    sector: "Financials",
  },
  {
    ticker: "BDMN.JK",
    name: "Bank Danamon Indonesia Tbk",
    assetClass: "IDX" as const,
    sector: "Financials",
  },
  {
    ticker: "AKRA.JK",
    name: "AKR Corporindo Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "HEAL.JK",
    name: "Medikaloka Hermina Tbk",
    assetClass: "IDX" as const,
    sector: "Healthcare",
  },
  {
    ticker: "MIKA.JK",
    name: "Mitra Keluarga Karyasehat Tbk",
    assetClass: "IDX" as const,
    sector: "Healthcare",
  },
  {
    ticker: "SILO.JK",
    name: "Siloam International Hospitals Tbk",
    assetClass: "IDX" as const,
    sector: "Healthcare",
  },
  {
    ticker: "TINS.JK",
    name: "Timah Tbk",
    assetClass: "IDX" as const,
    sector: "Basic Materials",
  },
  {
    ticker: "WIKA.JK",
    name: "Wijaya Karya (Persero) Tbk",
    assetClass: "IDX" as const,
    sector: "Construction",
  },
  {
    ticker: "PTPP.JK",
    name: "PP (Persero) Tbk",
    assetClass: "IDX" as const,
    sector: "Construction",
  },
  {
    ticker: "ADHI.JK",
    name: "Adhi Karya (Persero) Tbk",
    assetClass: "IDX" as const,
    sector: "Construction",
  },
  {
    ticker: "SSIA.JK",
    name: "Surya Semesta Internusa Tbk",
    assetClass: "IDX" as const,
    sector: "Real Estate",
  },
  {
    ticker: "KIJA.JK",
    name: "Kawasan Industri Jababeka Tbk",
    assetClass: "IDX" as const,
    sector: "Real Estate",
  },
  {
    ticker: "DMAS.JK",
    name: "Puradelta Lestari Tbk",
    assetClass: "IDX" as const,
    sector: "Real Estate",
  },
  {
    ticker: "LPCK.JK",
    name: "Lippo Cikarang Tbk",
    assetClass: "IDX" as const,
    sector: "Real Estate",
  },
  {
    ticker: "LPKR.JK",
    name: "Lippo Karawaci Tbk",
    assetClass: "IDX" as const,
    sector: "Real Estate",
  },
  {
    ticker: "MDLN.JK",
    name: "Modernland Realty Tbk",
    assetClass: "IDX" as const,
    sector: "Real Estate",
  },
  {
    ticker: "SMDM.JK",
    name: "Suryamas Dutamakmur Tbk",
    assetClass: "IDX" as const,
    sector: "Real Estate",
  },
  {
    ticker: "JRPT.JK",
    name: "Jaya Real Property Tbk",
    assetClass: "IDX" as const,
    sector: "Real Estate",
  },
  {
    ticker: "DILD.JK",
    name: "Intiland Development Tbk",
    assetClass: "IDX" as const,
    sector: "Real Estate",
  },
  {
    ticker: "BKSL.JK",
    name: "Sentul City Tbk",
    assetClass: "IDX" as const,
    sector: "Real Estate",
  },
  {
    ticker: "APLN.JK",
    name: "Agung Podomoro Land Tbk",
    assetClass: "IDX" as const,
    sector: "Real Estate",
  },
  {
    ticker: "ELTY.JK",
    name: "Bakrieland Development Tbk",
    assetClass: "IDX" as const,
    sector: "Real Estate",
  },
  {
    ticker: "BEST.JK",
    name: "Bekasi Fajar Industrial Estate Tbk",
    assetClass: "IDX" as const,
    sector: "Real Estate",
  },
  {
    ticker: "MAIN.JK",
    name: "Malindo Feedmill Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "SIPD.JK",
    name: "Sreeya Sewu Indonesia Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "WMPP.JK",
    name: "Widodo Makmur Perkasa Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "BEEF.JK",
    name: "Estika Tata Tiara Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "LSIP.JK",
    name: "PP London Sumatra Indonesia Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "AALI.JK",
    name: "Astra Agro Lestari Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "SIMP.JK",
    name: "Salim Ivomas Pratama Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "DSNG.JK",
    name: "Dharma Satya Nusantara Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "SSMS.JK",
    name: "Sawit Sumbermas Sarana Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "TBLA.JK",
    name: "Tunas Baru Lampung Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "BWPT.JK",
    name: "Eagle High Plantations Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "ANDI.JK",
    name: "Andira Agro Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "TAPG.JK",
    name: "Triputra Agro Persada Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "PALM.JK",
    name: "Provident Investasi Bersama Tbk",
    assetClass: "IDX" as const,
    sector: "Financials",
  },
  {
    ticker: "SMAR.JK",
    name: "Smart Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "TOWR.JK",
    name: "Sarana Menara Nusantara Tbk",
    assetClass: "IDX" as const,
    sector: "Infrastructure",
  },
  {
    ticker: "LEAD.JK",
    name: "Logindo Samudramakmur Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "BULL.JK",
    name: "Buana Lintas Lautan Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "PSSI.JK",
    name: "Transcoal Pacific Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "SMDR.JK",
    name: "Samudera Indonesia Tbk",
    assetClass: "IDX" as const,
    sector: "Transportation",
  },
  {
    ticker: "TMAS.JK",
    name: "Temas Tbk",
    assetClass: "IDX" as const,
    sector: "Transportation",
  },
  {
    ticker: "WINS.JK",
    name: "Wintermar Offshore Marine Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "SOCI.JK",
    name: "Soechi Lines Tbk",
    assetClass: "IDX" as const,
    sector: "Transportation",
  },
  {
    ticker: "MBSS.JK",
    name: "Mitrabahtera Segara Sejati Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "HAIS.JK",
    name: "Hasnur Internasional Shipping Tbk",
    assetClass: "IDX" as const,
    sector: "Transportation",
  },
  {
    ticker: "TPMA.JK",
    name: "Trans Power Marine Tbk",
    assetClass: "IDX" as const,
    sector: "Transportation",
  },
  {
    ticker: "TCPI.JK",
    name: "Transcoal Pacific Tbk",
    assetClass: "IDX" as const,
    sector: "Transportation",
  },
  {
    ticker: "HELI.JK",
    name: "Jaya Trishindo Tbk",
    assetClass: "IDX" as const,
    sector: "Transportation",
  },
  {
    ticker: "IPCC.JK",
    name: "Indonesia Kendaraan Terminal Tbk",
    assetClass: "IDX" as const,
    sector: "Transportation",
  },
  {
    ticker: "PORT.JK",
    name: "Nusantara Pelabuhan Handal Tbk",
    assetClass: "IDX" as const,
    sector: "Transportation",
  },
  {
    ticker: "ASSA.JK",
    name: "Adi Sarana Armada Tbk",
    assetClass: "IDX" as const,
    sector: "Transportation",
  },
  {
    ticker: "LPIN.JK",
    name: "Multi Prima Sejahtera Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Cyclical",
  },
  {
    ticker: "WEHA.JK",
    name: "Weha Transportasi Indonesia Tbk",
    assetClass: "IDX" as const,
    sector: "Transportation",
  },
  {
    ticker: "TRJA.JK",
    name: "Transkon Jaya Tbk",
    assetClass: "IDX" as const,
    sector: "Transportation",
  },
  {
    ticker: "BIRD.JK",
    name: "Blue Bird Tbk",
    assetClass: "IDX" as const,
    sector: "Transportation",
  },
  {
    ticker: "BLUE.JK",
    name: "Cinta Raja Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "TAXI.JK",
    name: "Express Transindo Utama Tbk",
    assetClass: "IDX" as const,
    sector: "Transportation",
  },
  {
    ticker: "AUTO.JK",
    name: "Astra Otoparts Tbk",
    assetClass: "IDX" as const,
    sector: "Industrials",
  },
  {
    ticker: "JAYA.JK",
    name: "Armada Berjaya Trans Tbk",
    assetClass: "IDX" as const,
    sector: "Transportation",
  },
  {
    ticker: "NELY.JK",
    name: "Pelayaran Nelly Dwi Putri Tbk",
    assetClass: "IDX" as const,
    sector: "Transportation",
  },
  {
    ticker: "RIGS.JK",
    name: "Rig Tenders Indonesia Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "DEAL.JK",
    name: "Dewata Freightinternational Tbk",
    assetClass: "IDX" as const,
    sector: "Transportation",
  },
  {
    ticker: "SDMU.JK",
    name: "Sidomulyo Selaras Tbk",
    assetClass: "IDX" as const,
    sector: "Transportation",
  },
  {
    ticker: "KPIG.JK",
    name: "MNC Land Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Cyclical",
  },
  {
    ticker: "MNCN.JK",
    name: "Media Nusantara Citra Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Cyclical",
  },
  {
    ticker: "SCMA.JK",
    name: "Surya Citra Media Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Cyclical",
  },
  {
    ticker: "MSKY.JK",
    name: "MNC Sky Vision Tbk",
    assetClass: "IDX" as const,
    sector: "Technology",
  },
  {
    ticker: "LINK.JK",
    name: "Link Net Tbk",
    assetClass: "IDX" as const,
    sector: "Infrastructure",
  },
  {
    ticker: "EMTK.JK",
    name: "Elang Mahkota Teknologi Tbk",
    assetClass: "IDX" as const,
    sector: "Technology",
  },
  {
    ticker: "MCAS.JK",
    name: "M Cash Integrasi Tbk",
    assetClass: "IDX" as const,
    sector: "Technology",
  },
  {
    ticker: "TFAS.JK",
    name: "Telefast Indonesia Tbk",
    assetClass: "IDX" as const,
    sector: "Technology",
  },
  {
    ticker: "NFCX.JK",
    name: "NFC Indonesia Tbk",
    assetClass: "IDX" as const,
    sector: "Technology",
  },
  {
    ticker: "DIVA.JK",
    name: "Diva Cashback Tbk",
    assetClass: "IDX" as const,
    sector: "Technology",
  },
  {
    ticker: "CASH.JK",
    name: "Cashlez Worldwide Indonesia Tbk",
    assetClass: "IDX" as const,
    sector: "Technology",
  },
  {
    ticker: "KIOS.JK",
    name: "Kioson Komersial Indonesia Tbk",
    assetClass: "IDX" as const,
    sector: "Technology",
  },
  {
    ticker: "BUKA.JK",
    name: "Bukalapak.com Tbk",
    assetClass: "IDX" as const,
    sector: "Technology",
  },
  {
    ticker: "BELI.JK",
    name: "Global Digital Niaga Tbk",
    assetClass: "IDX" as const,
    sector: "Technology",
  },
  {
    ticker: "BLTZ.JK",
    name: "Graha Layar Prima Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Cyclical",
  },
  {
    ticker: "VRNA.JK",
    name: "Verena Multi Finance Tbk",
    assetClass: "IDX" as const,
    sector: "Financials",
  },
  {
    ticker: "ADMF.JK",
    name: "Adira Dinamika Multi Finance Tbk",
    assetClass: "IDX" as const,
    sector: "Financials",
  },
  {
    ticker: "CFIN.JK",
    name: "Clipan Finance Indonesia Tbk",
    assetClass: "IDX" as const,
    sector: "Financials",
  },
  {
    ticker: "BBLD.JK",
    name: "Buana Finance Tbk",
    assetClass: "IDX" as const,
    sector: "Financials",
  },
  {
    ticker: "BPTR.JK",
    name: "Batavia Prosperindo Trans Tbk",
    assetClass: "IDX" as const,
    sector: "Transportation",
  },
  {
    ticker: "WOMF.JK",
    name: "Wahana Ottomitra Multiartha Tbk",
    assetClass: "IDX" as const,
    sector: "Financials",
  },
  {
    ticker: "BJBR.JK",
    name: "Bank BJB Tbk",
    assetClass: "IDX" as const,
    sector: "Financials",
  },
  {
    ticker: "TIFA.JK",
    name: "Tifa Finance Tbk",
    assetClass: "IDX" as const,
    sector: "Financials",
  },
  {
    ticker: "HDFA.JK",
    name: "Radana Bhaskara Finance Tbk",
    assetClass: "IDX" as const,
    sector: "Financials",
  },
  {
    ticker: "TRIM.JK",
    name: "Trimegah Sekuritas Indonesia Tbk",
    assetClass: "IDX" as const,
    sector: "Financials",
  },
  {
    ticker: "MBAP.JK",
    name: "Mitrabara Adiperdana Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "APEX.JK",
    name: "Apexindo Pratama Duta Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "ELSA.JK",
    name: "Elnusa Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "RMKO.JK",
    name: "RMK Energy Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "COAL.JK",
    name: "Black Diamond Resources Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "DEWA.JK",
    name: "Darma Henwa Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "ENRG.JK",
    name: "Energi Mega Persada Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "KKGI.JK",
    name: "Resource Alam Indonesia Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "SMMT.JK",
    name: "Golden Eagle Energy Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "FIRE.JK",
    name: "Alfa Energi Investama Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "ARII.JK",
    name: "Atlas Resources Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "BOSS.JK",
    name: "Borneo Olah Sarana Sukses Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "TOBA.JK",
    name: "TBS Energi Utama Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "INDO.JK",
    name: "Indo Komoditi Korpora Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Cyclical",
  },
  {
    ticker: "GTBO.JK",
    name: "Garda Tujuh Buana Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "MYOH.JK",
    name: "Samindo Resources Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "PTRO.JK",
    name: "Petrosea Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "TEBE.JK",
    name: "Dana Brata Luhur Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "SGER.JK",
    name: "Sumber Global Energy Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "BIPI.JK",
    name: "Astrindo Nusantara Infrastruktur Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "MITI.JK",
    name: "Mitra Investindo Tbk",
    assetClass: "IDX" as const,
    sector: "Energy",
  },
  {
    ticker: "SURE.JK",
    name: "Super Energy Tbk",
    assetClass: "IDX" as const,
    sector: "Utilities",
  },
  {
    ticker: "BBRM.JK",
    name: "Pelayaran Nasional Bina Buana Raya Tbk",
    assetClass: "IDX" as const,
    sector: "Transportation",
  },
  {
    ticker: "TAMU.JK",
    name: "Pelayaran Nasional Tanjungriau Tbk",
    assetClass: "IDX" as const,
    sector: "Transportation",
  },
  {
    ticker: "CANI.JK",
    name: "Capitol Nusantara Indonesia Tbk",
    assetClass: "IDX" as const,
    sector: "Transportation",
  },
  {
    ticker: "SHIP.JK",
    name: "Sinar Mas Multiartha Tbk",
    assetClass: "IDX" as const,
    sector: "Financials",
  },
  {
    ticker: "PBRX.JK",
    name: "Pan Brothers Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Cyclical",
  },
  {
    ticker: "BELL.JK",
    name: "Trisula Textile Industries Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Cyclical",
  },
  {
    ticker: "TRIS.JK",
    name: "Trisula International Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Cyclical",
  },
  {
    ticker: "MYTX.JK",
    name: "Asia Pacific Investama Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Cyclical",
  },
  {
    ticker: "SRIL.JK",
    name: "Sri Rejeki Isman Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Cyclical",
  },
  {
    ticker: "ERTX.JK",
    name: "Eratex Djaja Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Cyclical",
  },
  {
    ticker: "POLY.JK",
    name: "Asia Pacific Fibers Tbk",
    assetClass: "IDX" as const,
    sector: "Basic Materials",
  },
  {
    ticker: "HDTX.JK",
    name: "Panasia Indo Resources Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Cyclical",
  },
  {
    ticker: "ADES.JK",
    name: "Akasha Wira International Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "ALTO.JK",
    name: "Tri Banyan Tirta Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "DLTA.JK",
    name: "Delta Djakarta Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "MLBI.JK",
    name: "Multi Bintang Indonesia Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "ROTI.JK",
    name: "Nippon Indosari Corpindo Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "AISA.JK",
    name: "FKS Food Sejahtera Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "CAMP.JK",
    name: "Campina Ice Cream Industry Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "CLEO.JK",
    name: "Sariguna Primatirta Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "HOKI.JK",
    name: "Buyung Poetra Sembada Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Non-Cyclical",
  },
  {
    ticker: "PCAR.JK",
    name: "Prima Alloy Steel Universal Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Cyclical",
  },
  {
    ticker: "WOOD.JK",
    name: "Integra Indocabinet Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Cyclical",
  },
  {
    ticker: "BUVA.JK",
    name: "Bukit Uluwatu Villa Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Cyclical",
  },
  {
    ticker: "FAST.JK",
    name: "Fast Food Indonesia Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Cyclical",
  },
  {
    ticker: "MAPA.JK",
    name: "Map Active Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Cyclical",
  },
  {
    ticker: "MAPI.JK",
    name: "Mitra Adiperdana Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Cyclical",
  },
  {
    ticker: "MAPB.JK",
    name: "Map Boga Adiperdana Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Cyclical",
  },
  {
    ticker: "RALS.JK",
    name: "Ramayana Lestari Sentosa Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Cyclical",
  },
  {
    ticker: "LPPF.JK",
    name: "Matahari Department Store Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Cyclical",
  },
  {
    ticker: "MPPA.JK",
    name: "Matahari Putra Prima Tbk",
    assetClass: "IDX" as const,
    sector: "Consumer Cyclical",
  },
  {
    ticker: "INAF.JK",
    name: "Indofarma Tbk",
    assetClass: "IDX" as const,
    sector: "Healthcare",
  },
  {
    ticker: "KAEF.JK",
    name: "Kimia Farma Tbk",
    assetClass: "IDX" as const,
    sector: "Healthcare",
  },
  {
    ticker: "PYFA.JK",
    name: "Pyridam Farma Tbk",
    assetClass: "IDX" as const,
    sector: "Healthcare",
  },
  {
    ticker: "MERK.JK",
    name: "Merck Tbk",
    assetClass: "IDX" as const,
    sector: "Healthcare",
  },
  {
    ticker: "SIDO.JK",
    name: "Industri Jamu Dan Farmasi Sido Muncul Tbk",
    assetClass: "IDX" as const,
    sector: "Healthcare",
  },
  {
    ticker: "TSPC.JK",
    name: "Tempo Scan Pacific Tbk",
    assetClass: "IDX" as const,
    sector: "Healthcare",
  },
  {
    ticker: "PEHA.JK",
    name: "Phapros Tbk",
    assetClass: "IDX" as const,
    sector: "Healthcare",
  },
  {
    ticker: "PRDA.JK",
    name: "Prodia Widyahusada Tbk",
    assetClass: "IDX" as const,
    sector: "Healthcare",
  },

  // Cybersecurity / Cryptocurrency Market (100 POPULAR COINS)
  {
    ticker: "BTCUSDT",
    name: "Bitcoin / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "L1 Cryptocurrency",
  },
  {
    ticker: "ETHUSDT",
    name: "Ethereum / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "L1 Platform",
  },
  {
    ticker: "BNBUSDT",
    name: "BNB / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Exchange Utility",
  },
  {
    ticker: "SOLUSDT",
    name: "Solana / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "High Speed L1",
  },
  {
    ticker: "XRPUSDT",
    name: "Ripple / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Settlement Platform",
  },
  {
    ticker: "ADAUSDT",
    name: "Cardano / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "L1 Platform",
  },
  {
    ticker: "DOGEUSDT",
    name: "Dogecoin / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Meme Cryptosphere",
  },
  {
    ticker: "SHIBUSDT",
    name: "Shiba Inu / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Meme Cryptosphere",
  },
  {
    ticker: "AVAXUSDT",
    name: "Avalanche / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "L1 Platform",
  },
  {
    ticker: "DOTUSDT",
    name: "Polkadot / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Interoperability",
  },
  {
    ticker: "LINKUSDT",
    name: "Chainlink / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Decentralized Oracles",
  },
  {
    ticker: "NEARUSDT",
    name: "NEAR Protocol / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Cloud Platform",
  },
  {
    ticker: "UNIUSDT",
    name: "Uniswap / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "DeFi Governance",
  },
  {
    ticker: "LTCUSDT",
    name: "Litecoin / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Payments Crypto",
  },
  {
    ticker: "XLMUSDT",
    name: "Stellar Lumens / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Payments Network",
  },
  {
    ticker: "ATOMUSDT",
    name: "Cosmos / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Interoperability",
  },
  {
    ticker: "ETCUSDT",
    name: "Ethereum Classic / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "L1 Platform",
  },
  {
    ticker: "XMRUSDT",
    name: "Monero / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Privacy Currency",
  },
  {
    ticker: "APTUSDT",
    name: "Aptos / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Move L1 Platform",
  },
  {
    ticker: "HBARUSDT",
    name: "Hedera / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Enterprise Ledger",
  },
  {
    ticker: "OPUSDT",
    name: "Optimism / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Layer 2 Rollup",
  },
  {
    ticker: "ARBUSDT",
    name: "Arbitrum / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Layer 2 Rollup",
  },
  {
    ticker: "ICPUSDT",
    name: "Internet Computer / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Decentralized Cloud Computing",
  },
  {
    ticker: "SUIUSDT",
    name: "Sui / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Move L1 Platform",
  },
  {
    ticker: "RENDERUSDT",
    name: "Render Token / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "DePIN Graphics",
  },
  {
    ticker: "FILUSDT",
    name: "Filecoin / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "DePIN Storage",
  },
  {
    ticker: "LDOUSDT",
    name: "Lido DAO / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Liquid Staking",
  },
  {
    ticker: "TAOUSDT",
    name: "Bittensor / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "DePIN AI Network",
  },
  {
    ticker: "FETUSDT",
    name: "Artificial Superintelligence Alliance / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "AI Agents",
  },
  {
    ticker: "STXUSDT",
    name: "Stacks / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Bitcoin Layer 2",
  },
  {
    ticker: "MKRUSDT",
    name: "Maker / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Stablecoin Engine",
  },
  {
    ticker: "AAVEUSDT",
    name: "Aave / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Lending Market",
  },
  {
    ticker: "GALAUSDT",
    name: "Gala / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "GameFi Platform",
  },
  {
    ticker: "FTMUSDT",
    name: "Fantom / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "High Speed L1",
  },
  {
    ticker: "GRTUSDT",
    name: "The Graph / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Indexing Protocol",
  },
  {
    ticker: "IMXUSDT",
    name: "Immutable / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "GameFi Layer 2",
  },
  {
    ticker: "FLOKIUSDT",
    name: "Floki / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Meme Cryptosphere",
  },
  {
    ticker: "PEPEUSDT",
    name: "Pepe / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Meme Cryptosphere",
  },
  {
    ticker: "BONKUSDT",
    name: "Bonk / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Meme Cryptosphere",
  },
  {
    ticker: "WIFUSDT",
    name: "dogwifhat / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Meme Cryptosphere",
  },
  {
    ticker: "JASMYUSDT",
    name: "JasmyCoin / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "DePIN IoT",
  },
  {
    ticker: "THETAUSDT",
    name: "Theta Network / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "DePIN Video",
  },
  {
    ticker: "ARUSDT",
    name: "Arweave / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "DePIN Storage",
  },
  {
    ticker: "PYTHUSDT",
    name: "Pyth Network / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Low Latency Oracle",
  },
  {
    ticker: "TIAUSDT",
    name: "Celestia / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Modular Blockchain",
  },
  {
    ticker: "SEIUSDT",
    name: "Sei / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Parallelized L1",
  },
  {
    ticker: "JUPUSDT",
    name: "Jupiter / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Solana Aggregator",
  },
  {
    ticker: "INJUSDT",
    name: "Injective / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "DeFi Platform L1",
  },
  {
    ticker: "CRVUSDT",
    name: "Curve DAO / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "DeFi AMM",
  },
  {
    ticker: "SNXUSDT",
    name: "Synthetix / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Synthetic Assets",
  },
  {
    ticker: "DYDXUSDT",
    name: "dYdX / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Perpetuals DEX",
  },
  {
    ticker: "CAKEUSDT",
    name: "PancakeSwap / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "DeFi Exchange",
  },
  {
    ticker: "LRCUSDT",
    name: "Loopring / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Layer 2 Rollup",
  },
  {
    ticker: "ENJUSDT",
    name: "Enjin Coin / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "GameFi NFTs",
  },
  {
    ticker: "CHZUSDT",
    name: "Chiliz / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Sports Tokenization",
  },
  {
    ticker: "BATUSDT",
    name: "Basic Attention Token / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Ad Monetization",
  },
  {
    ticker: "AUDIOUSDT",
    name: "Audius / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "DePIN Music",
  },
  {
    ticker: "MANAUSDT",
    name: "Decentraland / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Metaverse Platform",
  },
  {
    ticker: "SANDUSDT",
    name: "The Sandbox / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Metaverse Platform",
  },
  {
    ticker: "AXSUSDT",
    name: "Axie Infinity / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "GameFi Ecosystem",
  },
  {
    ticker: "FLOWUSDT",
    name: "Flow / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "NFT L1 Platform",
  },
  {
    ticker: "EOSUSDT",
    name: "EOS / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "L1 Platform",
  },
  {
    ticker: "XTZUSDT",
    name: "Tezos / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "L1 Platform",
  },
  {
    ticker: "ALGOUSDT",
    name: "Algorand / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "L1 Platform",
  },
  {
    ticker: "VETUSDT",
    name: "VeChain / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Supply Chain L1",
  },
  {
    ticker: "XECUSDT",
    name: "eCash / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Digital Cash",
  },
  {
    ticker: "NEOUSDT",
    name: "NEO / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "L1 Platform",
  },
  {
    ticker: "IOTAUSDT",
    name: "IOTA / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Tangle Network",
  },
  {
    ticker: "QTUMUSDT",
    name: "Qtum / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "L1 Platform",
  },
  {
    ticker: "DASHUSDT",
    name: "Dash / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Privacy Payments",
  },
  {
    ticker: "ZECUSDT",
    name: "Zcash / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Zero Knowledge Privacy",
  },
  {
    ticker: "RVNUSDT",
    name: "Ravencoin / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Asset Tokenization",
  },
  {
    ticker: "XEMUSDT",
    name: "NEM / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "L1 Platform",
  },
  {
    ticker: "WAVESUSDT",
    name: "Waves / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Web3 Platform",
  },
  {
    ticker: "YFIUSDT",
    name: "yearn.finance / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Yield Optimizer",
  },
  {
    ticker: "COMPUSDT",
    name: "Compound / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Lending Protocol",
  },
  {
    ticker: "SUSHIUSDT",
    name: "SushiSwap / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "DeFi AMM",
  },
  {
    ticker: "1INCHUSDT",
    name: "1inch Network / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "DEX Aggregator",
  },
  {
    ticker: "WOOUSDT",
    name: "WOO Network / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Exchange Liquidity",
  },
  {
    ticker: "MASKUSDT",
    name: "Mask Network / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Web3 Social Portal",
  },
  {
    ticker: "GALUSDT",
    name: "Galxe / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Web3 Identity",
  },
  {
    ticker: "HNTUSDT",
    name: "Helium / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "DePIN IoT Wireless",
  },
  {
    ticker: "MINAUSDT",
    name: "Mina / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Zero Knowledge L1",
  },
  {
    ticker: "ROSEUSDT",
    name: "Oasis Network / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Privacy Enabled L1",
  },
  {
    ticker: "KAVAUSDT",
    name: "Kava / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Cosmos DeFi Hub",
  },
  {
    ticker: "GNOUSDT",
    name: "Gnosis / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "L1 Infrastructure",
  },
  {
    ticker: "WLDUSDT",
    name: "Worldcoin / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Web3 Proof of Personhood",
  },
  {
    ticker: "ONDOUSDT",
    name: "Ondo Finance / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Real World Assets (RWA)",
  },
  {
    ticker: "ENAUSDT",
    name: "Ethena / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Synthetic Stablecoin",
  },
  {
    ticker: "ZILUSDT",
    name: "Zilliqa / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "EVM L1 Sharded PoS",
  },
  {
    ticker: "CKBUSDT",
    name: "Nervos Network / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Bitcoin Layer 2",
  },
  {
    ticker: "RAYUSDT",
    name: "Raydium / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Solana DEX AMM",
  },
  {
    ticker: "TUSDUSDT",
    name: "TrueUSD / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Price-Stable Coin",
  },
  {
    ticker: "POLUSDT",
    name: "Polygon Ecosystem Token / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Layer 2 Scaling",
  },
  {
    ticker: "JTOUSDT",
    name: "Jito / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Solana Liquid Staking",
  },
  {
    ticker: "1000SATSUSDT",
    name: "SATS (Ordinals) / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Meme Cryptosphere",
  },
  {
    ticker: "ORDIUSDT",
    name: "ORDI / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Ordinals Protocol",
  },
  {
    ticker: "ENSUSDT",
    name: "Ethereum Name Service / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Web3 Identity",
  },
  {
    ticker: "RUNEUSDT",
    name: "THORChain / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Cross-Chain Liquidity",
  },
  {
    ticker: "EGLDUSDT",
    name: "MultiversX / TetherUS",
    assetClass: "CRYPTO" as const,
    sector: "Sharded High Speed L1",
  },
];

/**
 * 1. GET /api/assets -> Retrieves available registrars catalog
 */
router.get("/assets", (req: Request, res: Response) => {
  res.json({ success: true, assets: COMPREHENSIVE_ASSETS });
});

/**
 * 2. GET /api/assets/:ticker -> Dynamically calculates technical indicators and retrieves a detailed briefing of a specific asset
 */
router.get("/assets/:ticker", async (req: Request, res: Response) => {
  const { ticker } = req.params;
  let match = COMPREHENSIVE_ASSETS.find(
    (a) => a.ticker.toUpperCase() === ticker.toUpperCase(),
  );
  if (!match) {
    // Dynamically insert or mock it to allow ANY ticker to be analyzed via Yahoo Finance or Binance
    const isCrypto =
      ticker.toUpperCase().endsWith("USDT") ||
      ticker.toUpperCase().endsWith("BTC");
    match = {
      ticker: ticker.toUpperCase(),
      name: `Dynamic Loaded ${ticker.toUpperCase()}`,
      assetClass: isCrypto ? "CRYPTO" : "IDX",
      sector: isCrypto ? "Crypto" : "Unknown",
      timeframe: "1h",
      price: 0,
      changePercent: 0,
      trendDirection: "NEUTRAL",
      probability: 0.5,
      rrRatio: 1.0,
      volatilityScore: 50,
      liquidityScore: 50,
      sentimentScore: 0,
      confidence: 0,
      newsTitleSummary: [],
    };
  }

  try {
    const timeframe = (req.query.timeframe as string) || "1h";
    const lang = (req.query.lang as string) === "EN" ? "EN" : "ID";

    // Asynchronously retrieve history
    const candles = await dataEngine.getHistory(
      match.ticker,
      match.assetClass,
      timeframe,
      100,
    );
    if (candles.length === 0) {
      throw new Error(
        `Market historical data feed returning empty arrays for ticker ${match.ticker}`,
      );
    }

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];

    const indicators = featureEngine.extractFeatures(candles);
    const regime = featureEngine.detectMarketRegime(indicators, candles);
    const riskMetrics = riskEngine.evaluateRisk(
      candles,
      indicators,
      match.assetClass,
    );
    const mlPrediction = mlEngine.generatePrediction(candles, indicators);

    // Apply calibration biases from memory-learning calibrations
    const biasedProbability = memoryEngine.applyCalibrationBias(
      mlPrediction.probability,
      match.assetClass,
    );

    // Fetch news sentiment using the LLM Sentiment analysis engine
    const sentiment = await sentimentEngine.analyzeTickerNews(
      match.ticker,
      match.assetClass === "CRYPTO",
    );

    // Packages final asset analysis block
    const changePercent = ((last.close - prev.close) / prev.close) * 100;

    const evaluatedAsset = {
      ticker: match.ticker,
      name: match.name,
      assetClass: match.assetClass,
      timeframe,
      price: last.close,
      changePercent: Number(changePercent.toFixed(2)),
      volume: last.volume,

      probability: Number(biasedProbability.toFixed(3)),
      confidence: mlPrediction.confidence,
      momentumScore: mlPrediction.momentumScore,
      volatilityScore: riskMetrics.volatilityScore,
      liquidityScore: riskMetrics.liquidityScore,
      sentimentScore: sentiment.sentimentScore,
      riskScore: riskMetrics.riskScore,
      rrRatio: riskMetrics.rrRatio,
      breakoutProbability: mlPrediction.breakoutProbability,
      marketRegime: regime,
      manipulationWarning: riskMetrics.manipulationWarning,

      entryZone: riskMetrics.entryZone,
      stopLoss: Number(riskMetrics.stopLoss.toFixed(4)),
      takeProfit: Number(riskMetrics.takeProfit.toFixed(4)),
      invalidationLevel: Number(riskMetrics.invalidationLevel.toFixed(4)),
      trendDirection: mlPrediction.trendDirection,
      estimatedFutureCandles: mlPrediction.estimatedFutureCandles,
    };

    // Attach premium explainable AI brief description
    const brief = await explainEngine.generateAssetBrief(evaluatedAsset, lang);

    res.json({
      success: true,
      asset: {
        ...evaluatedAsset,
        aiExplanation: brief,
      },
      indicators,
      candles, // Include candles history for frontend chart rendering!
    });
  } catch (err: any) {
    console.error(`[API Router] Deep dive failed for asset ${ticker}:`, err);
    res
      .status(500)
      .json({
        success: false,
        error: err.message || "Deep quantitative calculation error.",
      });
  }
});

/**
 * 3. GET /api/scanner/scan -> Performs full non-blocking scan across registry assets
 */
router.get("/scanner/scan", async (req: Request, res: Response) => {
  const start = Date.now();
  const assetClassFilter = req.query.assetClass as string; // 'IDX' | 'CRYPTO' | 'ALL'
  const timeframe = (req.query.timeframe as string) || "15m"; // Defaulting to 15m for scalping!
  const tickerFilter = req.query.ticker as string; // Optional specific ticker

  let targetAssets = COMPREHENSIVE_ASSETS;
  if (tickerFilter && tickerFilter !== "ALL" && tickerFilter !== "") {
    targetAssets = COMPREHENSIVE_ASSETS.filter(
      (a) => a.ticker.toUpperCase() === tickerFilter.toUpperCase(),
    );
    if (targetAssets.length === 0) {
      // Allow ad-hoc manual tickers
      targetAssets = [
        {
          ticker: tickerFilter.toUpperCase(),
          name: tickerFilter.toUpperCase(),
          assetClass: assetClassFilter === "CRYPTO" ? "CRYPTO" : "IDX",
          sector: "AdHoc Search",
        },
      ];
    }
  } else if (assetClassFilter && assetClassFilter !== "ALL") {
    targetAssets = COMPREHENSIVE_ASSETS.filter(
      (a) => a.assetClass === assetClassFilter,
    );
  }

  try {
    // Phase 4: Publish Horizontal Start Scanning Event across worker nodes
    EventBus.getInstance().publish("scan_requested", {
      assetClassFilter,
      timeframe,
    });

    console.log(
      `[API Router] Starting background scanning calculations for ${targetAssets.length} opportunities...`,
    );

    // Perform highly parallel scanning
    const scanned = await scannerEngine.scanAssets(targetAssets, timeframe);

    // Apply memory learning calibration weights adjustments to our probability indexes
    const calibratedAssets = scanned.map((asset) => {
      const biasedProb = memoryEngine.applyCalibrationBias(
        asset.probability,
        asset.assetClass,
      );
      return {
        ...asset,
        probability: Number(biasedProb.toFixed(3)),
      };
    });

    // Relaxed filter to ensure some data shows up even with fallback generators
    const filteredAssets = calibratedAssets.filter((asset) => {
      // Allow 45%+ probability to pass through as NEUTRAL or BULLISH to populate UI scanner effectively
      return asset.probability > 0.45 && (asset.trendDirection === "BULLISH" || asset.trendDirection === "NEUTRAL");
    });

    // Re-rank assets matching calibrated and filtered outputs
    const rankedAssets = scannerEngine.rankAssets(filteredAssets);

    // Save predictions into the local database history log for Walk-Forward auditing
    memoryEngine.logScannedPredictions(filteredAssets);

    const durationMs = Date.now() - start;
    db.setLastScanTimestamp(new Date().toISOString());

    // Phase 4: Emit Scan Complete Event horizontally across the microservice bus
    EventBus.getInstance().publish("scan_completed", {
      assetsFound: rankedAssets.length,
      durationMs,
    });

    // Phase 3: Run Portfolio Intelligence & Regime-Aware Allocator algorithms
    const pi = PortfolioIntelligence.getInstance();
    const allocator = RegimeAwareAllocator.getInstance();

    // Simulate current regime detection for allocation strategy weighting
    const currentRegime =
      rankedAssets.length > 0 && rankedAssets[0].trendDirection === "BULLISH"
        ? "RISK-ON"
        : "RISK-OFF";
    const portfolioIntel = pi.analyzePortfolio(rankedAssets);
    const allocationWeights = Object.fromEntries(
      allocator.allocate(rankedAssets, currentRegime),
    );

    console.log(
      `[Phase 3 Allocator] Computed covariance-adjusted weights for ${rankedAssets.length} assets.`,
    );
    console.log(
      `[API Router] Scan finalized successfully in ${durationMs}ms with ${rankedAssets.length} active opportunities.`,
    );

    res.json({
      success: true,
      scanTimestamp: new Date().toISOString(),
      durationMs,
      assetsScannedCount: rankedAssets.length,
      scannedAssets: rankedAssets,
      portfolioIntelligence: portfolioIntel,
      allocationWeights: allocationWeights,
    });
  } catch (err: any) {
    console.error("[API Router] Opp scanning failure:", err);
    res
      .status(500)
      .json({
        success: false,
        error: err.message || "Opp scanning execution halted.",
      });
  }
});

/**
 * 4. GET /api/history -> Fetches local audit pred ledger
 */
router.get("/history", (req: Request, res: Response) => {
  const predictions = db.getPredictions();
  res.json({ success: true, predictions: predictions.slice(-200) }); // returns last 200 items for layout safety
});

/**
 * 5. GET /api/calibration -> Recovers existing system calibrator states
 */
router.get("/calibration", (req: Request, res: Response) => {
  const calibration = db.getCalibration();
  res.json({ success: true, calibration });
});

/**
 * 6. POST /api/audit/trigger -> Walk-forward model calibration recalculation trigger
 */
router.post("/audit/trigger", async (req: Request, res: Response) => {
  try {
    const results = await memoryEngine.executeCalibrationAudit();
    res.json({
      success: true,
      message: `Self-learning walk-forward validation and weights calibration complete.`,
      newlyAudited: results.newlyAuditedCount,
      globalAccuracy: results.globalAccuracy,
      calibratedWeights: db.getCalibration(),
    });
  } catch (err: any) {
    console.error("[API Router] Audit trigger error:", err);
    res
      .status(500)
      .json({
        success: false,
        error: err.message || "Model calibration trigger failed.",
      });
  }
});

export default router;
