import { EventEmitter } from "events";

export interface SystemEvent {
  id: string;
  topic: string;
  payload: any;
  timestamp: number;
}

/**
 * Phase 4: Event Sourcing & Kafka Local Simulation
 * Acts as a centralized message broker for distributed worker tasks
 */
export class EventBus extends EventEmitter {
  private static instance: EventBus;
  private eventLog: SystemEvent[] = [];

  private constructor() {
    super();
    // Simulate Kafka consumer groups
    this.on("scan_requested", this.handleDistributedScan.bind(this));
    this.on("model_drift_detected", this.handleModelRetraining.bind(this));
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
    this.eventLog.push(event);
    console.log(`[Kafka/EventBus] Published Event: [${topic}] ID: ${event.id}`);
    this.emit(topic, event);
  }

  private handleDistributedScan(event: SystemEvent) {
    console.log(
      `[Distributed Worker] Consuming scan_requested event. Processing in background...`,
    );
    // Simulated distributed work
  }

  private handleModelRetraining(event: SystemEvent) {
    console.log(
      `[Distributed Worker] Consuming model_drift_detected. Triggering ML Pipeline...`,
    );
  }
}
