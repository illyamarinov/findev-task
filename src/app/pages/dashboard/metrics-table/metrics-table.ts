import { Component, computed, input } from '@angular/core';
import type { InstrumentMetrics } from '@market/market.model';
import { formatMetrics } from '@pages/dashboard/utils/format-metrics';
import { Card } from '@shared/ui/card/card';

@Component({
  imports: [Card],
  selector: 'app-metrics-table',
  host: { class: 'block' },
  templateUrl: './metrics-table.html',
})
export class MetricsTable {
  readonly metrics = input.required<readonly InstrumentMetrics[]>();

  protected readonly rows = computed(() => this.metrics().map(formatMetrics));
}
