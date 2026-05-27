import { MarketScannerEngine } from "./src/server/engines/scanner.engine";
import { AssetClass } from "./src/types";

const scannerEngine = MarketScannerEngine.getInstance();
const targetAssets = [
  {
    ticker: "BBCA.JK",
    name: "Bank Central Asia Tbk",
    assetClass: "IDX" as AssetClass,
    sector: "Financials",
  },
  {
    ticker: "BTCUSDT",
    name: "Bitcoin",
    assetClass: "CRYPTO" as AssetClass,
  }
];

async function scan() {
  const result = await scannerEngine.scanAssets(targetAssets, "1h");
  console.log(JSON.stringify(result, null, 2));
}

scan();
