import { TestBed } from '@angular/core/testing';
import { MarketProducer } from '@market/producer/market-producer';
import type { MarketWorkerCommand, MarketWorkerResponse } from '@worker/market-worker.messages';

class FakeWorker {
  static instances: FakeWorker[] = [];

  readonly posted: MarketWorkerCommand[] = [];
  readonly listeners = new Map<string, ((event: never) => void)[]>();
  terminated = false;

  constructor(
    readonly url: URL,
    readonly options: WorkerOptions,
  ) {
    FakeWorker.instances.push(this);
  }

  addEventListener(type: string, listener: (event: never) => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  postMessage(command: MarketWorkerCommand): void {
    this.posted.push(command);
  }

  terminate(): void {
    this.terminated = true;
  }

  emitMessage(response: MarketWorkerResponse): void {
    for (const listener of this.listeners.get('message') ?? []) {
      listener({ data: response } as never);
    }
  }

  emitError(message: string): void {
    for (const listener of this.listeners.get('error') ?? []) {
      listener({ message } as never);
    }
  }
}

describe('MarketProducer', () => {
  let service: MarketProducer;

  beforeEach(() => {
    FakeWorker.instances = [];
    vi.stubGlobal('Worker', FakeWorker);
    TestBed.configureTestingModule({});
    service = TestBed.inject(MarketProducer);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  it('starts the default run once and resolves Wasm relative to the document base', () => {
    service.startDefaults();
    service.startDefaults();

    expect(FakeWorker.instances).toHaveLength(1);
    const worker = FakeWorker.instances[0];
    expect(worker.options).toEqual({ type: 'module' });
    expect(worker.posted[0]).toEqual({
      type: 'start',
      runId: 1,
      settings: { instrumentCount: 5, updatesPerBatch: 100, batchIntervalMs: 500 },
      wasmUrl: new URL('market-producer.wasm', document.baseURI).href,
    });
    expect(service.status()).toBe('initializing');
    expect(service.metrics()).toHaveLength(5);
    expect(service.metrics().every((item) => item.volume === 0n)).toBe(true);

    worker.emitMessage({ type: 'ready', runId: 1 });
    expect(service.status()).toBe('running');
  });

  it('does not disturb the active run when Apply receives invalid settings', () => {
    service.startDefaults();
    const worker = FakeWorker.instances[0];
    worker.emitMessage({ type: 'ready', runId: 1 });
    const previousMetrics = service.metrics();

    expect(
      service.applySettings({ instrumentCount: 0, updatesPerBatch: 100, batchIntervalMs: 500 }),
    ).toMatchObject({ valid: false, errors: { instrumentCount: 'outOfRange' } });
    expect(FakeWorker.instances).toHaveLength(1);
    expect(worker.terminated).toBe(false);
    expect(service.status()).toBe('running');
    expect(service.metrics()).toBe(previousMetrics);
  });

  it('applies new settings from a paused run and rejects the previous run’s messages', () => {
    service.startDefaults();
    const oldWorker = FakeWorker.instances[0];
    oldWorker.emitMessage({ type: 'ready', runId: 1 });
    service.pause();
    oldWorker.emitMessage({
      type: 'snapshot',
      runId: 1,
      status: 'paused',
      metrics: [
        {
          symbol: 'SIM01',
          lastTradePriceCents: 10_000,
          spreadCents: 2,
          volume: 9n,
          vwapCents: 10_000,
          imbalance: 0,
        },
      ],
    });
    expect(service.status()).toBe('paused');

    const applied = service.applySettings({
      instrumentCount: 2,
      updatesPerBatch: 10,
      batchIntervalMs: 100,
    });
    expect(applied.valid).toBe(true);
    expect(oldWorker.terminated).toBe(true);
    expect(oldWorker.posted.at(-1)).toEqual({ type: 'stop', runId: 1 });
    expect(FakeWorker.instances).toHaveLength(2);
    expect(service.settings().instrumentCount).toBe(2);
    expect(service.metrics()).toHaveLength(2);
    expect(service.metrics().every((item) => item.volume === 0n)).toBe(true);
    expect(service.status()).toBe('initializing');

    oldWorker.emitMessage({
      type: 'snapshot',
      runId: 1,
      status: 'running',
      metrics: [
        {
          symbol: 'STALE',
          lastTradePriceCents: 1,
          spreadCents: 1,
          volume: 100n,
          vwapCents: 1,
          imbalance: 0,
        },
      ],
    });
    oldWorker.emitMessage({ type: 'error', runId: 1, message: 'stale error' });
    oldWorker.emitError('stale worker error');
    expect(service.metrics().every((item) => item.volume === 0n)).toBe(true);
    expect(service.error()).toBeNull();
    expect(service.status()).toBe('initializing');

    FakeWorker.instances[1].emitMessage({ type: 'ready', runId: 2 });
    expect(service.status()).toBe('running');
  });

  it('waits for worker acknowledgements when pausing and resuming', () => {
    service.startDefaults();
    const worker = FakeWorker.instances[0];
    worker.emitMessage({ type: 'ready', runId: 1 });

    service.pause();
    service.pause();
    expect(service.status()).toBe('pausing');
    expect(worker.posted.filter((message) => message.type === 'pause')).toHaveLength(1);
    worker.emitMessage({
      type: 'snapshot',
      runId: 1,
      status: 'running',
      metrics: service.metrics(),
    });
    expect(service.status()).toBe('pausing');
    worker.emitMessage({
      type: 'snapshot',
      runId: 1,
      status: 'paused',
      metrics: service.metrics(),
    });
    expect(service.status()).toBe('paused');

    service.resume();
    service.resume();
    expect(service.status()).toBe('resuming');
    expect(worker.posted.filter((message) => message.type === 'resume')).toHaveLength(1);
    worker.emitMessage({
      type: 'snapshot',
      runId: 1,
      status: 'paused',
      metrics: service.metrics(),
    });
    expect(service.status()).toBe('resuming');
    worker.emitMessage({
      type: 'snapshot',
      runId: 1,
      status: 'running',
      metrics: service.metrics(),
    });
    expect(service.status()).toBe('running');
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it('reports worker failures and terminates the failed worker', () => {
    service.startDefaults();
    const worker = FakeWorker.instances[0];
    worker.emitMessage({
      type: 'error',
      runId: 1,
      message: 'Unable to fetch market producer (HTTP 404).',
    });

    expect(worker.terminated).toBe(true);
    expect(service.status()).toBe('error');
    expect(service.error()).toContain('HTTP 404');
  });

  it('reports a missing Worker implementation', () => {
    vi.stubGlobal('Worker', undefined);
    service.startDefaults();

    expect(service.status()).toBe('error');
    expect(service.error()).toContain('Web Workers are unavailable');
  });
});
