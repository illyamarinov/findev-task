import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { InstrumentMetrics, ProducerStatus } from '@market/market.model';
import { MarketProducer } from '@market/producer/market-producer';
import { Dashboard } from '@pages/dashboard/dashboard';

describe('Dashboard', () => {
  const metrics = signal<readonly InstrumentMetrics[]>([]);
  const status = signal<ProducerStatus>('initializing');
  const error = signal<string | null>(null);
  const pause = vi.fn();
  const resume = vi.fn();

  beforeEach(() => {
    metrics.set([
      {
        symbol: 'SIM01',
        lastTradePriceCents: null,
        spreadCents: null,
        volume: 0n,
        vwapCents: null,
        imbalance: null,
      },
    ]);
    status.set('initializing');
    error.set(null);
    pause.mockClear();
    resume.mockClear();

    TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        {
          provide: MarketProducer,
          useValue: { metrics, status, error, pause, resume },
        },
      ],
    });
  });

  it('shows unavailable values and zero volume before the first update', async () => {
    const fixture = TestBed.createComponent(Dashboard);
    await fixture.whenStable();

    const row = fixture.nativeElement.querySelector('tbody tr') as HTMLTableRowElement;
    expect(row.textContent).toContain('SIM01');
    expect(Array.from(row.querySelectorAll('td'), (cell) => cell.textContent?.trim())).toEqual([
      '—',
      '—',
      '0',
      '—',
      '—',
    ]);
    expect((fixture.nativeElement.querySelector('button') as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(fixture.nativeElement.textContent).toContain('Producer: Starting');
  });

  it('formats money, cumulative volume, and imbalance from a snapshot', async () => {
    const fixture = TestBed.createComponent(Dashboard);
    metrics.set([
      {
        symbol: 'SIM01',
        lastTradePriceCents: 10_200,
        spreadCents: 4,
        volume: 40n,
        vwapCents: 10_150,
        imbalance: 0.2,
      },
    ]);
    status.set('running');
    await fixture.whenStable();

    const row = fixture.nativeElement.querySelector('tbody tr') as HTMLTableRowElement;
    expect(Array.from(row.querySelectorAll('td'), (cell) => cell.textContent?.trim())).toEqual([
      '$102.00',
      '$0.04',
      '40',
      '$101.50',
      '0.20',
    ]);

    metrics.set([{ ...metrics()[0], imbalance: -0.001 }]);
    await fixture.whenStable();
    expect(row.querySelectorAll('td')[4].textContent?.trim()).toBe('0.00');
  });

  it('allows only the matching Pause or Resume action and reports errors', async () => {
    const fixture = TestBed.createComponent(Dashboard);
    status.set('running');
    await fixture.whenStable();

    let button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.textContent).toContain('Pause');
    button.click();
    expect(pause).toHaveBeenCalledOnce();

    status.set('pausing');
    await fixture.whenStable();
    button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    status.set('paused');
    await fixture.whenStable();
    button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.textContent).toContain('Resume');
    button.click();
    expect(resume).toHaveBeenCalledOnce();

    status.set('error');
    error.set('Unable to initialize market producer.');
    await fixture.whenStable();
    expect((fixture.nativeElement.querySelector('button') as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(fixture.nativeElement.textContent).toContain('Unable to initialize market producer.');
  });
});
