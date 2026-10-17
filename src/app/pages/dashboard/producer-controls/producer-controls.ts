import { Component, computed, input, output } from '@angular/core';
import type { ProducerStatus } from '@market/market.model';

const statusLabels: Record<ProducerStatus, string> = {
  idle: 'Stopped',
  initializing: 'Starting',
  running: 'Running',
  pausing: 'Pausing',
  paused: 'Paused',
  resuming: 'Resuming',
  error: 'Error',
};

@Component({
  selector: 'app-producer-controls',
  host: { class: 'block' },
  templateUrl: './producer-controls.html',
})
export class ProducerControls {
  readonly status = input.required<ProducerStatus>();
  readonly toggleRequested = output<void>();

  protected readonly statusLabel = computed(() => statusLabels[this.status()]);
  protected readonly canToggle = computed(
    () => this.status() === 'running' || this.status() === 'paused',
  );
  protected readonly controlLabel = computed(() =>
    this.status() === 'paused' || this.status() === 'resuming' ? 'Resume updates' : 'Pause updates',
  );
}
