import { EventEmitter } from "events";

export interface SystemEvent {
  id: string;
  topic: string;
  payload: any;
  timestamp: number;
}

/**
 * Event-Driven Architecture Simulation
 * Simulates:
 * - Queue: Kafka
 * - Stream: Redis Streams
 * - Workers: BullMQ
 * - DB: TimescaleDB
 */
export class EventBus extends EventEmitter {
  private static instance: EventBus;
  private redisStreamLog: SystemEvent[] = [];

  private constructor() {
    super();

    // Simulate BullMQ Worker Queues binding to Kafka/Redis topics
    // Workflow: market-data-stream -> feature workers -> inference workers -> risk -> portfolio
    this.on("market_data_stream", this.bullMQFeatureWorker.bind(this));
    this.on("features_computed", this.bullMQInferenceWorker.bind(this));
    this.on("inference_completed", this.bullMQRiskWorker.bind(this));
    this.on("risk_evaluated", this.bullMQPortfolioWorker.bind(this));
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public publish(topic: string, payload: any): void {
    const event: SystemEvent = {
      id: Math.random().toString(36).substring(2, 9),
      topic,
      payload,
      timestamp: Date.now(),
    };

    // Simulate TimescaleDB insertion for tick data
    this.redisStreamLog.push(event);

    console.log(
      `[Kafka -> Redis Stream] Published Event: [${topic}] ID: ${event.id}`,
    );

    // Asynchronously dispatch to BullMQ workers
    setImmediate(() => this.emit(topic, event));
  }

  private bullMQFeatureWorker(event: SystemEvent) {
    console.log(
      `[BullMQ Worker: Feature] Consuming market_data_stream. Computing variables...`,
    );
    this.publish("features_computed", {
      asset: event.payload.asset,
      features: { rsi: 45 },
    });
  }

  private bullMQInferenceWorker(event: SystemEvent) {
    console.log(
      `[BullMQ Worker: Inference] Consuming features_computed. Querying ML Artifacts...`,
    );
    this.publish("inference_completed", {
      asset: event.payload.asset,
      probability: 0.82,
    });
  }

  private bullMQRiskWorker(event: SystemEvent) {
    console.log(
      `[BullMQ Worker: Risk] Consuming inference_completed. Calculating VAR...`,
    );
    this.publish("risk_evaluated", {
      asset: event.payload.asset,
      riskScore: 12,
    });
  }

  private bullMQPortfolioWorker(event: SystemEvent) {
    console.log(
      `[BullMQ Worker: Portfolio] Consuming risk_evaluated. Rebalancing covariance matrix...`,
    );
  }
}
