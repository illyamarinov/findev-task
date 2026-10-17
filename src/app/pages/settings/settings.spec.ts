import { TestBed } from '@angular/core/testing';
import { MarketProducer } from '@market/producer/market-producer';
import { FakeMarketWorker } from '@market/producer/testing/fake-market-worker';
import { Settings } from '@pages/settings/settings';

const setField = (root: HTMLElement, id: string, value: string): void => {
  const input = root.querySelector(`#${id}`) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

const submitForm = (root: HTMLElement): void => {
  const form = root.querySelector('form') as HTMLFormElement;
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
};

describe('Settings', () => {
  let producer: MarketProducer;

  beforeEach(() => {
    FakeMarketWorker.instances = [];
    vi.stubGlobal('Worker', FakeMarketWorker);
    TestBed.configureTestingModule({ imports: [Settings] });
    producer = TestBed.inject(MarketProducer);
    producer.startDefaults();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  it('starts with active settings and does not apply edits before submission', async () => {
    const fixture = TestBed.createComponent(Settings);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect((root.querySelector('#instrument-count') as HTMLInputElement).value).toBe('5');
    expect((root.querySelector('#updates-per-batch') as HTMLInputElement).value).toBe('100');
    expect((root.querySelector('#batch-interval') as HTMLInputElement).value).toBe('500');

    setField(root, 'instrument-count', '7');
    await fixture.whenStable();
    expect(producer.settings().instrumentCount).toBe(5);
    expect(FakeMarketWorker.instances).toHaveLength(1);
  });

  it('rejects invalid values and explains the errors', async () => {
    const fixture = TestBed.createComponent(Settings);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    setField(root, 'instrument-count', '1.5');
    setField(root, 'updates-per-batch', '');
    submitForm(root);
    await fixture.whenStable();

    expect(producer.settings().instrumentCount).toBe(5);
    expect(FakeMarketWorker.instances).toHaveLength(1);
    expect(root.textContent).toContain('Enter a whole number.');
    expect(root.textContent).toContain('This field is required.');
  });

  it('applies validated values and immediately resets metrics for a new run', async () => {
    const fixture = TestBed.createComponent(Settings);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const previousWorker = FakeMarketWorker.instances[0];

    setField(root, 'instrument-count', '2');
    setField(root, 'updates-per-batch', '10');
    setField(root, 'batch-interval', '100');
    submitForm(root);
    await fixture.whenStable();

    expect(previousWorker.terminated).toBe(true);
    expect(FakeMarketWorker.instances).toHaveLength(2);
    expect(producer.settings()).toEqual({
      instrumentCount: 2,
      updatesPerBatch: 10,
      batchIntervalMs: 100,
    });
    expect(producer.metrics()).toHaveLength(2);
    expect(producer.metrics().every((metric) => metric.volume === 0n)).toBe(true);
    expect(producer.status()).toBe('initializing');
  });
});
