import type { ProducerSettings } from '../market.model';
import { MarketWorkerRuntime, type MarketWorkerEnvironment } from './market-worker-runtime';
import type { MarketWorkerResponse, WasmProducer } from './market-worker.messages';

const settings: ProducerSettings = {
  instrumentCount: 1,
  updatesPerBatch: 2,
  batchIntervalMs: 50,
};

function createProducer(): WasmProducer {
  const memory = new WebAssembly.Memory({ initial: 1 });
  let batchNumber = 0;

  return {
    memory,
    configure: vi.fn(() => 1),
    generateBatch: vi.fn((count: number) => {
      const words = new Int32Array(memory.buffer, 4, count * 7);
      for (let index = 0; index < count; index++) {
        words.set([0, 10_000 + batchNumber, 1, 9_999, 10_001, 600, 400], index * 7);
      }
      batchNumber++;
      return 4;
    }),
  };
}

function createRuntime(producer: WasmProducer = createProducer()) {
  const responses: MarketWorkerResponse[] = [];
  const environment: MarketWorkerEnvironment = {
    loadProducer: vi.fn(async () => producer),
    setTimer: (callback, delayMs) => setTimeout(callback, delayMs),
    clearTimer: (timer) => clearTimeout(timer),
    now: () => Date.now(),
    post: (response) => responses.push(response),
  };
  return { runtime: new MarketWorkerRuntime(environment), producer, responses, environment };
}

async function start(runtime: MarketWorkerRuntime): Promise<void> {
  runtime.handle({ type: 'start', runId: 1, settings, wasmUrl: '/market-producer.wasm' });
  await Promise.resolve();
}

describe('market worker runtime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts only after Wasm loads and accumulates every batch while throttling snapshots', async () => {
    const { runtime, producer, responses } = createRuntime();
    await start(runtime);

    expect(producer.configure).toHaveBeenCalledWith(1, 0);
    expect(responses).toEqual([{ type: 'ready', runId: 1 }]);
    vi.advanceTimersByTime(49);
    expect(producer.generateBatch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(responses).toHaveLength(2);
    expect(responses[1]).toMatchObject({ type: 'snapshot', status: 'running' });
    if (responses[1].type !== 'snapshot') {
      throw new Error('Expected a snapshot.');
    }
    expect(responses[1].metrics[0]).toMatchObject({ volume: 2n, vwapCents: 10_000 });

    vi.advanceTimersByTime(50);
    expect(producer.generateBatch).toHaveBeenCalledTimes(2);
    expect(responses).toHaveLength(2);

    vi.advanceTimersByTime(50);
    expect(producer.generateBatch).toHaveBeenCalledTimes(3);
    expect(responses).toHaveLength(3);
    if (responses[2].type !== 'snapshot') {
      throw new Error('Expected a snapshot.');
    }
    expect(responses[2].metrics[0]).toMatchObject({ volume: 6n, vwapCents: 10_001 });
  });

  it('flushes totals on pause, resumes after a full interval, and stops its timer', async () => {
    const { runtime, producer, responses } = createRuntime();
    await start(runtime);
    vi.advanceTimersByTime(50);

    runtime.handle({ type: 'pause', runId: 1 });
    expect(responses.at(-1)).toMatchObject({ type: 'snapshot', status: 'paused' });
    vi.advanceTimersByTime(5_000);
    expect(producer.generateBatch).toHaveBeenCalledTimes(1);

    runtime.handle({ type: 'resume', runId: 1 });
    expect(responses.at(-1)).toMatchObject({ type: 'snapshot', status: 'running' });
    vi.advanceTimersByTime(49);
    expect(producer.generateBatch).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(producer.generateBatch).toHaveBeenCalledTimes(2);

    runtime.handle({ type: 'stop', runId: 1 });
    vi.advanceTimersByTime(5_000);
    expect(producer.generateBatch).toHaveBeenCalledTimes(2);
  });

  it('ignores commands from a different run', async () => {
    const { runtime, producer, responses } = createRuntime();
    await start(runtime);
    runtime.handle({ type: 'pause', runId: 2 });
    runtime.handle({ type: 'stop', runId: 2 });
    vi.advanceTimersByTime(50);
    expect(producer.generateBatch).toHaveBeenCalledOnce();
    expect(responses.at(-1)).toMatchObject({ type: 'snapshot', status: 'running' });
  });

  it('rejects invalid settings before loading Wasm', async () => {
    const { runtime, responses, environment } = createRuntime();
    runtime.handle({
      type: 'start',
      runId: 1,
      settings: { ...settings, batchIntervalMs: 0 },
      wasmUrl: '/market-producer.wasm',
    });
    await Promise.resolve();

    expect(environment.loadProducer).not.toHaveBeenCalled();
    expect(responses).toEqual([{ type: 'error', runId: 1, message: 'Invalid producer settings.' }]);
  });

  it('does not start a timer if stopped while Wasm is loading', async () => {
    const producer = createProducer();
    let resolveProducer!: (value: WasmProducer) => void;
    const responses: MarketWorkerResponse[] = [];
    const environment: MarketWorkerEnvironment = {
      loadProducer: () =>
        new Promise<WasmProducer>((resolve) => {
          resolveProducer = resolve;
        }),
      setTimer: (callback, delayMs) => setTimeout(callback, delayMs),
      clearTimer: (timer) => clearTimeout(timer),
      now: () => Date.now(),
      post: (response) => responses.push(response),
    };
    const runtime = new MarketWorkerRuntime(environment);
    runtime.handle({ type: 'start', runId: 1, settings, wasmUrl: '/market-producer.wasm' });
    runtime.handle({ type: 'stop', runId: 1 });
    resolveProducer(producer);
    await Promise.resolve();
    vi.advanceTimersByTime(500);

    expect(responses).toEqual([]);
    expect(producer.configure).not.toHaveBeenCalled();
    expect(producer.generateBatch).not.toHaveBeenCalled();
  });

  it('reports initialization and generation failures without leaving a timer running', async () => {
    const failingEnvironment: MarketWorkerEnvironment = {
      loadProducer: async () => {
        throw new Error('Unable to fetch market producer (HTTP 404).');
      },
      setTimer: (callback, delayMs) => setTimeout(callback, delayMs),
      clearTimer: (timer) => clearTimeout(timer),
      now: () => Date.now(),
      post: vi.fn(),
    };
    const failingRuntime = new MarketWorkerRuntime(failingEnvironment);
    await start(failingRuntime);
    await Promise.resolve();
    expect(failingEnvironment.post).toHaveBeenCalledWith({
      type: 'error',
      runId: 1,
      message: 'Unable to fetch market producer (HTTP 404).',
    });

    const invalidProducer = createProducer();
    invalidProducer.generateBatch = vi.fn(() => 0);
    const { runtime, responses } = createRuntime(invalidProducer);
    await start(runtime);
    vi.advanceTimersByTime(50);
    expect(responses.at(-1)).toMatchObject({ type: 'error', runId: 1 });
    vi.advanceTimersByTime(500);
    expect(invalidProducer.generateBatch).toHaveBeenCalledOnce();
  });
});
