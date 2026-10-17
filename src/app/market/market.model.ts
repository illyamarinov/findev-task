export interface MarketUpdate {
  readonly instrumentIndex: number;
  readonly priceCents: number;
  readonly tradeQuantity: number;
  readonly bidCents: number;
  readonly askCents: number;
  readonly bidQuantity: number;
  readonly askQuantity: number;
}

export const MARKET_UPDATE_WORDS = 7;

export interface ProducerSettings {
  readonly instrumentCount: number; // by default: 5
  readonly updatesPerBatch: number; // by default: 100
  readonly batchIntervalMs: number; // by default: 500 (in ms)
}

export interface InstrumentMetrics {
  readonly symbol: string;
  readonly lastTradePriceCents: number | null;
  readonly spreadCents: number | null;
  readonly volume: bigint;
  readonly vwapCents: number | null;
  readonly imbalance: number | null;
}

export interface InstrumentState {
  readonly symbol: string;
  readonly lastTradePriceCents: number | null;
  readonly bidCents: number | null;
  readonly askCents: number | null;
  readonly bidQuantity: number | null;
  readonly askQuantity: number | null;
  readonly volume: bigint;
  readonly weightedPriceSumCents: bigint;
}

export type MarketState = readonly InstrumentState[];
