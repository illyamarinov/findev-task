import { Component, inject } from '@angular/core';
import { MarketProducer } from '@market/producer/market-producer';
import { MetricsTable } from '@pages/dashboard/metrics-table/metrics-table';
import { ProducerControls } from '@pages/dashboard/producer-controls/producer-controls';

@Component({
  imports: [MetricsTable, ProducerControls],
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
})
export class Dashboard {
  protected readonly producer = inject(MarketProducer);

  protected toggleGeneration(): void {
    const producerStatus = this.producer.status();

    if (producerStatus === 'running') {
      this.producer.pause();
    } else if (producerStatus === 'paused') {
      this.producer.resume();
    }
  }
}
