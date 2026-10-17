import { MarketUpdate } from '@market/market.model';
import {
  applyMarketBatch,
  applyPackedMarketBatch,
  createEmptyMarketState,
  getInstrumentMetrics,
} from '@market/metrics/market-metrics';

function update(overrides: Partial<MarketUpdate> = {}): MarketUpdate {
  return {
    instrumentIndex: 0,
    priceCents: 10_000,
    tradeQuantity: 10,
    bidCents: 9_996,
    askCents: 10_000,
    bidQuantity: 600,
    askQuantity: 400,
    ...overrides,
  };
}

describe('market metrics', () => {
  it('starts with stable symbols, unavailable values, and zero volume', () => {
    const metrics = getInstrumentMetrics(createEmptyMarketState(2));

    expect(metrics).toEqual([
      {
        symbol: 'SIM01',
        lastTradePriceCents: null,
        spreadCents: null,
        volume: 0n,
        vwapCents: null,
        imbalance: null,
      },
      {
        symbol: 'SIM02',
        lastTradePriceCents: null,
        spreadCents: null,
        volume: 0n,
        vwapCents: null,
        imbalance: null,
      },
    ]);
    expect(createEmptyMarketState(50)[49].symbol).toBe('SIM50');
  });

  it('calculates the worked example without rounding stored values', () => {
    const state = applyMarketBatch(createEmptyMarketState(1), [
      update(),
      update({
        priceCents: 10_200,
        tradeQuantity: 30,
        bidCents: 10_196,
        askCents: 10_200,
      }),
    ]);

    expect(getInstrumentMetrics(state)[0]).toEqual({
      symbol: 'SIM01',
      lastTradePriceCents: 10_200,
      spreadCents: 4,
      volume: 40n,
      vwapCents: 10_150,
      imbalance: 0.2,
    });
  });

  it('uses the latest book and reports unavailable imbalance for a zero denominator', () => {
    const state = applyMarketBatch(createEmptyMarketState(1), [
      update(),
      update({ bidQuantity: 0, askQuantity: 0 }),
    ]);

    expect(getInstrumentMetrics(state)[0]).toMatchObject({
      volume: 20n,
      vwapCents: 10_000,
      spreadCents: 4,
      imbalance: null,
    });
  });

  it('retains a fractional VWAP until display formatting', () => {
    const state = applyMarketBatch(createEmptyMarketState(1), [
      update({ priceCents: 101, tradeQuantity: 1 }),
      update({ priceCents: 102, tradeQuantity: 2 }),
    ]);

    expect(getInstrumentMetrics(state)[0].vwapCents).toBeCloseTo(101 + 2 / 3);
  });

  it('accumulates across batches while keeping instruments and previous states independent', () => {
    const initial = createEmptyMarketState(2);
    const first = applyMarketBatch(initial, [update()]);
    const second = applyMarketBatch(first, [
      update({ instrumentIndex: 1, priceCents: 20_000, bidCents: 19_996, askCents: 20_000 }),
      update({ priceCents: 10_200, bidCents: 10_196, askCents: 10_200 }),
    ]);

    expect(getInstrumentMetrics(initial).map((item) => item.volume)).toEqual([0n, 0n]);
    expect(getInstrumentMetrics(first).map((item) => item.volume)).toEqual([10n, 0n]);
    expect(getInstrumentMetrics(second).map((item) => item.volume)).toEqual([20n, 10n]);
    expect(getInstrumentMetrics(second).map((item) => item.vwapCents)).toEqual([10_100, 20_000]);
    expect(applyMarketBatch(second, [])).toBe(second);
  });

  it('retains exact cumulative totals beyond the safe integer range', () => {
    const state = applyMarketBatch(
      createEmptyMarketState(1),
      Array.from({ length: 10 }, () =>
        update({ priceCents: 1_000_000, tradeQuantity: 1_000_000_000 }),
      ),
    );

    expect(state[0].weightedPriceSumCents).toBe(10_000_000_000_000_000n);
    expect(getInstrumentMetrics(state)[0]).toMatchObject({
      volume: 10_000_000_000n,
      vwapCents: 1_000_000,
    });
  });

  it('rejects events for an instrument outside the active run', () => {
    expect(() =>
      applyMarketBatch(createEmptyMarketState(1), [update({ instrumentIndex: 1 })]),
    ).toThrow(Error);
  });

  it('applies packed Wasm records with the same cumulative results as object updates', () => {
    const updates = [
      update({ instrumentIndex: 0, priceCents: 10_000, tradeQuantity: 10 }),
      update({ instrumentIndex: 1, priceCents: 20_000, tradeQuantity: 5 }),
      update({ instrumentIndex: 0, priceCents: 10_200, tradeQuantity: 30 }),
    ];
    const packed = Int32Array.from(
      updates.flatMap((item) => [
        item.instrumentIndex,
        item.priceCents,
        item.tradeQuantity,
        item.bidCents,
        item.askCents,
        item.bidQuantity,
        item.askQuantity,
      ]),
    );
    const initial = createEmptyMarketState(2);

    expect(applyPackedMarketBatch(initial, packed)).toEqual(applyMarketBatch(initial, updates));
    expect(getInstrumentMetrics(applyPackedMarketBatch(initial, packed))).toEqual(
      getInstrumentMetrics(applyMarketBatch(initial, updates)),
    );
    expect(applyPackedMarketBatch(initial, new Int32Array())).toBe(initial);
    expect(() => applyPackedMarketBatch(initial, new Int32Array(6))).toThrow(/incomplete/);
    expect(() => applyPackedMarketBatch(initial, Int32Array.of(2, 100, 1, 99, 101, 1, 1))).toThrow(
      /Unknown instrument/,
    );
  });
});
