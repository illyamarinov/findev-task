import {
  parseDraftField,
  parseProducerSettingsDraft,
} from '@market/producer/producer-settings-draft';

describe('producer settings draft', () => {
  it('accepts inclusive limits and converts whole-number strings', () => {
    expect(
      parseProducerSettingsDraft({
        instrumentCount: ' 01 ',
        updatesPerBatch: '1000',
        batchIntervalMs: '50',
      }),
    ).toEqual({
      valid: true,
      settings: { instrumentCount: 1, updatesPerBatch: 1000, batchIntervalMs: 50 },
    });
  });

  it('separates missing, non-integer, and out-of-range values', () => {
    expect(
      parseProducerSettingsDraft({
        instrumentCount: '',
        updatesPerBatch: '1.5',
        batchIntervalMs: '2001',
      }),
    ).toEqual({
      valid: false,
      errors: {
        instrumentCount: 'required',
        updatesPerBatch: 'notInteger',
        batchIntervalMs: 'outOfRange',
      },
    });
    expect(parseDraftField('instrumentCount', '-1')).toEqual({
      valid: false,
      error: 'outOfRange',
    });
    expect(parseDraftField('updatesPerBatch', '1e2')).toEqual({
      valid: false,
      error: 'notInteger',
    });
  });
});
