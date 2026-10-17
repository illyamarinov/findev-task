import { Component, input, linkedSignal, output, signal } from '@angular/core';
import { FormField, form, submit, validate } from '@angular/forms/signals';
import type { ProducerSettings } from '@market/market.model';
import { PRODUCER_SETTING_LIMITS } from '@market/producer/producer-settings';
import {
  parseDraftField,
  parseProducerSettingsDraft,
  toProducerSettingsDraft,
} from '@market/producer/producer-settings-draft';
import { Card } from '@shared/ui/card/card';
import type { IntegerValidationError } from '@shared/utils/validate-integer';

const validationMessage = (key: keyof ProducerSettings, error: IntegerValidationError): string => {
  if (error === 'required') {
    return 'This field is required.';
  }

  if (error === 'notInteger') {
    return 'Enter a whole number.';
  }

  const { min, max } = PRODUCER_SETTING_LIMITS[key];
  return `Enter a value from ${min.toLocaleString('en-US')} to ${max.toLocaleString('en-US')}.`;
};

const validateDraftField = (key: keyof ProducerSettings, value: string) => {
  const result = parseDraftField(key, value);
  return result.valid
    ? undefined
    : { kind: result.error, message: validationMessage(key, result.error) };
};

@Component({
  imports: [Card, FormField],
  selector: 'app-settings-form',
  host: { class: 'block' },
  templateUrl: './settings-form.html',
})
export class SettingsForm {
  readonly settings = input.required<ProducerSettings>();
  readonly settingsSubmitted = output<ProducerSettings>();

  protected readonly draft = linkedSignal(() => toProducerSettingsDraft(this.settings()));
  protected readonly attempted = signal(false);

  protected readonly settingsForm = form(this.draft, (path) => {
    validate(path.instrumentCount, ({ value }) => validateDraftField('instrumentCount', value()));
    validate(path.updatesPerBatch, ({ value }) => validateDraftField('updatesPerBatch', value()));
    validate(path.batchIntervalMs, ({ value }) => validateDraftField('batchIntervalMs', value()));
  });

  protected async apply(event: Event): Promise<void> {
    event.preventDefault();
    this.attempted.set(true);

    await submit(this.settingsForm, async () => {
      const parsed = parseProducerSettingsDraft(this.draft());

      if (!parsed.valid) {
        return;
      }

      this.settingsSubmitted.emit(parsed.settings);
      this.draft.set(toProducerSettingsDraft(parsed.settings));
      this.attempted.set(false);
    });
  }
}
