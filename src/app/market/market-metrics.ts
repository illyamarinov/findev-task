import { InstrumentMetrics, InstrumentState, MarketState, MarketUpdate } from './market.model';
import { PRODUCER_SETTING_LIMITS } from './producer-settings';

type MutableInstrumentState = { -readonly [Key in keyof InstrumentState]: InstrumentState[Key] };

export const createEmptyMarketState = (instrumentCount: number): MarketState => {
  const { min, max } = PRODUCER_SETTING_LIMITS.instrumentCount;

  if (!Number.isInteger(instrumentCount) || instrumentCount < min || instrumentCount > max) {
    throw new Error('Instrument count must be an integer from 1 to 50.');
  }

  return Array.from({ length: instrumentCount }, (_, index): InstrumentState => ({
    symbol: `SIM${String(index + 1).padStart(2, '0')}`,
    lastTradePriceCents: null,
    bidCents: null,
    askCents: null,
    bidQuantity: null,
    askQuantity: null,
    volume: 0n,
    weightedPriceSumCents: 0n,
  }));
};

export const applyMarketBatch = (
  state: MarketState,
  updates: readonly MarketUpdate[],
): MarketState => {
  if (updates.length === 0) {
    return state;
  }

  // Copy once per batch. Only the returned draft is changed as updates are processed.
  const next: MutableInstrumentState[] = state.map((instrument) => ({ ...instrument }));

  for (const update of updates) {
    const instrument = next[update.instrumentIndex];
    if (!instrument) {
      throw new Error(`Unknown instrument index: ${update.instrumentIndex}`);
    }

    instrument.lastTradePriceCents = update.priceCents;
    instrument.bidCents = update.bidCents;
    instrument.askCents = update.askCents;
    instrument.bidQuantity = update.bidQuantity;
    instrument.askQuantity = update.askQuantity;
    instrument.volume += BigInt(update.tradeQuantity);
    instrument.weightedPriceSumCents += BigInt(update.priceCents) * BigInt(update.tradeQuantity);
  }

  return next;
};

export const getInstrumentMetrics = (state: MarketState): readonly InstrumentMetrics[] => {
  return state.map((instrument) => {
    let imbalance: number | null = null;

    if (instrument.bidQuantity !== null && instrument.askQuantity !== null) {
      const bookQuantity = instrument.bidQuantity + instrument.askQuantity;
      if (bookQuantity !== 0) {
        imbalance = (instrument.bidQuantity - instrument.askQuantity) / bookQuantity;
      }
    }

    let spreadCents: number | null = null;

    if (instrument.bidCents !== null && instrument.askCents !== null) {
      spreadCents = instrument.askCents - instrument.bidCents;
    }

    let vwapCents: number | null = null;

    if (instrument.volume !== 0n) {
      const wholeCents = instrument.weightedPriceSumCents / instrument.volume;
      const remainder = instrument.weightedPriceSumCents % instrument.volume;
      vwapCents = Number(wholeCents) + Number(remainder) / Number(instrument.volume);
    }

    return {
      symbol: instrument.symbol,
      lastTradePriceCents: instrument.lastTradePriceCents,
      spreadCents,
      volume: instrument.volume,
      vwapCents,
      imbalance,
    };
  });
};
