import axios from 'axios';

type PriceEmpirePortfolio = {
  slug?: string;
  name?: string;
};

function normalisePortfolioIdentifier(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

type PriceEmpirePortfolioItem = {
  market_hash_name?: string;
  holdings?: number | string;
  quantity?: number | string;
  stats?: {
    holdings?: number | string;
  };
};

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object' && Array.isArray((value as { data?: unknown }).data)) {
    return (value as { data: T[] }).data;
  }
  return [];
}

function getQuantity(item: PriceEmpirePortfolioItem) {
  const quantity = Number(item.stats?.holdings ?? item.holdings ?? item.quantity ?? 0);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
}

/** Reads every portfolio available to the API key and adds identical item variants together. */
export async function getPriceEmpirePortfolioItems(apiKey: string, excludedPortfolioIdentifiers: string[] = []) {
  const client = axios.create({
    baseURL: 'https://api.pricempire.com/v4/trader',
    timeout: 20000,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  const portfoliosResponse = await client.get('/portfolios');
  const excludedPortfolios = new Set(
    excludedPortfolioIdentifiers.map(normalisePortfolioIdentifier).filter(Boolean),
  );
  const availablePortfolios = asArray<PriceEmpirePortfolio>(portfoliosResponse.data)
    .filter((portfolio) => typeof portfolio.slug === 'string' && portfolio.slug.length > 0);
  const portfolios = availablePortfolios
    .filter((portfolio) => !excludedPortfolios.has(normalisePortfolioIdentifier(portfolio.slug!)))
    .filter((portfolio) => !portfolio.name || !excludedPortfolios.has(normalisePortfolioIdentifier(portfolio.name)));
  const quantities = new Map<string, number>();

  for (const portfolio of portfolios) {
    const detailResponse = await client.get(`/portfolios/${encodeURIComponent(portfolio.slug!)}`);
    const detail = detailResponse.data as { items?: unknown };
    asArray<PriceEmpirePortfolioItem>(detail?.items).forEach((item) => {
      const itemName = item.market_hash_name?.trim();
      const quantity = getQuantity(item);
      if (!itemName || quantity === 0) return;
      quantities.set(itemName, (quantities.get(itemName) || 0) + quantity);
    });
  }

  return {
    quantities,
    portfolioCount: portfolios.length,
    excludedPortfolioCount: availablePortfolios.length - portfolios.length,
  };
}

/** Avoid exposing response details that might include request credentials. */
export function getPriceEmpireErrorMessage(error: any) {
  const status = error?.response?.status;
  if (status === 401) return 'PriceEmpire rejected the saved API key.';
  if (status === 403) return 'The saved PriceEmpire key does not have Portfolio API access.';
  if (status === 429) return 'PriceEmpire API rate limit was reached. Try the export again later.';
  if (status) return `PriceEmpire portfolio request failed (HTTP ${status}).`;
  return 'Could not connect to PriceEmpire. Check the internet connection and try again.';
}

export function reportItemKey(itemName: string) {
  return itemName
    .replace(/,\s*(Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)$/i, ' ($1)')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();
}
