export class ExecutionEngine {
  private static instance: ExecutionEngine;

  private constructor() {}

  public static getInstance(): ExecutionEngine {
    if (!ExecutionEngine.instance) {
      ExecutionEngine.instance = new ExecutionEngine();
    }
    return ExecutionEngine.instance;
  }

  /**
   * Institutional Square-root market impact model
   * Impact = Y * σ * √(Q / V)
   * Where:
   * Y = Empirically calibrated execution coefficient (typically 0.1 to 1.0)
   * σ = Realized volatility (std dev) over the horizon
   * Q = Order quantity
   * V = Average daily volume (or volume in bucket)
   * 
   * Returns estimated slippage as a percentage impact on the price.
   */
  public estimateSquareRootImpact(
    orderQuantity: number, 
    averageVolume: number, 
    volatility: number, 
    coefficientY: number = 0.5
  ): number {
    if (averageVolume <= 0 || orderQuantity <= 0) return 0;
    
    // Cap ratio at 0.5 to prevent absurd impact on perfectly illiquid ticks
    const participatingRatio = Math.min(0.5, orderQuantity / averageVolume);
    
    const impact = coefficientY * volatility * Math.sqrt(participatingRatio);
    
    // Returns percentage slippage (e.g. 0.005 for 50bps)
    return impact;
  }

  /**
   * Simulates a partial fill given liquidity limits
   */
  public simulateLiquidityExecution(
    orderQuantity: number,
    availableLiquidity: number
  ) {
     if (orderQuantity <= availableLiquidity) {
       return { filled: orderQuantity, partialFill: false };
     } else {
       return { filled: availableLiquidity, partialFill: true, remaining: orderQuantity - availableLiquidity };
     }
  }
}
