import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MarketProducer } from '@market/producer/market-producer';
import { FakeMarketWorker } from '@market/producer/testing/fake-market-worker';
import { App } from '@app/app';
import { routes } from '@app/app.routes';

describe('App routes', () => {
  beforeEach(() => {
    FakeMarketWorker.instances = [];
    vi.stubGlobal('Worker', FakeMarketWorker);
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  it('keeps one producer and its paused metrics while navigating between pages', async () => {
    const producer = TestBed.inject(MarketProducer);
    producer.startDefaults();
    const worker = FakeMarketWorker.instances[0];
    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(App);

    await router.navigateByUrl('/');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('h1')?.textContent.trim()).toBe('Dashboard');

    worker.emitMessage({ type: 'ready', runId: 1 });
    producer.pause();
    worker.emitMessage({
      type: 'snapshot',
      runId: 1,
      status: 'paused',
      metrics: [
        {
          symbol: 'SIM01',
          lastTradePriceCents: 10_200,
          spreadCents: 4,
          volume: 40n,
          vwapCents: 10_150,
          imbalance: 0.2,
        },
      ],
    });

    await router.navigateByUrl('/settings');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toBe('Settings');
    const settingsLink = fixture.nativeElement.querySelector(
      'a[routerLink="/settings"]',
    ) as HTMLAnchorElement;
    expect(settingsLink.pathname).toBe('/settings');
    expect(settingsLink.hash).toBe('');
    expect(fixture.nativeElement.textContent).toContain('Status: paused');

    const input = fixture.nativeElement.querySelector('#instrument-count') as HTMLInputElement;
    input.value = '7';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();

    await router.navigateByUrl('/');
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('$101.50');
    expect(fixture.nativeElement.textContent).toContain('Producer: Paused');

    await router.navigateByUrl('/settings');
    await fixture.whenStable();
    expect(
      (fixture.nativeElement.querySelector('#instrument-count') as HTMLInputElement).value,
    ).toBe('5');
    expect(FakeMarketWorker.instances).toHaveLength(1);
    expect(worker.terminated).toBe(false);
  });
});
