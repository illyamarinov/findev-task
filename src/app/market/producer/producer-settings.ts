import { type IntegerValidationError, validateInteger } from '../../shared/utils/validate-integer';
import { type ProducerSettings } from '../market.model';

export type SettingsValidationError = IntegerValidationError;
export type SettingsValidationErrors = Partial<
  Record<keyof ProducerSettings, SettingsValidationError>
>;
export type ProducerSettingsInput = Partial<Record<keyof ProducerSettings, unknown>>;

export type SettingsValidationResult =
  | { readonly valid: true; readonly settings: ProducerSettings }
  | { readonly valid: false; readonly errors: SettingsValidationErrors };

export const DEFAULT_PRODUCER_SETTINGS: ProducerSettings = {
  instrumentCount: 5,
  updatesPerBatch: 100,
  batchIntervalMs: 500,
};

export const PRODUCER_SETTING_LIMITS = {
  instrumentCount: { min: 1, max: 50 },
  updatesPerBatch: { min: 1, max: 1_000 },
  batchIntervalMs: { min: 50, max: 2_000 },
} as const satisfies Record<keyof ProducerSettings, { min: number; max: number }>;

export const validateProducerSettings = (
  input: ProducerSettingsInput,
): SettingsValidationResult => {
  const settings = { ...DEFAULT_PRODUCER_SETTINGS };
  const errors: SettingsValidationErrors = {};

  for (const key of Object.keys(PRODUCER_SETTING_LIMITS) as (keyof ProducerSettings)[]) {
    const { min, max } = PRODUCER_SETTING_LIMITS[key];
    const result = validateInteger(input[key], min, max);

    if (result.valid) {
      settings[key] = result.value;
    } else {
      errors[key] = result.error;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, settings };
};
