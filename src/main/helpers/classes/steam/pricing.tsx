import { getValue, setValue } from './settings';
import axios from 'axios';
import EventEmitter from 'events';
import dotenv from 'dotenv';
dotenv.config()

class MyEmitter extends EventEmitter {}
export const pricingEmitter = new MyEmitter();

// Get latest prices, if fail use backup

export async function getPricesBackup(cas) {
  const pricesBackup = require('./backup/prices.json');
  await cas.setPricing(pricesBackup);
  return pricesBackup;
}
export async function getPrices(cas) {
  const url = 'https://cdn.skinledger.com/casemove/prices.json';
  try {
    const response = await axios.get(url);
    console.log('prices, response', typeof response === 'object', response !== null);
    if (typeof response === 'object' && response !== null) {
      await cas.setPricing(response.data, 'normal');
      return response.data;
    }
  } catch (error) {
    console.log('Error prices', error);
  }
  return getPricesBackup(cas);
}

// Skinport publishes an unauthenticated CS2 item catalog. It fills gaps for
// newly released items that have not reached Casemove's aggregated catalog.
async function getSkinportFallbackPrices(cas) {
  try {
    const response = await axios.get('https://api.skinport.com/v1/items', {
      params: { app_id: 730, currency: 'USD', tradable: false },
      headers: { 'Accept-Encoding': 'br' },
      timeout: 30000,
    });
    if (Array.isArray(response.data)) {
      cas.setSkinportFallbackPrices(response.data);
    }
  } catch (error) {
    console.log('Error loading Skinport fallback prices', error);
  }
}

export let currencyCodes = {
  1: 'USD',
  2: 'GBP',
  3: 'EUR',
  4: 'CHF',
  5: 'RUB',
  6: 'PLN',
  7: 'BRL',
  8: 'JPY',
  9: 'NOK',
  10: 'IDR',
  11: 'MYR',
  12: 'PHP',
  13: 'SGD',
  14: 'THB',
  15: 'VND',
  16: 'KRW',
  17: 'TRY',
  18: 'UAH',
  19: 'MXN',
  20: 'CAD',
  21: 'AUD',
  22: 'NZD',
  23: 'CNY',
  24: 'INR',
  25: 'CLP',
  26: 'PEN',
  27: 'COP',
  28: 'ZAR',
  29: 'HKD',
  30: 'TWD',
  31: 'SAR',
  32: 'AED',
  33: 'SEK',
  34: 'ARS',
  35: 'ILS',
  36: 'BYN',
  37: 'KZT',
  38: 'KWD',
  39: 'QAR',
  40: 'CRC',
  41: 'UYU',
  42: 'BGN',
  43: 'HRK',
  44: 'CZK',
  45: 'DKK',
  46: 'HUF',
  47: 'RON',
};

// import { DOMParser } from 'xmldom'
// RUN PROGRAMS
export class runItems {
  steamUser;
  seenItems;
  packageToSend;
  header;
  currency;
  headers;
  prices;
  pricesReady: Promise<any>;
  skinportFallbackReady: Promise<void>;
  skinportFallbackPrices = {};
  csfloatApiKey = '';
  csfloatPrices = {};
  csfloatPending = {};
  csfloatQueue: Promise<void> = Promise.resolve();

  constructor(steamUser) {
    this.steamUser = steamUser;
    this.seenItems = {};
    this.packageToSend = {};
    this.pricesReady = getPrices(this);
    this.skinportFallbackReady = getSkinportFallbackPrices(this);
    getValue('pricing.currency').then((returnValue) => {
      if (returnValue == undefined && steamUser?.wallet?.currency) {
        setValue('pricing.currency', currencyCodes[steamUser.wallet.currency]);
      }
    });
  }
  async setPricing(pricingData, commandFrom) {
    console.log('pricingSet', commandFrom);
    this.prices = pricingData;
  }
  setSkinportFallbackPrices(items) {
    this.skinportFallbackPrices = items.reduce((result, item) => {
      if (item?.market_hash_name) result[item.market_hash_name] = item;
      return result;
    }, {});
  }
  setCSFloatApiKey(apiKey: string) {
    this.csfloatApiKey = apiKey;
    this.csfloatPrices = {};
    this.csfloatPending = {};
  }
  async getCSFloatPrice(marketHashName: string) {
    if (!this.csfloatApiKey || !marketHashName) return 0;
    if (this.csfloatPrices[marketHashName] !== undefined) {
      return this.csfloatPrices[marketHashName];
    }
    if (this.csfloatPending[marketHashName]) {
      return this.csfloatPending[marketHashName];
    }

    const request = this.csfloatQueue
      .then(async () => {
        try {
          const response = await axios.get('https://csfloat.com/api/v1/listings', {
            params: {
              market_hash_name: marketHashName,
              sort_by: 'lowest_price',
              limit: 1,
            },
            headers: { Authorization: this.csfloatApiKey },
            timeout: 12000,
          });
          const listings = Array.isArray(response.data)
            ? response.data
            : response.data?.data || [];
          const lowestPrice = Number(listings[0]?.price);
          const priceUsd = Number.isFinite(lowestPrice) && lowestPrice > 0
            ? lowestPrice / 100
            : 0;
          this.csfloatPrices[marketHashName] = priceUsd;
          return priceUsd;
        } catch (error) {
          console.log('Error loading CSFloat price', marketHashName, error?.response?.status || error?.message);
          this.csfloatPrices[marketHashName] = 0;
          return 0;
        } finally {
          delete this.csfloatPending[marketHashName];
        }
      });
    // Keep requests below marketplace limits. Cached values make later
    // portfolio refreshes instant without reusing the API key in the renderer.
    this.csfloatQueue = request.then(
      () => new Promise((resolve) => setTimeout(resolve, 300)),
      () => new Promise((resolve) => setTimeout(resolve, 300)),
    );
    this.csfloatPending[marketHashName] = request;
    return request;
  }
  async makeSinglerequest(itemRow, options: { includeCSFloat?: boolean } = {}) {
    await this.pricesReady;
    this.prices = this.prices || {};
    let itemNamePricing = itemRow.item_name.replaceAll(
      '(Holo/Foil)',
      '(Holo-Foil)'
    );
    if (itemRow.item_wear_name !== undefined) {
      itemNamePricing = itemRow.item_name + ' (' + itemRow.item_wear_name + ')';
      if (!this.prices[itemNamePricing] && this.prices[itemRow.item_name]) {
        itemNamePricing = itemRow.item_name;
      }
    }

    if (this.prices[itemNamePricing] !== undefined) {
      let pricingDict = {
        buff163: this.prices[itemNamePricing]?.buff163?.starting_at?.price,
        steam_listing: this.prices[itemNamePricing]?.steam?.last_90d,
        skinport: this.prices[itemNamePricing]?.skinport?.starting_at,
        csfloat: options.includeCSFloat ? await this.getCSFloatPrice(itemNamePricing) : 0,
        bitskins: 0,
      };
      if (this.prices[itemNamePricing]?.steam?.last_30d) {
        pricingDict.steam_listing =
          this.prices[itemNamePricing]?.steam?.last_30d;
      }
      if (this.prices[itemNamePricing]?.steam?.last_7d) {
        pricingDict.steam_listing =
          this.prices[itemNamePricing]?.steam?.last_7d;
      }

      if (this.prices[itemNamePricing]?.steam?.last_24h) {
        pricingDict.steam_listing =
          this.prices[itemNamePricing]?.steam?.last_24h;
      }
      if (
        this.prices[itemNamePricing]?.steam?.last_7d == 0 &&
        this.prices[itemNamePricing]?.buff163?.starting_at?.price > 2000
      ) {
        pricingDict.steam_listing = this.prices[itemNamePricing]?.buff163.starting_at?.price * 0.8;
      }
      itemRow['pricing'] = pricingDict;
      return itemRow;
    } else {
      await this.skinportFallbackReady;
      const fallback = this.skinportFallbackPrices[itemNamePricing]
        || this.skinportFallbackPrices[itemRow.item_name];
      const fallbackPrice = Number(
        fallback?.min_price ?? fallback?.suggested_price ?? fallback?.mean_price,
      );
      let pricingDict = {
        buff163: 0,
        steam_listing: 0,
        skinport: Number.isFinite(fallbackPrice) && fallbackPrice > 0 ? fallbackPrice : 0,
        csfloat: options.includeCSFloat ? await this.getCSFloatPrice(itemNamePricing) : 0,
        bitskins: 0,
      };
      itemRow['pricing'] = pricingDict;
      return itemRow;
    }
  }
  async handleItem(itemRow, options: { includeCSFloat?: boolean } = {}) {
    const priceableItems = itemRow.filter(
      (element) => element.item_name !== undefined,
    );
    // Large accounts can contain tens of thousands of items. Sending one huge
    // response only after every price is ready leaves the Overview at 0 for a
    // long time. Emit short batches so the portfolio fills progressively.
    const batchSize = 250;
    for (let index = 0; index < priceableItems.length; index += batchSize) {
      const batch = priceableItems.slice(index, index + batchSize);
      await Promise.all(batch.map((element) => this.makeSinglerequest(element, options)));
      pricingEmitter.emit('result', batch);
    }
  }

  async handleTradeUp(itemRow) {
    let returnRows = [] as any;
    itemRow.forEach((element) => {
      this.makeSinglerequest(element).then((returnValue) => {
        returnRows.push(returnValue);
      });
    });
    pricingEmitter.emit('result', itemRow);
  }
}
