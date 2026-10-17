import {
  applyPackedMarketBatch,
  createEmptyMarketState,
  getInstrumentMetrics,
} from '../metrics/market-metrics';
import { MARKET_UPDATE_WORDS, type MarketState, type ProducerSettings } from '../market.model';
import { validateProducerSettings } from '../producer/producer-settings';
import type {
  MarketWorkerCommand,
  MarketWorkerResponse,
  WasmProducer,
} from './market-worker.messages';

const SNAPSHOT_INTERVAL_MS = 100;
const DEFAULT_SEED = 0;

export interface MarketWorkerEnvironment {
  loadProducer(url: string): Promise<WasmProducer>;
  setTimer(callback: () => void, delayMs: number): number;
  clearTimer(timer: number): void;
  now(): number;
  post(response: MarketWorkerResponse): void;
}

export class MarketWorkerRuntime {
  private runId: number | null = null;
  private settings: ProducerSettings | null = null;
  private producer: WasmProducer | null = null;
  private marketState: MarketState | null = null;
  private status: 'initializing' | 'running' | 'paused' | 'stopped' = 'stopped';
  private timer: number | null = null;
  private lastSnapshotAt: number | null = null;

  constructor(private readonly environment: MarketWorkerEnvironment) {}

  handle(command: MarketWorkerCommand): void {
    switch (command.type) {
      case 'start':
        void this.start(command);
        break;
      case 'pause':
        if (command.runId === this.runId && this.status === 'running') {
          this.clearTimer();
          this.status = 'paused';
          this.publishSnapshot();
        }
        break;
      case 'resume':
        if (command.runId === this.runId && this.status === 'paused') {
          this.status = 'running';
          this.publishSnapshot();
          this.scheduleNextBatch();
        }
        break;
      case 'stop':
        if (command.runId === this.runId) {
          this.stop();
        }
        break;
    }
  }

  private async start(command: Extract<MarketWorkerCommand, { type: 'start' }>): Promise<void> {
    if (this.runId !== null) {
      return;
    }
    this.runId = command.runId;
    this.status = 'initializing';

    try {
      const validation = validateProducerSettings(command.settings);

      if (!validation.valid) {
        throw new Error('Invalid producer settings.');
      }

      const producer = await this.environment.loadProducer(command.wasmUrl);

      if (this.isStopped()) {
        return;
      }

      if (producer.configure(validation.settings.instrumentCount, DEFAULT_SEED) !== 1) {
        throw new Error('Wasm producer rejected the instrument count.');
      }

      this.producer = producer;
      this.settings = validation.settings;
      this.marketState = createEmptyMarketState(validation.settings.instrumentCount);
      this.status = 'running';
      this.environment.post({ type: 'ready', runId: command.runId });
      this.scheduleNextBatch();
    } catch (error) {
      if (!this.isStopped()) {
        this.fail(error);
      }
    }
  }

  private scheduleNextBatch(): void {
    if (this.status !== 'running' || !this.settings) {
      return;
    }

    this.timer = this.environment.setTimer(
      () => this.produceBatch(),
      this.settings.batchIntervalMs,
    );
  }

  private produceBatch(): void {
    this.timer = null;

    if (this.status !== 'running' || !this.settings || !this.producer || !this.marketState) {
      return;
    }

    try {
      const count = this.settings.updatesPerBatch;
      const pointer = this.producer.generateBatch(count);

      if (pointer <= 0 || pointer % Int32Array.BYTES_PER_ELEMENT !== 0) {
        throw new Error('Wasm producer returned an invalid batch address.');
      }

      const words = new Int32Array(
        this.producer.memory.buffer,
        pointer,
        count * MARKET_UPDATE_WORDS,
      );

      this.marketState = applyPackedMarketBatch(this.marketState, words);

      const now = this.environment.now();

      if (this.lastSnapshotAt === null || now - this.lastSnapshotAt >= SNAPSHOT_INTERVAL_MS) {
        this.publishSnapshot(now);
      }

      this.scheduleNextBatch();
    } catch (error) {
      this.fail(error);
    }
  }

  private publishSnapshot(at = this.environment.now()): void {
    if (this.runId === null || !this.marketState || this.status === 'stopped') {
      return;
    }

    this.environment.post({
      type: 'snapshot',
      runId: this.runId,
      metrics: getInstrumentMetrics(this.marketState),
      status: this.status === 'paused' ? 'paused' : 'running',
    });
    this.lastSnapshotAt = at;
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      this.environment.clearTimer(this.timer);
      this.timer = null;
    }
  }

  private isStopped(): boolean {
    return this.status === 'stopped';
  }

  private stop(): void {
    this.clearTimer();
    this.status = 'stopped';
    this.producer = null;
    this.marketState = null;
    this.settings = null;
  }

  private fail(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    const runId = this.runId;
    this.stop();

    if (runId !== null) {
      this.environment.post({ type: 'error', runId, message });
    }
  }
}
