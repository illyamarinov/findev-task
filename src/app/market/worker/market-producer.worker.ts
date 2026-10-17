/// <reference lib="webworker" />

import { MarketWorkerRuntime } from './market-worker-runtime';
import type { MarketWorkerCommand, WasmProducer } from './market-worker.messages';

async function loadProducer(url: string): Promise<WasmProducer> {
  let response: Response;

  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(`Unable to fetch market producer: ${errorMessage(error)}`);
  }

  if (!response.ok) {
    throw new Error(`Unable to fetch market producer (HTTP ${response.status}).`);
  }

  let exports: WebAssembly.Exports;

  try {
    const { instance } = await WebAssembly.instantiate(await response.arrayBuffer());
    exports = instance.exports;
  } catch (error) {
    throw new Error(`Unable to initialize market producer: ${errorMessage(error)}`);
  }

  if (
    !(exports['memory'] instanceof WebAssembly.Memory) ||
    typeof exports['configure'] !== 'function' ||
    typeof exports['generateBatch'] !== 'function'
  ) {
    throw new Error('Market producer is missing required Wasm exports.');
  }

  return exports as unknown as WasmProducer;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const runtime = new MarketWorkerRuntime({
  loadProducer,
  setTimer: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimer: (timer) => clearTimeout(timer),
  now: () => performance.now(),
  post: (response) => postMessage(response),
});

addEventListener('message', ({ data }: MessageEvent<MarketWorkerCommand>) => {
  runtime.handle(data);
});
