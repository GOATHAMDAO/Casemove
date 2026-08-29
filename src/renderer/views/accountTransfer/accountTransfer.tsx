import { CheckIcon, ExclamationCircleIcon, RefreshIcon } from '@heroicons/react/solid';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { createCSGOImage } from '../../functionsClasses/createCSGOImage';

type SavedAccount = {
  displayName?: string;
  imageURL?: string;
  steamID?: string;
  tradeURL?: string;
  inventoryCapacity?: InventoryCapacity;
};

type InventoryCapacity = {
  inventorySlots: number;
  freeSlots: number;
  limit: number;
  updatedAt: string;
};

function isTradeLocked(item: any) {
  return item.trade_unlock && new Date(item.trade_unlock).getTime() > Date.now();
}

function isStorageUnit(item: any) {
  return Boolean(item.item_url?.includes('casket'));
}

function isTransferableNow(item: any) {
  return Boolean(
    item.item_moveable &&
    !isTradeLocked(item) &&
    !isStorageUnit(item) &&
    (item.combined_ids || []).length,
  );
}

export default function AccountTransferPage() {
  const auth = useSelector((state: any) => state.authReducer);
  const inventory = useSelector((state: any) => state.inventoryReducer);
  const [accounts, setAccounts] = useState<Record<string, SavedAccount>>({});
  const [recipient, setRecipient] = useState('');
  const [tradeURL, setTradeURL] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIDs, setSelectedIDs] = useState<Set<string>>(new Set());
  const [savingLink, setSavingLink] = useState(false);
  const [sending, setSending] = useState(false);
  const [capacityLoading, setCapacityLoading] = useState(false);
  const [recipientCapacity, setRecipientCapacity] = useState<InventoryCapacity | null>(null);
  const [message, setMessage] = useState('');
  const capacityRequestNumber = useRef(0);

  const loadAccounts = async () => {
    const saved = await window.electron.ipcRenderer.getAccountDetails() as Record<string, SavedAccount>;
    setAccounts(saved || {});
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const recipients = useMemo(
    () => Object.entries(accounts).filter(([, account]) => account.steamID !== String(auth.steamID)),
    [accounts, auth.steamID],
  );
  const selectedRecipient = accounts[recipient];
  const transferableItems = useMemo(
    () => (inventory.combinedInventory || []).filter(isTransferableNow),
    [inventory.combinedInventory],
  );
  const transferableIDs = useMemo(
    () => new Set(transferableItems.flatMap((item: any) => (item.combined_ids || []).map(String))),
    [transferableItems],
  );
  const visibleItems = useMemo(() => {
    const searchText = search.trim().toLowerCase();
    return transferableItems.filter((item: any) =>
      !searchText || String(item.item_name || '').toLowerCase().includes(searchText),
    );
  }, [transferableItems, search]);

  // If the inventory refreshes while this page is open, never leave a
  // trade-held or otherwise unavailable asset selected.
  useEffect(() => {
    setSelectedIDs((previous) => {
      const next = new Set([...previous].filter((id) => transferableIDs.has(id)));
      return next.size === previous.size ? previous : next;
    });
  }, [transferableIDs]);

  const selectedCount = selectedIDs.size;
  const hasEnoughSpace = recipientCapacity !== null && selectedCount <= recipientCapacity.freeSlots;
  const tradeLinkSaved = Boolean(
    recipient && tradeURL.trim() && selectedRecipient?.tradeURL === tradeURL.trim(),
  );

  function selectRecipient(username: string) {
    const account = accounts[username];
    setRecipient(username);
    setTradeURL(account?.tradeURL || '');
    setRecipientCapacity(account?.inventoryCapacity || null);
    setMessage('');
    refreshCapacity(username);
  }

  async function refreshCapacity(username = recipient) {
    if (!username) return;
    const requestNumber = ++capacityRequestNumber.current;
    setCapacityLoading(true);
    setMessage('');
    try {
      const capacity = await window.electron.ipcRenderer.getSavedAccountCapacity(username) as InventoryCapacity;
      if (requestNumber !== capacityRequestNumber.current) return;
      setRecipientCapacity(capacity);
      await loadAccounts();
    } catch (error: any) {
      if (requestNumber !== capacityRequestNumber.current) return;
      setRecipientCapacity(null);
      setMessage(error?.message || 'Could not refresh this saved account inventory.');
    } finally {
      if (requestNumber === capacityRequestNumber.current) {
        setCapacityLoading(false);
      }
    }
  }

  function toggleItem(item: any) {
    const ids = (item.combined_ids || []).map(String);
    if (!isTransferableNow(item)) {
      return;
    }
    const selected = ids.every((id: string) => selectedIDs.has(id));
    setItemQuantity(item, selected ? 0 : ids.length);
  }

  function setItemQuantity(item: any, requestedQuantity: number) {
    if (!isTransferableNow(item)) return;
    const ids = (item.combined_ids || []).map(String);
    const quantity = Math.max(0, Math.min(ids.length, Number.isFinite(requestedQuantity) ? Math.floor(requestedQuantity) : 0));
    setSelectedIDs((previous) => {
      const next = new Set(previous);
      ids.forEach((id: string) => next.delete(id));
      ids.slice(0, quantity).forEach((id: string) => next.add(id));
      return next;
    });
  }

  async function saveTradeURL() {
    if (!recipient) return;
    setSavingLink(true);
    setMessage('');
    try {
      await window.electron.ipcRenderer.setSavedAccountTradeURL(recipient, tradeURL);
      await loadAccounts();
      setMessage('Trade link saved for this profile.');
    } catch (error: any) {
      setMessage(error?.message || 'Could not save the Steam trade link.');
    } finally {
      setSavingLink(false);
    }
  }

  async function sendOffer() {
    if (!recipient || selectedCount === 0 || sending) return;
    if (!window.confirm(`Send ${selectedCount} item(s) to ${recipient}?`)) return;

    setSending(true);
    setMessage('');
    try {
      const result = await window.electron.ipcRenderer.sendSavedAccountTrade({
        username: recipient,
        itemIDs: Array.from(selectedIDs),
      });
      setSelectedIDs(new Set());
      setMessage(`Trade offer ${result.offerID || ''} was sent to Steam.`);
      window.electron.ipcRenderer.refreshInventory();
    } catch (error: any) {
      setMessage(error?.message || 'Steam could not send the trade offer.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6 lg:p-8 dark:bg-dark-level-one">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-dark-white">Transfer to saved account</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Only items that can be sent now are shown. Trade-held items and Storage Units are hidden.
          </p>
        </div>
        <button
          type="button"
          onClick={loadAccounts}
          className="inline-flex items-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-white dark:border-gray-600 dark:text-gray-200 dark:hover:bg-dark-level-two"
        >
          <RefreshIcon className="mr-2 h-4 w-4" /> Refresh profiles
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-dark-level-two">
          <h2 className="font-medium text-gray-900 dark:text-dark-white">Recipient</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Choose one of your saved Steam sessions.</p>
          <div className="mt-4 space-y-2">
            {recipients.map(([username, account]) => (
              <button
                key={username}
                type="button"
                onClick={() => selectRecipient(username)}
                className={`flex w-full items-center gap-3 rounded-md border p-3 text-left ${recipient === username ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'}`}
              >
                <img
                  className="h-10 w-10 rounded-full bg-gray-200 object-cover"
                  src={account.imageURL || createCSGOImage('econ/characters/customplayer_tm_separatist')}
                  alt=""
                  onError={(event) => {
                    if (!event.currentTarget.dataset.fallbackApplied) {
                      event.currentTarget.dataset.fallbackApplied = 'true';
                      event.currentTarget.src = createCSGOImage('econ/characters/customplayer_tm_separatist');
                    }
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-gray-900 dark:text-dark-white">{username}</span>
                  <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                    {account.displayName ? `${account.displayName} · ` : ''}{account.steamID ? 'Steam ID verified' : 'Steam ID will be verified automatically'}
                  </span>
                </span>
                {recipient === username && <CheckIcon className="h-5 w-5 text-green-500" />}
              </button>
            ))}
            {!recipients.length && <p className="text-sm text-gray-500 dark:text-gray-400">Save and sign in to another Steam profile first.</p>}
          </div>

          {recipient && (
            <div className="mt-5 border-t border-gray-200 pt-4 dark:border-gray-700">
              <div className="mb-4 rounded-md bg-gray-50 p-3 text-sm dark:bg-dark-level-one">
                {capacityLoading ? (
                  <span className="text-gray-500 dark:text-gray-400">Checking live inventory space…</span>
                ) : recipientCapacity ? (
                  <div>
                    <span className="font-medium text-gray-900 dark:text-dark-white">{recipientCapacity.freeSlots} free slot(s)</span>
                    <span className="text-gray-500 dark:text-gray-400"> · {recipientCapacity.inventorySlots} / {recipientCapacity.limit} occupied</span>
                    <button
                      type="button"
                      onClick={() => refreshCapacity()}
                      className="ml-3 text-xs font-medium text-green-600 hover:text-green-700"
                    >
                      Refresh live
                    </button>
                    <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                      Checked {new Date(recipientCapacity.updatedAt).toLocaleString()}
                    </span>
                  </div>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400">Live inventory space has not been checked yet.</span>
                )}
              </div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Steam trade link</label>
              <input
                value={tradeURL}
                onChange={(event) => setTradeURL(event.target.value)}
                placeholder="https://steamcommunity.com/tradeoffer/new/?partner=…"
                className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-dark-level-one dark:text-dark-white"
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Copy it from Steam: Inventory → Trade offers → Who can send me trade offers?</p>
              <button
                type="button"
                disabled={savingLink || !tradeURL.trim()}
                onClick={saveTradeURL}
                className={`mt-3 inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${tradeLinkSaved ? 'bg-green-700 hover:bg-green-800' : 'bg-green-600 hover:bg-green-700'}`}
              >
                {savingLink ? 'Saving…' : tradeLinkSaved ? <><CheckIcon className="mr-1.5 h-4 w-4" />Trade link saved</> : 'Save trade link'}
              </button>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-dark-level-two">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-4 dark:border-gray-700">
            <div>
              <h2 className="font-medium text-gray-900 dark:text-dark-white">Items from current account</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{selectedCount} selected · {transferableIDs.size} item(s) available to send now</p>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search items"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 sm:w-64 dark:border-gray-600 dark:bg-dark-level-one dark:text-dark-white"
            />
          </div>

          <div className="max-h-[58vh] divide-y divide-gray-100 overflow-y-auto dark:divide-gray-700">
            {visibleItems.map((item: any) => {
              const ids = (item.combined_ids || []).map(String);
              const allSelected = ids.length > 0 && ids.every((id: string) => selectedIDs.has(id));
              return (
                <div
                  key={item.item_id}
                  onClick={() => toggleItem(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      toggleItem(item);
                    }
                  }}
                  className="transfer-item-row flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-dark-level-three"
                >
                  <span className={`flex h-5 w-5 items-center justify-center rounded border ${allSelected ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 dark:border-gray-600'}`}>
                    {allSelected && <CheckIcon className="h-4 w-4" />}
                  </span>
                  <img className="h-10 w-10 object-contain" src={createCSGOImage(item.item_image_url || item.item_url)} alt="" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900 dark:text-dark-white">{item.item_name}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">Transferable now</span>
                  </span>
                  <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      aria-label={`Send one fewer ${item.item_name}`}
                      onClick={() => setItemQuantity(item, ids.filter((id: string) => selectedIDs.has(id)).length - 1)}
                      className="transfer-quantity-button h-7 w-7 rounded border border-gray-300 text-lg leading-none text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-dark-level-three"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="0"
                      max={ids.length}
                      value={ids.filter((id: string) => selectedIDs.has(id)).length}
                      onChange={(event) => setItemQuantity(item, Number(event.target.value))}
                      aria-label={`Quantity of ${item.item_name} to send`}
                      className="transfer-quantity-input h-7 w-16 rounded border border-gray-300 bg-white text-center text-sm text-gray-900 dark:border-gray-600 dark:bg-dark-level-one dark:text-dark-white"
                    />
                    <button
                      type="button"
                      aria-label={`Send one more ${item.item_name}`}
                      onClick={() => setItemQuantity(item, ids.filter((id: string) => selectedIDs.has(id)).length + 1)}
                      className="transfer-quantity-button h-7 w-7 rounded border border-gray-300 text-lg leading-none text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-dark-level-three"
                    >
                      +
                    </button>
                    <span className="ml-1 whitespace-nowrap text-sm font-medium text-gray-700 dark:text-gray-200">/ {item.combined_QTY || ids.length}</span>
                  </div>
                </div>
              );
            })}
            {!visibleItems.length && <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">No transferable items match the search.</p>}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 p-4 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center"><ExclamationCircleIcon className="mr-2 h-5 w-5" /> Steam may require confirmation in Steam Guard.</div>
              {recipientCapacity && !hasEnoughSpace && <div className="mt-1 text-red-500">Only {recipientCapacity.freeSlots} free slot(s) on the recipient account.</div>}
            </div>
            <button
              type="button"
              disabled={!recipient || selectedCount === 0 || sending || capacityLoading || !hasEnoughSpace || !selectedRecipient?.tradeURL || !selectedRecipient?.steamID}
              onClick={sendOffer}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? 'Sending…' : `Send ${selectedCount || ''} item(s)`}
            </button>
          </div>
          {message && <p className="mx-4 mb-4 rounded-md bg-gray-100 p-3 text-sm text-gray-700 dark:bg-dark-level-one dark:text-gray-200">{message}</p>}
        </section>
      </div>
    </div>
  );
}
