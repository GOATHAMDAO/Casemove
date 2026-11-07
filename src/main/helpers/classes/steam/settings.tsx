import Store from 'electron-store'
import { safeStorage } from 'electron';
import axios from 'axios';

import { DOMParser } from 'xmldom';
import { WithImplicitCoercion } from 'buffer';

type SteamProfileDetails = {
  displayName?: string;
  imageURL?: string;
};

async function getSteamProfileDetails(steamID: string): Promise<SteamProfileDetails> {
  try {
    const response = await axios.get(`https://steamcommunity.com/profiles/${steamID}/?xml=1`, {
      timeout: 8000,
    });
    const profile = new DOMParser()
      .parseFromString(response.data, 'text/xml')
      .getElementsByTagName('profile')[0];

    if (!profile) {
      return {};
    }

    return {
      displayName: profile.getElementsByTagName('steamID')[0]?.childNodes[0]?.nodeValue || undefined,
      imageURL: profile.getElementsByTagName('avatarMedium')[0]?.childNodes[0]?.nodeValue || undefined,
    };
  } catch (error) {
    console.warn(`Unable to refresh Steam profile ${steamID}`, error.message);
    return {};
  }
}

let savedProfileRefreshPromise: Promise<Record<string, any>> | undefined;
// Define store
const store = new Store({
  name: 'casemoveEnc',
  watch: true,
  encryptionKey: 'this_only_obfuscates',
});

// Store user data
export async function storeRefreshToken(username: string, loginKey?: string) {
  // Get account details
  let accountDetails = store.get('account');
  if (!accountDetails) {
    accountDetails = {};
  }

  if (!accountDetails[username]) {
    accountDetails[username] = {};
  }

  if (loginKey) {
    // Encrypt sensitive data
    const buffer = safeStorage.encryptString(loginKey);

    // Add to account details
    accountDetails[username]['refreshToken'] = buffer.toString('latin1')
  } else {
    if (accountDetails[username]['refreshToken']) {
      delete accountDetails[username]['refreshToken']
    }
  }

  // Set store
  console.log('saving refreshToken')
  store.set({
    account: accountDetails,
  });
}

// Store user data
export async function storeUserAccount(
  username,
  displayName,
  steamID,
  secretKey: string | null
) {
  // Get account details
  let accountDetails = store.get('account');
  if (accountDetails == undefined) {
    accountDetails = {};
  }

  if (accountDetails[username] == undefined) {
    accountDetails[username] = {};
  }

  // Do not clear an already cached avatar if Steam is temporarily unavailable.
  const profileDetails = await getSteamProfileDetails(String(steamID));
  const imageURL = profileDetails.imageURL || accountDetails[username]['imageURL'];

  // Add to account details
  accountDetails[username]['displayName'] = profileDetails.displayName || displayName;
  accountDetails[username]['imageURL'] = imageURL;
  // Keep the SteamID alongside the saved refresh token. It lets the transfer
  // screen verify that a saved trade link really belongs to this profile.
  accountDetails[username]['steamID'] = String(steamID);
  // Encrypt sensitive data
  if (secretKey) {
    const dictToWrite = {
      secretKey: secretKey,
    };
    const buffer = safeStorage.encryptString(JSON.stringify(dictToWrite));
    accountDetails[username]['safeData'] = buffer.toString('latin1');
  }

  // Set store
  console.log('Saving regular')
  store.set({
    account: accountDetails,
  });
}

// Older saved sessions may predate profile metadata. Refresh it when the
// profile picker opens so every saved Steam account gets its own avatar.
export function refreshSavedProfileDetails(): Promise<Record<string, any>> {
  if (savedProfileRefreshPromise) {
    return savedProfileRefreshPromise;
  }

  savedProfileRefreshPromise = (async () => {
    const accountDetails = (store.get('account') || {}) as Record<string, any>;
    let hasChanges = false;

    const profiles = await Promise.all(
      Object.values(accountDetails).map(async (account) => ({
        account,
        profileDetails: account?.steamID
          ? await getSteamProfileDetails(String(account.steamID))
          : {},
      })),
    );

    for (const { account, profileDetails } of profiles) {
      if (profileDetails.imageURL && profileDetails.imageURL !== account.imageURL) {
        account.imageURL = profileDetails.imageURL;
        hasChanges = true;
      }
      if (profileDetails.displayName && profileDetails.displayName !== account.displayName) {
        account.displayName = profileDetails.displayName;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      store.set('account', accountDetails);
    }

    return accountDetails;
  })();

  return savedProfileRefreshPromise.finally(() => {
    savedProfileRefreshPromise = undefined;
  });
}

export async function setAccountPosition(username, newPosition) {
  let accountDetails = store.get('account');
  if (accountDetails == undefined) {
    accountDetails = {};
  }

  // Add to account details
  accountDetails[username]['position'] = newPosition;

  // Set store
  store.set({
    account: accountDetails,
  });
}

export async function setAccountTradeURL(username: string, tradeURL: string) {
  const accountDetails = store.get('account') || {};
  if (!accountDetails[username]) {
    throw new Error('Saved Steam profile was not found');
  }

  accountDetails[username]['tradeURL'] = tradeURL;
  store.set({ account: accountDetails });
}

export async function setAccountInventoryCapacity(username: string, capacity: {
  inventorySlots: number;
  freeSlots: number;
  limit: number;
  updatedAt: string;
}, steamID?: string) {
  const accountDetails = store.get('account') || {};
  if (!accountDetails[username]) {
    throw new Error('Saved Steam profile was not found');
  }

  accountDetails[username]['inventoryCapacity'] = capacity;
  if (steamID) {
    accountDetails[username]['steamID'] = steamID;
  }
  store.set({ account: accountDetails });
}

// Delete user data
export async function deleteUserData(username) {
  let statusCode = 0;

  // Get account details
  let accountDetails = store.get('account');
  if (
    typeof accountDetails === 'object' &&
    Object.keys(accountDetails).includes(username)
  ) {
    delete accountDetails[username];

    store.set('account', accountDetails);
    statusCode = 1;
  }
  return statusCode;
}

// Get login details
export async function getLoginDetails(username) {
  const secretData = safeStorage.decryptString(
    Buffer.from(store.get('account.' + username + '.safeData') as WithImplicitCoercion<string>, 'latin1')
  );
  return JSON.parse(secretData);
}
// Get login details
export async function getRefreshToken(username) {
  const secretData = safeStorage.decryptString(
    Buffer.from(store.get('account.' + username + '.refreshToken' ) as WithImplicitCoercion<string>, 'latin1')
  );
  return secretData;
}

const CSFLOAT_API_KEY_STORAGE = 'secrets.csfloatApiKey';
const PRICEMPIRE_API_KEY_STORAGE = 'secrets.pricempireApiKey';
const PRICEMPIRE_EXCLUDED_PORTFOLIOS_STORAGE = 'reports.pricempireExcludedPortfolios';
const DEFAULT_PRICEMPIRE_EXCLUDED_PORTFOLIOS = ['Архив Армори Наклы'];

export async function setCSFloatApiKey(apiKey: string) {
  if (!apiKey) {
    store.delete(CSFLOAT_API_KEY_STORAGE);
    return;
  }
  const encryptedKey = safeStorage.encryptString(apiKey);
  store.set(CSFLOAT_API_KEY_STORAGE, encryptedKey.toString('latin1'));
}

export async function getCSFloatApiKey() {
  const storedKey = store.get(CSFLOAT_API_KEY_STORAGE) as string | undefined;
  if (!storedKey) return '';
  try {
    return safeStorage.decryptString(Buffer.from(storedKey, 'latin1'));
  } catch {
    return '';
  }
}

export async function setPriceEmpireApiKey(apiKey: string) {
  if (!apiKey) {
    store.delete(PRICEMPIRE_API_KEY_STORAGE);
    return;
  }
  const encryptedKey = safeStorage.encryptString(apiKey);
  store.set(PRICEMPIRE_API_KEY_STORAGE, encryptedKey.toString('latin1'));
}

export async function getPriceEmpireApiKey() {
  const storedKey = store.get(PRICEMPIRE_API_KEY_STORAGE) as string | undefined;
  if (!storedKey) return '';
  try {
    return safeStorage.decryptString(Buffer.from(storedKey, 'latin1'));
  } catch {
    return '';
  }
}

export async function setPriceEmpireExcludedPortfolios(portfolioNames: string[]) {
  const names = Array.from(new Set(
    (Array.isArray(portfolioNames) ? portfolioNames : [])
      .map((name) => String(name || '').trim())
      .filter(Boolean),
  ));
  store.set(PRICEMPIRE_EXCLUDED_PORTFOLIOS_STORAGE, names);
}

export async function getPriceEmpireExcludedPortfolios() {
  const storedNames = store.get(PRICEMPIRE_EXCLUDED_PORTFOLIOS_STORAGE);
  if (!Array.isArray(storedNames)) return DEFAULT_PRICEMPIRE_EXCLUDED_PORTFOLIOS;
  return storedNames.map((name) => String(name || '').trim()).filter(Boolean);
}

// Get all account details
export async function getAllAccountDetails() {
  return store.get('account');
}

export async function setValue(stringToSet, valueToSet) {
  store.set(stringToSet, valueToSet);
}

export async function getValue(stringToGet) {
  return store.get(stringToGet);
}
