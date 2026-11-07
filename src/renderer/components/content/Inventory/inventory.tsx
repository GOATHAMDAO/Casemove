import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import InventoryFilters from './filterHeader';
import InventoryRowsComponent from './inventoryRows';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { LoadingButton } from '../shared/animations';
import { DocumentDownloadIcon, RefreshIcon } from '@heroicons/react/solid';
import { ReducerManager } from '../../../functionsClasses/reducerManager';
import { State } from '../../../interfaces/states';
import { getAllStorages } from '../../../functionsClasses/storageUnits/storageUnitsFunctions';
import { clearStorage } from '../../../store/inventory/inventoryActions';
import { filterInventoryClearAll } from '../../../store/actions/filtersInventoryActions';

function Content() {
  const [getLoadingButton, setLoadingButton] = useState(false);
  const [storageLoading, setStorageLoading] = useState(false);
  const [loadedStorageKey, setLoadedStorageKey] = useState('');
  const [storageResetComplete, setStorageResetComplete] = useState(false);
  const [failedStorageCount, setFailedStorageCount] = useState(0);
  const [exportingReport, setExportingReport] = useState(false);
  const [reportMessage, setReportMessage] = useState('');
  const dispatch = useDispatch();
  const ReducerClass = new ReducerManager(useSelector);
  const currentState: State = ReducerClass.getStorage();
  const inventory = currentState.inventoryReducer;
  const inventoryFilters = currentState.inventoryFiltersReducer;

  // Versions before the full-storage inventory view saved an automatic
  // "Storage moveable" filter. Remove that legacy default once so it cannot
  // hide items such as Charms stored in a Storage Unit.
  useEffect(() => {
    const migrationKey = 'casemove.inventory-filters-v2';
    const hasLegacyFilter = inventoryFilters.inventoryFilter.length === 1
      && inventoryFilters.inventoryFilter[0]?.label === 'Storage moveable';

    if (!localStorage.getItem(migrationKey)) {
      if (hasLegacyFilter) {
        dispatch(filterInventoryClearAll());
      }
      localStorage.setItem(migrationKey, 'done');
    }
  }, [dispatch, inventoryFilters.inventoryFilter]);

  const storageKey = useMemo(
    () => inventory.inventory
      .filter((item) => item.item_url.includes('casket') && item.item_storage_total > 0)
      .map((item) => `${item.item_id}:${item.item_storage_total}`)
      .sort()
      .join('|'),
    [inventory.inventory]
  );

  // Discard persisted storage rows when this page is opened. That data may
  // belong to a previous account load or contain an interrupted duplicate
  // request; the list below is then rebuilt from every actual Storage Unit.
  useEffect(() => {
    dispatch(clearStorage());
    setLoadedStorageKey('');
    setStorageResetComplete(true);
  }, [dispatch]);

  // The Inventory page always reads every Storage Unit, regardless of the
  // filters used on the Transfer page. Export stays disabled until it is done.
  useEffect(() => {
    if (!storageResetComplete || !storageKey || storageKey === loadedStorageKey) {
      return;
    }

    setStorageLoading(true);
    setFailedStorageCount(0);
    getAllStorages(
      dispatch,
      currentState.settingsReducer,
      currentState.pricingReducer,
      currentState.moveFromReducer,
      inventory,
      currentState.inventoryFiltersReducer,
      { includeAll: true },
    )
      .then(({ failedStorageIds }) => {
        setFailedStorageCount(failedStorageIds.length);
        if (failedStorageIds.length === 0) {
          setLoadedStorageKey(storageKey);
        }
      })
      .catch((error) => {
        console.error('Storage units load error:', error);
        setFailedStorageCount(1);
      })
      .finally(() => {
        setStorageLoading(false);
      });
  }, [storageKey, loadedStorageKey, storageResetComplete]);

  const exportReady = storageResetComplete
    && !storageLoading
    && failedStorageCount === 0
    && (!storageKey || storageKey === loadedStorageKey);

  // Get the inventory
  async function refreshInventory() {
    setLoadingButton(true);
    setLoadedStorageKey('');
    setFailedStorageCount(0);
    dispatch(clearStorage());
    window.electron.ipcRenderer.refreshInventory();
    setLoadingButton(false);
  }

  async function exportAllProfiles() {
    setExportingReport(true);
    setReportMessage('Loading all saved Steam profiles…');
    try {
      const result = await window.electron.ipcRenderer.exportSavedProfileInventoryReport();
      const priceEmpireSummary = result.priceEmpireWarning
        ? ` ${result.priceEmpireWarning}`
        : ` Compared with ${result.priceEmpirePortfolioCount} PriceEmpire portfolio${result.priceEmpirePortfolioCount === 1 ? '' : 's'}${result.excludedPriceEmpirePortfolioCount ? `; ${result.excludedPriceEmpirePortfolioCount} excluded` : ''}.`;
      setReportMessage(`Excel report created: ${result.itemRows} item type${result.itemRows === 1 ? '' : 's'}.${priceEmpireSummary}`);
    } catch (error: any) {
      setReportMessage(error?.message || 'Could not create the Excel report.');
    } finally {
      setExportingReport(false);
    }
  }

  return (
    <>
      {/* Page title & actions */}
      <div className="border-b border-gray-200 px-4 py-4 sm:flex sm:items-center sm:justify-between sm:px-6 lg:px-8 dark:border-opacity-50">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-medium leading-6 text-gray-900 dark:text-dark-white  sm:truncate">
            Inventory
          </h1>
        </div>
        <div className="mt-4 flex flex-col items-end gap-1 sm:mt-0 sm:ml-4">
          <div className="flex">
            <button
              type="button"
              disabled={exportingReport}
              onClick={exportAllProfiles}
              className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <DocumentDownloadIcon className="mr-2 h-4 w-4" aria-hidden="true" />
              {exportingReport ? 'Exporting…' : 'Export all to Excel'}
            </button>
            <button
              type="button"
              onClick={() => refreshInventory()}
              className="ml-3 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:border hover:bg-gray-50 hover:shadow-sm focus:bg-dark-level-four focus:outline-none dark:hover:bg-dark-level-four"
            >
              {getLoadingButton ? (
                <LoadingButton />
              ) : (
                <RefreshIcon
                  className="h-4 w-4 text-gray-500 dark:text-dark-white"
                  aria-hidden="true"
                />
              )}
            </button>
          </div>
          {reportMessage && <p className="max-w-md text-right text-xs text-gray-500 dark:text-gray-400">{reportMessage}</p>}
        </div>
      </div>
      {/* Pinned projects */}
      <InventoryFilters
        exportReady={exportReady}
        storageLoading={storageLoading}
        failedStorageCount={failedStorageCount}
      />

      {/* Projects list (only on smallest breakpoint) */}
      <div className="mt-10 sm:hidden">
        <div className="px-4 sm:px-6">
          <h2 className="text-gray-500 text-xs font-medium uppercase tracking-wide">
            Storages
          </h2>
        </div>
      </div>

      {/* Projects table (small breakpoint and up) */}
      <div className="hidden sm:block">
        <div className="align-middle inline-block min-w-full border-b border-gray-200 dark:border-opacity-50">
          <InventoryRowsComponent />
        </div>
      </div>
    </>
  );
}
export default function inventoryContent() {
  return (
    <Routes>
        <Route path="*" element={<Content />} />
    </Routes>

  );
}
