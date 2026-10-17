import { Component, inject } from '@angular/core';
import type { ProducerSettings } from '@market/market.model';
import { MarketProducer } from '@market/producer/market-producer';
import { ActiveRunCard } from '@pages/settings/active-run-card/active-run-card';
import { SettingsForm } from '@pages/settings/settings-form/settings-form';

@Component({
  imports: [ActiveRunCard, SettingsForm],
  selector: 'app-settings',
  templateUrl: './settings.html',
})
export class Settings {
  protected readonly producer = inject(MarketProducer);

  protected applySettings(settings: ProducerSettings): void {
    this.producer.applySettings(settings);
  }
}
