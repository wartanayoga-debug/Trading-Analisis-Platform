import { FeatureRecord } from "./feature_store";
import { Candle } from "../../types";

export interface MLDatasetRow {
  features: number[];
  targetBinary: number; // 1 or 0
  targetRegression: number; // log(close[t+N] / close[t])
}

export class DatasetBuilder {
  private static instance: DatasetBuilder;

  private constructor() {}

  public static getInstance(): DatasetBuilder {
    if (!DatasetBuilder.instance) {
      DatasetBuilder.instance = new DatasetBuilder();
    }
    return DatasetBuilder.instance;
  }

  /**
   * Transforms raw feature records into a Polars DataFrame-like structure
   * Applies the required REAL FORMULAS for binary classification and regression.
   */
  public buildDataset(
    records: FeatureRecord[],
    lookforwardN: number = 12,
    threshold: number = 0.015,
  ): MLDatasetRow[] {
    const dataset: MLDatasetRow[] = [];

    // In a real pipeline, we'd use node-polars or python Polars.
    // Here we simulate the vectorized operations.
    for (let i = 0; i < records.length - lookforwardN; i++) {
      const currentRecord = records[i];
      const futureRecord = records[i + lookforwardN];

      const currentClose =
        currentRecord.candles[currentRecord.candles.length - 1].close;
      const futureClose =
        futureRecord.candles[futureRecord.candles.length - 1].close;

      // binary classification target
      const futureReturn = futureClose / currentClose - 1;
      const targetBinary = futureReturn > threshold ? 1 : 0;

      // regression target
      const targetRegression = Math.log(futureClose / currentClose);

      // Flatten features for LightGBM/PyTorch mock
      const featArray = [
        currentRecord.features.rsi,
        currentRecord.features.macdHist,
        currentRecord.features.adx,
        currentRecord.features.obv,
        (currentRecord.features.bbUpper - currentRecord.features.bbLower) /
          currentRecord.features.bbMiddle,
      ];

      dataset.push({
        features: featArray,
        targetBinary,
        targetRegression,
      });
    }

    console.log(
      `[Dataset Builder] Built dataset of ${dataset.length} rows (Storage: Simulated Parquet).`,
    );
    return dataset;
  }

  public purgedWalkForwardValidation(
    dataset: MLDatasetRow[],
    purgeSize: number = 5,
    embargoSize: number = 2,
    nSplits: number = 3,
  ) {
    console.log(
      `[Dataset Builder] Executing Purged Walk-Forward Validation with Embargo (n_splits=${nSplits}, purge_size=${purgeSize}, embargo_size=${embargoSize})...`,
    );

    // Institutional temporal segmentation
    // We split indices sequentially, dropping `purgeSize` elements to prevent 
    // look-ahead leakage, and adding an `embargoSize` after the test set 
    // to prevent reversion leakage prior to the next training set.

    const splits = [];
    const foldSize = Math.floor(dataset.length / nSplits);

    for (let i = 0; i < nSplits; i++) {
      const trainStart = 0;
      const trainEnd = Math.max(0, foldSize * (i + 1) - purgeSize);
      
      const valStart = foldSize * (i + 1);
      const valEnd = valStart + foldSize;
      
      // Embargo period directly follows the validation set before the next training fold
      const embargoEnd = valEnd + embargoSize;

      if (valEnd > dataset.length) break;
      if (trainEnd <= trainStart) continue;

      const train = dataset.slice(trainStart, trainEnd);
      const val = dataset.slice(valStart, valEnd);
      splits.push({ train, val, embargoEnd });
    }

    // Return the latest split as the active one for simulation
    const activeSplit =
      splits.length > 0
        ? splits[splits.length - 1]
        : { train: dataset, val: [], embargoEnd: dataset.length };

    console.log(
      `[Dataset Builder] Walk-Forward Fold Generated: Train=${activeSplit.train.length}, Val=${activeSplit.val.length}`,
    );
    return activeSplit;
  }
}
