import type { MarketWorkerCommand, MarketWorkerResponse } from '@worker/market-worker.messages';

export class FakeMarketWorker {
  static instances: FakeMarketWorker[] = [];

  readonly posted: MarketWorkerCommand[] = [];
  readonly listeners = new Map<string, ((event: never) => void)[]>();
  terminated = false;

  constructor(
    readonly url: URL,
    readonly options: WorkerOptions,
  ) {
    FakeMarketWorker.instances.push(this);
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
}
