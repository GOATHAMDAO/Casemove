import { CurrencyDollarIcon } from '@heroicons/react/solid';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import DarkSelect from '../../components/content/shared/darkSelect';
import { ItemRow } from '../../interfaces/items';

const STORAGE_KEY = 'overview.portfolio-value.v1';

const currencies = [
  'USD', 'EUR', 'GBP', 'PLN', 'CZK', 'RUB', 'UAH', 'CAD', 'AUD', 'JPY',
  'CNY', 'KRW', 'TRY', 'CHF', 'SEK', 'NOK', 'DKK', 'HUF', 'RON', 'BRL',
  'MXN', 'INR', 'AED', 'SAR', 'KZT',
];

const priceSources = [
  { key: 'steam_listing', label: 'Steam Community Market' },
  { key: 'buff163', label: 'BUFF.163' },
  { key: 'skinport', label: 'Skinport' },
  { key: 'csfloat', label: 'CSFloat' },
];

type PortfolioPreferences = {
  currency: string;
  source: string;
};

function isValuableItem(item: ItemRow) {
  const imagePath = item.item_url || '';
  const itemName = item.item_name || '';
  return !imagePath.includes('weapons/base_weapons')
    && imagePath !== 'econ/tools/casket'
    && !/(service medal|veteran coin|loyalty badge|operation .* coin|pick'em trophy)/i.test(itemName);
}

export default function PortfolioValue() {
  const inventory = useSelector((state: any) => state.inventoryReducer);
  const pricing = useSelector((state: any) => state.pricingReducer);
  const settings = useSelector((state: any) => state.settingsReducer);
  const [preferences, setPreferences] = useState<PortfolioPreferences>({
    currency: settings.currency || 'USD',
    source: 'steam_listing',
  });
  const [ready, setReady] = useState(false);
  const [currencyRate, setCurrencyRate] = useState(1);
  const [rateLoading, setRateLoading] = useState(false);
  const [csfloatConfigured, setCsfloatConfigured] = useState(false);
  const requestedItemsKey = useRef('');

  useEffect(() => {
    window.electron.store.get(STORAGE_KEY).then((savedPreferences: unknown) => {
      if (savedPreferences && typeof savedPreferences === 'object') {
        const value = savedPreferences as PortfolioPreferences;
        setPreferences({
          currency: currencies.includes(value.currency) ? value.currency : (settings.currency || 'USD'),
          source: priceSources.some((source) => source.key === value.source) ? value.source : 'steam_listing',
        });
      }
      setReady(true);
    });
  }, []);

  useEffect(() => {
    window.electron.ipcRenderer.csFloatApiKeyConfigured()
      .then((configured: boolean) => setCsfloatConfigured(Boolean(configured)))
      .catch(() => setCsfloatConfigured(false));
  }, []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setRateLoading(true);
    window.electron.store.set(STORAGE_KEY, preferences);
    window.electron.ipcRenderer
      .convertCurrency('USD', preferences.currency, 1)
      .then((rate: number) => {
        if (!cancelled && Number.isFinite(Number(rate))) setCurrencyRate(Number(rate));
      })
      .catch(() => {
        if (!cancelled && preferences.currency === 'USD') setCurrencyRate(1);
      })
      .finally(() => {
        if (!cancelled) setRateLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preferences, ready]);

  const itemsToPrice = useMemo(() => {
    const seenPriceKeys = new Set<string>();
    return [
      ...(inventory.inventory || []),
      ...(inventory.storageInventoryRaw || []),
    ].filter(isValuableItem).filter((item: ItemRow) => {
      const priceKey = `${item.item_name || ''}${item.item_wear_name || ''}`;
      if (seenPriceKeys.has(priceKey)) return false;
      seenPriceKeys.add(priceKey);
      return true;
    });
  }, [inventory.inventory, inventory.storageInventoryRaw]);

  // Overview previously rendered only counts. Send a direct request instead
  // of relying on the persisted table-view request cache, which may contain
  // stale failed requests from an older session.
  useEffect(() => {
    if (!itemsToPrice.length) return;
    const requestKey = `${preferences.source}|${itemsToPrice
      .map((item: ItemRow) => `${item.item_name || ''}${item.item_wear_name || ''}`)
      .sort()
      .join('|')}`;
    if (requestKey === requestedItemsKey.current) return;
    requestedItemsKey.current = requestKey;
    window.electron.ipcRenderer.getPrice(itemsToPrice, {
      includeCSFloat: preferences.source === 'csfloat' && csfloatConfigured,
    });
  }, [csfloatConfigured, itemsToPrice, preferences.source]);

  const portfolio = useMemo(() => {
    const uniqueItems = [
      ...(inventory.inventory || []).filter(isValuableItem),
      ...(inventory.storageInventoryRaw || []).filter(isValuableItem),
    ];
    return uniqueItems.reduce(
      (result, item: ItemRow) => {
        const priceKey = `${item.item_name || ''}${item.item_wear_name || ''}`;
        const sourcePrices = pricing.prices?.[priceKey] || {};
        const selectedPrice = Number(sourcePrices[preferences.source]);
        const skinportFallbackPrice = Number(sourcePrices.skinport);
        const price = Number.isFinite(selectedPrice) && selectedPrice > 0
          ? selectedPrice
          : skinportFallbackPrice;
        if (Number.isFinite(price) && price > 0) {
          result.valueUsd += price;
          result.pricedItems += 1;
          if (!(Number.isFinite(selectedPrice) && selectedPrice > 0) && skinportFallbackPrice > 0) {
            result.fallbackItems += 1;
          }
        }
        result.totalItems += 1;
        return result;
      },
      { valueUsd: 0, pricedItems: 0, fallbackItems: 0, totalItems: 0 },
    );
  }, [inventory.inventory, inventory.storageInventoryRaw, preferences.source, pricing.prices]);

  const formatValue = new Intl.NumberFormat(settings.locale || 'en-GB', {
    style: 'currency',
    currency: preferences.currency,
  }).format(portfolio.valueUsd * currencyRate);

  function updatePreference(key: keyof PortfolioPreferences, value: string) {
    setPreferences((current) => {
      const next = { ...current, [key]: value };
      window.dispatchEvent(new CustomEvent('casemove-portfolio-preferences', { detail: next }));
      return next;
    });
  }

  return (
    <div className="bg-white shadow dark:bg-dark-level-three">
      <div className="p-5">
        <div className="flex items-start">
          <div className="shrink-0">
            <CurrencyDollarIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
          </div>
          <div className="ml-5 min-w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-900 dark:text-dark-white">Portfolio value</dt>
              <dd className="mt-1 text-lg font-medium text-green-500">
                {rateLoading ? 'Updating…' : formatValue}
              </dd>
              <dd className="mt-1 text-xs text-gray-500">
                {portfolio.pricedItems} / {portfolio.totalItems} items priced
              </dd>
              {portfolio.fallbackItems > 0 && (
                <dd className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  {portfolio.fallbackItems} item(s) valued with Skinport fallback
                </dd>
              )}
            </dl>
            <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              <div className="text-gray-500">
                Currency
                <DarkSelect
                  value={preferences.currency}
                  onChange={(value) => updatePreference('currency', value)}
                  options={currencies.map((currency) => ({ value: currency, label: currency }))}
                  className="mt-1"
                />
              </div>
              <div className="text-gray-500">
                Market
                <DarkSelect
                  value={preferences.source}
                  onChange={(value) => updatePreference('source', value)}
                  options={priceSources.map((source) => ({ value: source.key, label: source.label }))}
                  className="mt-1"
                />
              </div>
            </div>
            {preferences.source === 'csfloat' && !csfloatConfigured && (
              <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                Add a CSFloat API key in Settings to load CSFloat prices.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
