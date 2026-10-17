import { type IntegerValidationResult, validateInteger } from '@shared/utils/validate-integer';
import type { ProducerSettings } from '@market/market.model';
import {
  PRODUCER_SETTING_LIMITS,
  type ProducerSettingsInput,
  type SettingsValidationErrors,
  type SettingsValidationResult,
  validateProducerSettings,
} from '@market/producer/producer-settings';

export type ProducerSettingsDraft = { readonly [Key in keyof ProducerSettings]: string };

export const toProducerSettingsDraft = (settings: ProducerSettings): ProducerSettingsDraft => ({
  instrumentCount: String(settings.instrumentCount),
  updatesPerBatch: String(settings.updatesPerBatch),
  batchIntervalMs: String(settings.batchIntervalMs),
});

export const parseDraftField = (
  key: keyof ProducerSettings,
  rawValue: string,
): IntegerValidationResult => {
  const value = rawValue.trim();

  if (value === '') {
    return { valid: false, error: 'required' };
  }

  if (!/^[+-]?\d+$/.test(value)) {
    return { valid: false, error: 'notInteger' };
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) {
    return { valid: false, error: 'notInteger' };
  }

  const { min, max } = PRODUCER_SETTING_LIMITS[key];
  return validateInteger(parsed, min, max);
};

export const parseProducerSettingsDraft = (
  draft: ProducerSettingsDraft,
): SettingsValidationResult => {
  const input: ProducerSettingsInput = {};
  const errors: SettingsValidationErrors = {};

  for (const key of Object.keys(PRODUCER_SETTING_LIMITS) as (keyof ProducerSettings)[]) {
    const result = parseDraftField(key, draft[key]);

    if (result.valid) {
      input[key] = result.value;
    } else {
      errors[key] = result.error;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return validateProducerSettings(input);
};
