import type { InstrumentMetrics, ProducerSettings } from '../market.model';

export type MarketWorkerCommand =
  | {
      readonly type: 'start';
      readonly runId: number;
      readonly settings: ProducerSettings;
      readonly wasmUrl: string;
    }
  | { readonly type: 'pause' | 'resume' | 'stop'; readonly runId: number };

export type MarketWorkerResponse =
  | { readonly type: 'ready'; readonly runId: number }
  | {
      readonly type: 'snapshot';
      readonly runId: number;
      readonly metrics: readonly InstrumentMetrics[];
      readonly status: 'running' | 'paused';
    }
  | { readonly type: 'error'; readonly runId: number; readonly message: string };

export interface WasmProducer {
  readonly memory: WebAssembly.Memory;
  configure(instrumentCount: number, seed: number): number;
  generateBatch(count: number): number;
}
