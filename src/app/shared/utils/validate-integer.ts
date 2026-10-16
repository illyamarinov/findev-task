export type IntegerValidationError = 'required' | 'notInteger' | 'outOfRange';

export type IntegerValidationResult =
  | { readonly valid: true; readonly value: number }
  | { readonly valid: false; readonly error: IntegerValidationError };

export const validateInteger = (
  value: unknown,
  min: number,
  max: number,
): IntegerValidationResult => {
  if (value === null || value === undefined || value === '') {
    return { valid: false, error: 'required' };
  }

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return { valid: false, error: 'notInteger' };
  }

  if (value < min || value > max) {
    return { valid: false, error: 'outOfRange' };
  }

  return { valid: true, value };
};
