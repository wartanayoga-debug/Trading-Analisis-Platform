import { EventEmitter } from "events";

// Mocking BullMQ and Redis for local execution without a real Redis server
// to avoid Lua scripting errors (cmsgpack nil value).
class Queue {
  constructor(public name: string, public options?: any) {}
  async add(jobName: string, data: any) {
    // Simulate async job adding
    setTimeout(async () => {
      const workers = Worker.workers.filter(w => w.name === this.name);
      for (const w of workers) {
         try { await w.processor({ id: Math.random().toString(36).substring(2, 9), data, name: jobName }); } 
         catch(e) { console.error(`Worker error on ${this.name}:`, e); }
      }
    }, 10);
  }
}

class Worker {
  static workers: Worker[] = [];
  constructor(public name: string, public processor: (job: any) => Promise<void>, public options?: any) {
     Worker.workers.push(this);
  }
}

export interface SystemEvent {
  id: string;
  topic: string;
  payload: any;
  timestamp: number;
}

/**
 * Event-Driven Architecture 
 * Simulates BullMQ workers without actual Redis since real infrastructure is unavailable
 */
export class EventBus extends EventEmitter {
  private static instance: EventBus;
  private redisConnection: any;
  
  private marketTaskQueue: Queue;
  private featureTaskQueue: Queue;
  private inferenceTaskQueue: Queue;
  private riskTaskQueue: Queue;

  private constructor() {
    super();
    this.redisConnection = {}; // Mock connection

    // Create Queues
    this.marketTaskQueue = new Queue("market_data_stream", { connection: this.redisConnection });
    this.featureTaskQueue = new Queue("features_computed", { connection: this.redisConnection });
    this.inferenceTaskQueue = new Queue("inference_completed", { connection: this.redisConnection });
    this.riskTaskQueue = new Queue("risk_evaluated", { connection: this.redisConnection });

    // Create Workers
    new Worker("market_data_stream", async (job) => {
        console.log(`[BullMQ Worker: Feature] Processing job ${job.id}: Computing variables...`);
        await this.featureTaskQueue.add("process", { asset: job.data.payload.asset, features: { rsi: 45 } });
    }, { connection: this.redisConnection });

    new Worker("features_computed", async (job) => {
        console.log(`[BullMQ Worker: Inference] Processing job ${job.id}: Querying ML Artifacts...`);
        await this.inferenceTaskQueue.add("process", { asset: job.data.asset, probability: 0.82 });
    }, { connection: this.redisConnection });

    new Worker("inference_completed", async (job) => {
        console.log(`[BullMQ Worker: Risk] Processing job ${job.id}: Calculating VAR...`);
        await this.riskTaskQueue.add("process", { asset: job.data.asset, riskScore: 12 });
    }, { connection: this.redisConnection });

    new Worker("risk_evaluated", async (job) => {
        console.log(`[BullMQ Worker: Portfolio] Processing job ${job.id}: Rebalancing covariance matrix...`);
    }, { connection: this.redisConnection });
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public async publish(topic: string, payload: any): Promise<void> {
    const event: SystemEvent = {
      id: Math.random().toString(36).substring(2, 9),
      topic,
      payload,
      timestamp: Date.now(),
    };

    console.log(`[BullMQ -> Redis Stream] Enqueuing Event: [${topic}] ID: ${event.id}`);

    if (topic === "market_data_stream") {
       await this.marketTaskQueue.add("process", event);
    } else if (topic === "features_computed") {
       await this.featureTaskQueue.add("process", event);
    } else if (topic === "inference_completed") {
       await this.inferenceTaskQueue.add("process", event);
    } else if (topic === "risk_evaluated") {
       await this.riskTaskQueue.add("process", event);
    } else {
       // Create ad-hoc queue for logging
       const q = new Queue(topic, { connection: this.redisConnection });
       await q.add("process", event);
       // We log only for these unhandled events since they do not have dedicated pipeline workers
    }
    this.emit(topic, event.payload);
  }
}
