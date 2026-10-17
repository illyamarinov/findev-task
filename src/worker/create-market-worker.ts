export function createMarketWorker(): Worker {
  return new Worker(new URL('./market-producer.worker', import.meta.url), { type: 'module' });
}
