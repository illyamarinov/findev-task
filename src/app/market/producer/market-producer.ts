import { DOCUMENT } from '@angular/common';
import { DestroyRef, Service, inject, signal } from '@angular/core';
import { createEmptyMarketState, getInstrumentMetrics } from '@market/metrics/market-metrics';
import {
  type InstrumentMetrics,
  type ProducerSettings,
  type ProducerStatus,
} from '@market/market.model';
import {
  DEFAULT_PRODUCER_SETTINGS,
  type ProducerSettingsInput,
  type SettingsValidationResult,
  validateProducerSettings,
} from '@market/producer/producer-settings';
import type { MarketWorkerCommand, MarketWorkerResponse } from '@worker/market-worker.messages';
import { createMarketWorker } from '@worker/create-market-worker';

@Service()
export class MarketProducer {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  private readonly settingsSignal = signal<ProducerSettings>(DEFAULT_PRODUCER_SETTINGS);
  private readonly metricsSignal = signal<readonly InstrumentMetrics[]>(
    getInstrumentMetrics(createEmptyMarketState(DEFAULT_PRODUCER_SETTINGS.instrumentCount)),
  );
  private readonly statusSignal = signal<ProducerStatus>('idle');
  private readonly errorSignal = signal<string | null>(null);

  readonly settings = this.settingsSignal.asReadonly();
  readonly metrics = this.metricsSignal.asReadonly();
  readonly status = this.statusSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  private worker: Worker | null = null;
  private runId = 0;

  constructor() {
    this.destroyRef.onDestroy(() => this.stop());
  }

  startDefaults(): void {
    if (this.statusSignal() === 'idle') {
      this.applySettings(DEFAULT_PRODUCER_SETTINGS);
    }
  }

  applySettings(input: ProducerSettingsInput): SettingsValidationResult {
    const validation = validateProducerSettings(input);

    if (!validation.valid) {
      return validation;
    }

    this.terminateWorker();
    const runId = ++this.runId;

    this.settingsSignal.set(validation.settings);
    this.metricsSignal.set(
      getInstrumentMetrics(createEmptyMarketState(validation.settings.instrumentCount)),
    );
    this.errorSignal.set(null);
    this.statusSignal.set('initializing');

    try {
      if (typeof Worker === 'undefined') {
        throw new Error('Web Workers are unavailable in this browser.');
      }

      const worker = createMarketWorker();

      this.worker = worker;

      worker.addEventListener('message', (event: MessageEvent<MarketWorkerResponse>) => {
        this.handleResponse(runId, worker, event.data);
      });

      worker.addEventListener('error', (event: ErrorEvent) => {
        this.failWorker(
          runId,
          worker,
          `Market producer worker failed: ${event.message || 'Unknown error.'}`,
        );
      });

      worker.addEventListener('messageerror', () => {
        this.failWorker(runId, worker, 'Unable to read a response from the market producer.');
      });

      const wasmUrl = new URL('market-producer.wasm', this.document.baseURI).href;
      worker.postMessage({
        type: 'start',
        runId,
        settings: validation.settings,
        wasmUrl,
      } satisfies MarketWorkerCommand);
    } catch (error) {
      this.failWorker(runId, this.worker, error instanceof Error ? error.message : String(error));
    }

    return validation;
  }

  pause(): void {
    if (this.statusSignal() !== 'running' || !this.worker) {
      return;
    }

    this.statusSignal.set('pausing');
    this.postControl({ type: 'pause', runId: this.runId });
  }

  resume(): void {
    if (this.statusSignal() !== 'paused' || !this.worker) {
      return;
    }

    this.statusSignal.set('resuming');
    this.postControl({ type: 'resume', runId: this.runId });
  }

  stop(): void {
    this.terminateWorker();
    this.statusSignal.set('idle');
  }

  private postControl(command: MarketWorkerCommand): void {
    try {
      this.worker?.postMessage(command);
    } catch (error) {
      this.failWorker(
        this.runId,
        this.worker,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private handleResponse(runId: number, worker: Worker, response: MarketWorkerResponse): void {
    if (runId !== this.runId || worker !== this.worker || response.runId !== runId) {
      return;
    }

    switch (response.type) {
      case 'ready':
        if (this.statusSignal() === 'initializing') {
          this.statusSignal.set('running');
        }
        break;
      case 'snapshot':
        this.metricsSignal.set(response.metrics);

        if (
          (this.statusSignal() === 'pausing' && response.status === 'running') ||
          (this.statusSignal() === 'resuming' && response.status === 'paused')
        ) {
          break;
        }
        this.statusSignal.set(response.status);
        break;
      case 'error':
        this.failWorker(runId, worker, response.message);
        break;
    }
  }

  private failWorker(runId: number, worker: Worker | null, message: string): void {
    if (runId !== this.runId || worker !== this.worker) {
      return;
    }

    this.terminateWorker();
    this.errorSignal.set(message);
    this.statusSignal.set('error');
  }

  private terminateWorker(): void {
    const worker = this.worker;
    if (!worker) {
      return;
    }

    this.worker = null;

    try {
      worker.postMessage({ type: 'stop', runId: this.runId } satisfies MarketWorkerCommand);
    } catch {
      // The worker may already have stopped after an error.
    } finally {
      worker.terminate();
    }
  }
}
