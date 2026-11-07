import { Fragment, useEffect, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  ArchiveIcon,
  CollectionIcon,
  DownloadIcon,
} from '@heroicons/react/solid';
import { useDispatch, useSelector } from 'react-redux';
import {
  HashRouter as Router,
  Route,
  Routes
} from 'react-router-dom';
import { ReducerManager } from '../../../renderer/functionsClasses/reducerManager';
import { State } from '../../../renderer/interfaces/states';
import { getAllStorages } from '../../../renderer/functionsClasses/storageUnits/storageUnitsFunctions';
import { downloadReport } from '../../../renderer/functionsClasses/downloadReport';
import RightGraph from './rightGraph';
import PortfolioValue from './portfolioValue';
import PortfolioPerformance from './portfolioPerformance';



function Content() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  let ReducerClass = new ReducerManager(useSelector);
  let currentState: State = ReducerClass.getStorage();
  const userDetails = currentState.authReducer
  const settingsData = currentState.settingsReducer
  const inventory = currentState.inventoryReducer
  let hr = new Date().getHours();
  let goodMessage: string = 'Good Evening';

  if (hr >= 4 && hr < 12) {
    goodMessage = 'Good morning';
  } else if (hr == 12) {
    goodMessage = 'Good noon';
  } else if (hr >= 12 && hr <= 17) {
    goodMessage = 'Good afternoon';
  } else if (hr >= 0 && hr <= 3) {
    goodMessage = 'Wassup';
  }
  const dispatch = useDispatch()
  const [storageLoading, setStorageLoading] = useState(false);
  const [loadedStorageKey, setLoadedStorageKey] = useState('');
  const [failedStorageCount, setFailedStorageCount] = useState(0);

  const storageKey = useMemo(
    () => inventory.inventory
      .filter((item) => item.item_url.includes('casket') && item.item_storage_total > 0)
      .map((item) => `${item.item_id}:${item.item_storage_total}`)
      .sort()
      .join('|'),
    [inventory.inventory]
  );

  useEffect(() => {
    if (!storageKey || storageKey === loadedStorageKey) {
      return;
    }

    setStorageLoading(true);
    setFailedStorageCount(0);
    getAllStorages(
      dispatch,
      settingsData,
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
  }, [storageKey]);

  const storageItems = inventory.inventory.reduce(
    (total, item) => total + (item.item_url.includes('casket') ? item.item_storage_total || 0 : 0),
    0,
  );
  const inventoryItems = inventory.inventory.length;
  const overviewReady = !storageLoading
    && failedStorageCount === 0
    && (!storageKey || storageKey === loadedStorageKey);


  return (
    <>
      <div className="h-screen bg-gray-50 dark:bg-dark-level-one">
        <Transition.Root show={sidebarOpen} as={Fragment}>
          <Dialog
            as="div"
            className="relative z-40 lg:hidden"
            onClose={setSidebarOpen}
          >
            <Transition.Child
              as={Fragment}
              enter="transition-opacity ease-linear duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="transition-opacity ease-linear duration-300"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-gray-600 bg-opacity-75" />
            </Transition.Child>

            <div className="fixed inset-0 flex z-40">
              <Transition.Child
                as={Fragment}
                enter="transition ease-in-out duration-300 transform"
                enterFrom="-translate-x-full"
                enterTo="translate-x-0"
                leave="transition ease-in-out duration-300 transform"
                leaveFrom="translate-x-0"
                leaveTo="-translate-x-full"
              ></Transition.Child>
              <div className="shrink-0 w-14" aria-hidden="true">
                {/* Dummy element to force sidebar to shrink to fit close icon */}
              </div>
            </div>
          </Dialog>
        </Transition.Root>

        <div className="">
          <main className="flex-1 pb-8 bg-gray-50 dark:bg-dark-level-one">
            {/* Page header */}
            <div className="bg-white shadow border-b border-gray-200 dark:border-opacity-50 dark:bg-dark-level-one">
              <div className="px-4 sm:px-6 lg:max-w-6xl lg:mx-auto lg:px-8">
                <div className="py-6 md:flex md:items-center md:justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Profile */}
                    <div className="flex items-center">
                      <img
                        className="hidden h-16 w-16 rounded-full sm:block"
                        src={userDetails.userProfilePicture as string}
                        alt=""
                      />
                      <div>
                        <div className="flex items-center">
                          <img
                            className="h-16 w-16 rounded-full sm:hidden"
                            src={userDetails.userProfilePicture as string}
                            alt=""
                          />
                          <h1 className="ml-3 text-2xl font-bold leading-7 text-gray-900 dark:text-dark-white sm:leading-9 sm:truncate">
                            {goodMessage}, {userDetails.displayName}.
                          </h1>
                        </div>
                        <p className="mt-2 ml-3 text-sm text-gray-400">
                          {failedStorageCount > 0
                            ? `Could not load ${failedStorageCount} Storage Unit${failedStorageCount === 1 ? '' : 's'}. Open Inventory and use ↻ to retry.`
                            : storageLoading
                              ? 'Loading items from Storage Units…'
                              : 'Inventory and Storage Units are counted automatically.'}
                        </p>
                      </div>
                    </div>
                  </div>
                  {overviewReady && (
                    <div className="mt-6 flex md:mt-0 md:ml-4">
                      <button
                        type="button"
                        onClick={() =>
                          downloadReport(
                            [...inventory.inventory, ...inventory.storageInventoryRaw],
                            { rawItems: true },
                          )
                        }
                        className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                      >
                        <DownloadIcon className="mr-2 h-5 w-5" aria-hidden="true" />
                        Export CSV
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 bg-gray-50 dark:bg-dark-level-one">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mt-2 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <div
                    key="Storage Units"
                    className="overflow-hidden bg-white shadow dark:bg-dark-level-three"
                  >
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="shrink-0">
                          <CollectionIcon
                            className="h-6 w-6 text-gray-400"
                            aria-hidden="true"
                          />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-900 dark:text-dark-white truncate">
                              Storage Units
                            </dt>
                            <dd>
                              <div className="text-lg font-medium text-green-500">{new Intl.NumberFormat(settingsData.locale).format(storageItems)}</div>
                              <div className="text-sm text-gray-500">Items inside Storage Units</div>
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div
                    key="Inventory items"
                    className="overflow-hidden bg-white shadow dark:bg-dark-level-three"
                  >
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="shrink-0">
                          <ArchiveIcon
                            className="h-6 w-6 text-gray-400"
                            aria-hidden="true"
                          />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-900 dark:text-dark-white truncate">
                              Inventory
                            </dt>
                            <dd>
                              <div className="text-lg font-medium text-green-500">{new Intl.NumberFormat(settingsData.locale).format(inventoryItems)}</div>
                              <div className="text-sm text-gray-500">Items directly in inventory</div>
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>
                  <PortfolioValue />
                </div>
              </div>


              {/* Activity table (small breakpoint and up) */}
              <div className="hidden sm:block">
                <div className="max-w-6xl mx-auto mt-8 px-4 sm:px-6 lg:px-8">
                  <div className="grid grid-rows-3 grid-flow-col gap-4 mt-2">
                    <div className="align-middle mw-5 pl-5 pr-5 overflow-x-auto row-span-3 overflow-hidden bg-white dark:bg-dark-level-three">
                      <PortfolioPerformance />
                    </div>
                    <div className="align-middle mw-5 overflow-x-auto row-span-3 pb-5 shadow overflow-hidden bg-white dark:bg-dark-level-three">
                      <RightGraph />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
export default function App() {
  return (
    <Routes>
      <Route path="*" element={<Content />} />
    </Routes>
  );
}
