import {
  InstrumentMetrics,
  InstrumentState,
  MARKET_UPDATE_WORDS,
  MarketState,
  MarketUpdate,
} from '@market/market.model';
import { PRODUCER_SETTING_LIMITS } from '@market/producer/producer-settings';

type MutableInstrumentState = { -readonly [Key in keyof InstrumentState]: InstrumentState[Key] };

const applyUpdate = (
  instruments: MutableInstrumentState[],
  instrumentIndex: number,
  priceCents: number,
  tradeQuantity: number,
  bidCents: number,
  askCents: number,
  bidQuantity: number,
  askQuantity: number,
): void => {
  const instrument = instruments[instrumentIndex];

  if (!instrument) {
    throw new Error(`Unknown instrument index: ${instrumentIndex}`);
  }

  instrument.lastTradePriceCents = priceCents;
  instrument.bidCents = bidCents;
  instrument.askCents = askCents;
  instrument.bidQuantity = bidQuantity;
  instrument.askQuantity = askQuantity;
  instrument.volume += BigInt(tradeQuantity);
  instrument.weightedPriceSumCents += BigInt(priceCents) * BigInt(tradeQuantity);
};

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
    applyUpdate(
      next,
      update.instrumentIndex,
      update.priceCents,
      update.tradeQuantity,
      update.bidCents,
      update.askCents,
      update.bidQuantity,
      update.askQuantity,
    );
  }

  return next;
};

export const applyPackedMarketBatch = (state: MarketState, words: Int32Array): MarketState => {
  if (words.length % MARKET_UPDATE_WORDS !== 0) {
    throw new Error('Packed market batch has an incomplete update.');
  }

  if (words.length === 0) {
    return state;
  }

  const next: MutableInstrumentState[] = state.map((instrument) => ({ ...instrument }));
  for (let offset = 0; offset < words.length; offset += MARKET_UPDATE_WORDS) {
    applyUpdate(
      next,
      words[offset],
      words[offset + 1],
      words[offset + 2],
      words[offset + 3],
      words[offset + 4],
      words[offset + 5],
      words[offset + 6],
    );
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
