import { Component, input } from '@angular/core';
import type { ProducerSettings, ProducerStatus } from '@market/market.model';
import { Card } from '@shared/ui/card/card';

@Component({
  imports: [Card],
  selector: 'app-active-run-card',
  host: { class: 'block' },
  templateUrl: './active-run-card.html',
})
export class ActiveRunCard {
  readonly settings = input.required<ProducerSettings>();
  readonly status = input.required<ProducerStatus>();
  readonly error = input.required<string | null>();
}
