import {
  DEFAULT_PRODUCER_SETTINGS,
  validateProducerSettings,
} from '@market/producer/producer-settings';

describe('producer settings', () => {
  it('accepts the defaults and inclusive boundaries', () => {
    expect(validateProducerSettings(DEFAULT_PRODUCER_SETTINGS)).toEqual({
      valid: true,
      settings: DEFAULT_PRODUCER_SETTINGS,
    });
    expect(
      validateProducerSettings({ instrumentCount: 1, updatesPerBatch: 1, batchIntervalMs: 50 }),
    ).toMatchObject({ valid: true });
    expect(
      validateProducerSettings({
        instrumentCount: 50,
        updatesPerBatch: 1_000,
        batchIntervalMs: 2_000,
      }),
    ).toMatchObject({ valid: true });
  });

  it('reports missing values separately from invalid numbers', () => {
    expect(validateProducerSettings({})).toEqual({
      valid: false,
      errors: {
        instrumentCount: 'required',
        updatesPerBatch: 'required',
        batchIntervalMs: 'required',
      },
    });
    expect(
      validateProducerSettings({
        instrumentCount: '',
        updatesPerBatch: null,
        batchIntervalMs: 500,
      }),
    ).toEqual({
      valid: false,
      errors: { instrumentCount: 'required', updatesPerBatch: 'required' },
    });
  });

  it('rejects fractions, numeric strings, NaN, and Infinity without coercion', () => {
    expect(
      validateProducerSettings({
        instrumentCount: 1.5,
        updatesPerBatch: '100',
        batchIntervalMs: Number.NaN,
      }),
    ).toEqual({
      valid: false,
      errors: {
        instrumentCount: 'notInteger',
        updatesPerBatch: 'notInteger',
        batchIntervalMs: 'notInteger',
      },
    });
    expect(
      validateProducerSettings({
        instrumentCount: 5,
        updatesPerBatch: Number.POSITIVE_INFINITY,
        batchIntervalMs: Number.NEGATIVE_INFINITY,
      }),
    ).toEqual({
      valid: false,
      errors: { updatesPerBatch: 'notInteger', batchIntervalMs: 'notInteger' },
    });
  });

  it('rejects values outside each allowed range', () => {
    expect(
      validateProducerSettings({ instrumentCount: 0, updatesPerBatch: 1_001, batchIntervalMs: 49 }),
    ).toEqual({
      valid: false,
      errors: {
        instrumentCount: 'outOfRange',
        updatesPerBatch: 'outOfRange',
        batchIntervalMs: 'outOfRange',
      },
    });
    expect(
      validateProducerSettings({ instrumentCount: 51, updatesPerBatch: 0, batchIntervalMs: 2_001 }),
    ).toMatchObject({
      valid: false,
      errors: {
        instrumentCount: 'outOfRange',
        updatesPerBatch: 'outOfRange',
        batchIntervalMs: 'outOfRange',
      },
    });
  });
});
