import type { InstrumentMetrics } from '@market/market.model';

export interface DisplayMetrics {
  readonly symbol: string;
  readonly lastTradePrice: string;
  readonly spread: string;
  readonly volume: string;
  readonly vwap: string;
  readonly imbalance: string;
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const imbalanceFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatCents = (cents: number | null): string =>
  cents === null ? '—' : currencyFormatter.format(cents / 100);

const formatImbalance = (imbalance: number | null): string =>
  imbalance === null ? '—' : imbalanceFormatter.format(Math.abs(imbalance) < 0.005 ? 0 : imbalance);

export const formatMetrics = (metric: InstrumentMetrics): DisplayMetrics => ({
  symbol: metric.symbol,
  lastTradePrice: formatCents(metric.lastTradePriceCents),
  spread: formatCents(metric.spreadCents),
  volume: metric.volume.toLocaleString('en-US'),
  vwap: formatCents(metric.vwapCents),
  imbalance: formatImbalance(metric.imbalance),
});
