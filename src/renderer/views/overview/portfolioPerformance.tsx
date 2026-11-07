import { Line } from 'react-chartjs-2';
import Chart from 'chart.js/auto';
import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { ItemRow } from '../../interfaces/items';

Chart;

const PORTFOLIO_SETTINGS_KEY = 'overview.portfolio-value.v1';
const TRANSACTIONS_KEY = 'purchase-tracker.transactions.v1';
const SNAPSHOTS_KEY = 'overview.portfolio-snapshots.v1';

type PortfolioPreferences = {
  currency: string;
  source: string;
};

type TrackerTransaction = {
  itemKey: string;
  itemName: string;
  wearName?: string;
  kind: 'purchase' | 'sale';
  quantity: number;
  pricePerItemUsd: number;
  createdAt: string;
};

type Position = { quantity: number; costUsd: number };
type PortfolioSnapshot = { date: string; source: string; valueUsd: number; investedUsd: number };

function isValuableItem(item: ItemRow) {
  const imagePath = item.item_url || '';
  const itemName = item.item_name || '';
  return !imagePath.includes('weapons/base_weapons')
    && imagePath !== 'econ/tools/casket'
    && !/(service medal|veteran coin|loyalty badge|operation .* coin|pick'em trophy)/i.test(itemName);
}

function getInvestedUsd(transactions: TrackerTransaction[]) {
  const positions: Record<string, Position> = {};
  transactions.forEach((transaction) => {
    const position = positions[transaction.itemKey] || { quantity: 0, costUsd: 0 };
    if (transaction.kind === 'purchase') {
      position.quantity += transaction.quantity;
      position.costUsd += transaction.quantity * transaction.pricePerItemUsd;
    } else if (position.quantity > 0) {
      const quantitySold = Math.min(transaction.quantity, position.quantity);
      position.costUsd -= quantitySold * transaction.pricePerItemUsd;
      position.quantity -= quantitySold;
    }
    positions[transaction.itemKey] = position;
  });
  return Object.values(positions).reduce((total, position) => total + position.costUsd, 0);
}

export default function PortfolioPerformance() {
  const inventory = useSelector((state: any) => state.inventoryReducer);
  const pricing = useSelector((state: any) => state.pricingReducer);
  const settings = useSelector((state: any) => state.settingsReducer);
  const [preferences, setPreferences] = useState<PortfolioPreferences>({ currency: 'USD', source: 'steam_listing' });
  const [transactions, setTransactions] = useState<TrackerTransaction[]>([]);
  const [currencyRate, setCurrencyRate] = useState(1);
  const [range, setRange] = useState('All');
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);

  useEffect(() => {
    Promise.all([
      window.electron.store.get(PORTFOLIO_SETTINGS_KEY),
      window.electron.store.get(TRANSACTIONS_KEY),
      window.electron.store.get(SNAPSHOTS_KEY),
    ]).then(([savedPreferences, savedTransactions, savedSnapshots]) => {
      if (savedPreferences && typeof savedPreferences === 'object') {
        setPreferences(savedPreferences as PortfolioPreferences);
      }
      if (Array.isArray(savedTransactions)) setTransactions(savedTransactions as TrackerTransaction[]);
      if (Array.isArray(savedSnapshots)) setSnapshots(savedSnapshots as PortfolioSnapshot[]);
    });

    const onPreferenceChange = (event: Event) => {
      setPreferences((event as CustomEvent<PortfolioPreferences>).detail);
    };
    const onTransactionChange = (event: Event) => {
      setTransactions((event as CustomEvent<TrackerTransaction[]>).detail);
    };
    window.addEventListener('casemove-portfolio-preferences', onPreferenceChange);
    window.addEventListener('casemove-tracker-transactions', onTransactionChange);
    return () => {
      window.removeEventListener('casemove-portfolio-preferences', onPreferenceChange);
      window.removeEventListener('casemove-tracker-transactions', onTransactionChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    window.electron.ipcRenderer.convertCurrency('USD', preferences.currency, 1)
      .then((rate: number) => {
        if (!cancelled && Number.isFinite(Number(rate))) setCurrencyRate(Number(rate));
      })
      .catch(() => {
        if (!cancelled && preferences.currency === 'USD') setCurrencyRate(1);
      });
    return () => { cancelled = true; };
  }, [preferences.currency]);

  const currentPortfolioUsd = useMemo(() => [
    ...(inventory.inventory || []).filter(isValuableItem),
    ...(inventory.storageInventoryRaw || []).filter(isValuableItem),
  ].reduce((total, item: ItemRow) => {
    const priceKey = `${item.item_name || ''}${item.item_wear_name || ''}`;
    const sourcePrices = pricing.prices?.[priceKey] || {};
    const selectedPrice = Number(sourcePrices[preferences.source]);
    const price = Number.isFinite(selectedPrice) && selectedPrice > 0
      ? selectedPrice
      : Number(sourcePrices.skinport);
    return Number.isFinite(price) && price > 0 ? total + price : total;
  }, 0), [inventory.inventory, inventory.storageInventoryRaw, preferences.source, pricing.prices]);
  const investedNowUsd = useMemo(() => getInvestedUsd(transactions), [transactions]);

  // A real multi-month chart cannot be reconstructed from a current quote.
  // Save one local daily snapshot from now on, replacing today's point when
  // prices refresh, so the chart becomes a true portfolio history over time.
  useEffect(() => {
    if (!Number.isFinite(currentPortfolioUsd) || currentPortfolioUsd <= 0) return;
    const today = new Date().toISOString().slice(0, 10);
    setSnapshots((current) => {
      const next = [
        ...current.filter((snapshot) => !(snapshot.source === preferences.source && snapshot.date === today)),
        { date: today, source: preferences.source, valueUsd: currentPortfolioUsd, investedUsd: investedNowUsd },
      ].sort((left, right) => left.date.localeCompare(right.date));
      window.electron.store.set(SNAPSHOTS_KEY, next);
      return next;
    });
  }, [currentPortfolioUsd, investedNowUsd, preferences.source]);

  const history = useMemo(() => {
    const positions: Record<string, Position> = {};
    return [...transactions]
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map((transaction) => {
        const position = positions[transaction.itemKey] || { quantity: 0, costUsd: 0 };
        if (transaction.kind === 'purchase') {
          position.quantity += transaction.quantity;
          position.costUsd += transaction.quantity * transaction.pricePerItemUsd;
        } else if (position.quantity > 0) {
          const quantitySold = Math.min(transaction.quantity, position.quantity);
          position.costUsd -= quantitySold * transaction.pricePerItemUsd;
          position.quantity -= quantitySold;
        }
        positions[transaction.itemKey] = position;

        const trackedMarketValueUsd = Object.entries(positions).reduce((total, [itemKey, trackedPosition]) => {
          const sourceTransaction = transactions.find((entry) => entry.itemKey === itemKey);
          const priceKey = `${sourceTransaction?.itemName || ''}${sourceTransaction?.wearName || ''}`;
          const sourcePrices = pricing.prices?.[priceKey] || {};
          const selectedPrice = Number(sourcePrices[preferences.source]);
          const price = Number.isFinite(selectedPrice) && selectedPrice > 0
            ? selectedPrice
            : Number(sourcePrices.skinport);
          return Number.isFinite(price) && price > 0
            ? total + trackedPosition.quantity * price
            : total;
        }, 0);
        const investedUsd = Object.values(positions).reduce((total, current) => total + current.costUsd, 0);
        return { date: new Date(transaction.createdAt), investedUsd, marketValueUsd: trackedMarketValueUsd };
      });
  }, [preferences.source, pricing.prices, transactions]);

  const chartTextColor = document.documentElement.classList.contains('dark') ? '#cbd5e1' : '#374151';
  const snapshotHistory = useMemo(() => snapshots
    .filter((snapshot) => snapshot.source === preferences.source)
    .map((snapshot) => ({
      date: new Date(`${snapshot.date}T12:00:00`),
      investedUsd: snapshot.investedUsd,
      marketValueUsd: snapshot.valueUsd,
    })), [preferences.source, snapshots]);
  const chartHistory = snapshotHistory.length ? snapshotHistory : history;
  const rangeDays = { '24H': 1, '7D': 7, '30D': 30, '90D': 90, '1Y': 365, All: 0 };
  const visibleHistory = useMemo(() => {
    const days = rangeDays[range];
    if (!days) return chartHistory;
    const after = Date.now() - days * 24 * 60 * 60 * 1000;
    return chartHistory.filter((point) => point.date.getTime() >= after);
  }, [chartHistory, range]);
  const formatter = new Intl.NumberFormat(settings.locale || 'en-GB', {
    style: 'currency',
    currency: preferences.currency,
  });
  const labels = visibleHistory.length
    ? visibleHistory.map((point) => point.date.toLocaleDateString(settings.locale || 'en-GB', { day: 'numeric', month: 'short', year: '2-digit' }))
    : ['Today'];
  const investedValues = visibleHistory.length ? visibleHistory.map((point) => point.investedUsd * currencyRate) : [0];
  const marketValues = visibleHistory.length ? visibleHistory.map((point) => point.marketValueUsd * currencyRate) : [currentPortfolioUsd * currencyRate];

  return (
    <div className="h-[430px] p-4">
      <div className="mb-3 flex flex-wrap justify-end gap-1">
        {Object.keys(rangeDays).map((rangeOption) => (
          <button
            key={rangeOption}
            type="button"
            onClick={() => setRange(rangeOption)}
            className={`rounded px-3 py-1 text-xs font-medium ${range === rangeOption ? 'bg-slate-600 text-white dark:bg-slate-600' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-dark-level-two'}`}
          >
            {rangeOption}
          </button>
        ))}
      </div>
      <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">Market value and invested amount are saved as a local daily snapshot after prices load.</p>
      <div className="h-[370px]">
        <Line
          data={{
        labels,
        datasets: [
          {
            label: 'Invested',
            data: investedValues,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            stepped: true,
          },
          {
            label: 'Market value',
            data: marketValues,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.12)',
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            fill: true,
            tension: 0.25,
          },
        ],
      }}
          options={{
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: chartTextColor } },
          title: { display: true, text: 'Portfolio history', color: chartTextColor },
          tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${formatter.format(Number(context.raw || 0))}` } },
        },
        scales: {
          x: { ticks: { color: chartTextColor, maxRotation: 0 }, grid: { color: 'rgba(148, 163, 184, 0.12)' } },
          y: {
            beginAtZero: true,
            ticks: { color: chartTextColor, callback: (value) => formatter.format(Number(value)) },
            grid: { color: 'rgba(148, 163, 184, 0.12)' },
          },
        },
          }}
        />
      </div>
    </div>
  );
}
