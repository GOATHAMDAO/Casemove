import StorageFilter from './fromFilters';
import StorageRow from './fromStorageRow';
import StorageSelectorContent from './fromSelector';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect } from 'react';
import { classNames } from '../../shared/filters/inventoryFunctions';
import { BanIcon, FireIcon } from '@heroicons/react/solid';
import { RowHeader, RowHeaderCondition, RowHeaderPlain } from '../../Inventory/inventoryRows/headerRows';
import { searchFilter } from '../../../../../renderer/functionsClasses/filters/search';
import { State } from '../../../../../renderer/interfaces/states';
import { ReducerManager } from '../../../../../renderer/functionsClasses/reducerManager';
import { moveFromReset } from '../../../../../renderer/store/actions/moveFromActions';

function storageItemKey(item: any, includeFloat: boolean) {
  const keyParts = [
    item.item_name,
    item.item_customname,
    item.item_url,
    item.trade_unlock,
    item.item_moveable,
    item.item_has_stickers,
    item.item_wear_name || 0,
    item.stickers,
  ];
  if (includeFloat) keyParts.push(item.item_paint_wear);
  return keyParts.join('\u0001');
}

// Storage Unit contents are initially combined per Storage Unit. Merge equal
// rows once more across the selected units, while retaining the source asset
// IDs so the transfer operation can still remove each item from its own unit.
function combineSelectedStorageItems(items: any[], includeFloat: boolean) {
  const merged = new Map<string, any>();

  items.forEach((item) => {
    const key = storageItemKey(item, includeFloat);
    const source = {
      storage_id: item.storage_id,
      storage_name: item.storage_name,
      item_id: item.item_id,
      item_name: item.item_name,
      combined_ids: (item.combined_ids || []).map(String),
    };
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        ...item,
        combined_ids: [...source.combined_ids],
        combined_QTY: source.combined_ids.length,
        storage_sources: [source],
        storage_names: [item.storage_name].filter(Boolean),
      });
      return;
    }

    existing.combined_ids.push(...source.combined_ids);
    existing.combined_QTY += source.combined_ids.length;
    existing.storage_sources.push(source);
    if (item.storage_name && !existing.storage_names.includes(item.storage_name)) {
      existing.storage_names.push(item.storage_name);
    }
  });

  return Array.from(merged.values()).map((item) => ({
    ...item,
    storage_name: item.storage_names.join(' + '),
  }));
}

function StorageUnits() {
  const dispatch = useDispatch();
  const ReducerClass = new ReducerManager(useSelector);
  const inventory = ReducerClass.getStorage('inventoryReducer');
  const inventoryFilters = ReducerClass.getStorage('inventoryFiltersReducer');
  const fromReducer = ReducerClass.getStorage('moveFromReducer');
  const settingsData = ReducerClass.getStorage('settingsReducer');

  // Opening this page always starts with no Storage Unit selected. Loaded
  // overview data may remain cached, but it is not treated as a selection.
  useEffect(() => {
    dispatch(moveFromReset());
  }, [dispatch]);
  function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
  }

  async function ultimateFire() {
    const runIndex = [] as any
    const relevantRows = document.getElementsByClassName(`findRow`);
    Array.from(relevantRows).forEach(function (element, index) {
      if (!element.classList.contains('hidden')) {
        runIndex.push(index)
      }
    });

    for (let index = 0; index < runIndex.length; index++) {
      const indexToRun = runIndex[index];

      // Actual run
      const htmlElement = document.getElementById(`fire-${indexToRun}`);
      if (htmlElement != undefined) {
        if (!htmlElement.classList.contains('hidden')) {
          htmlElement.click();
          await sleep(25);
        }
      }
    }
  }

  async function removeFire() {
    let i = 0;
    const htmlElements = document.getElementsByClassName('removeXButton');
    Array.from(htmlElements).forEach(function (element) {
      console.log(element);
    });
    while (true) {
      const htmlElement = document.getElementById(`removeX-${i}`);
      console.log(htmlElement);
      if (htmlElement != undefined) {
        htmlElement.click();
      } else {
        break;
      }
      i++;
    }
  }

  let storageToUse = inventoryFilters.storageFiltered
  if (storageToUse.length == 0 && inventoryFilters.storageFilter.length == 0 ) {
    storageToUse = inventory.storageInventory
  }

  // Items from previously loaded Storage Units must not appear until the user
  // chooses a Storage Unit on this page.
  storageToUse = storageToUse.filter((item) =>
    fromReducer.activeStorages.includes(item.storage_id),
  );

  storageToUse = combineSelectedStorageItems(
    storageToUse,
    settingsData.columns.includes('Float'),
  );


  let storageFiltered = searchFilter(storageToUse, inventoryFilters, fromReducer)

  if (fromReducer.sortBack) {
    storageFiltered.reverse()
  }

  return (
    <>
      {/* Storage units */}
      <StorageSelectorContent />

      <StorageFilter />

      {/* Projects table (small breakpoint and up) */}

      <div className="hidden sm:block">
        <div className="align-middle inline-block min-w-full border-b border-gray-200 dark:border-opacity-50">
          <table className="min-w-full">
            <thead className="dark:bg-dark-level-two bg-gray-50">
              <tr
                className={classNames(
                  settingsData.os == 'win32' ? 'top-7' : 'top-0',
                  'border-gray-200 sticky'
                )}
              >
                <RowHeader headerName='Product' sortName='Product name'/>
                <RowHeaderCondition headerName='Collection' sortName='Collection' condition='Collections'/>
                <RowHeaderCondition headerName='Price' sortName='Price' condition='Price'/>
                <RowHeaderCondition headerName='Stickers/Patches' sortName='Stickers' condition='Stickers/patches'/>
                <RowHeaderCondition headerName='Float' sortName='wearValue' condition='Float'/>
                <RowHeaderCondition headerName='Rarity' sortName='Rarity' condition='Rarity'/>
                <RowHeaderCondition headerName='Storage' sortName='StorageName' condition='Storage'/>
                <RowHeaderCondition headerName='Tradehold' sortName='tradehold' condition='Tradehold'/>
                <RowHeader headerName='QTY' sortName='QTY'/>
                <RowHeaderPlain headerName='Move'/>

                <th className="table-cell px-6 py-2 border-b border-gray-200 bg-gray-50  dark:border-opacity-50 dark:bg-dark-level-two text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <span className="md:hidden">move</span>
                  <div className="flex">
                    <button
                      onClick={() => ultimateFire()}
                      className={classNames(
                        (1000 -
                          inventory.inventory.length -
                          fromReducer.totalItemsToMove ==
                          0 &&
                          storageFiltered.length != 0) ||
                          storageFiltered.length == 0 ||
                          storageFiltered.length == fromReducer.totalToMove.length
                          ? 'pointer-events-none text-gray-400 dark:text-gray-600'
                          : 'text-gray-600 dark:text-gray-400'
                      )}
                    >
                      <FireIcon
                        className={classNames(
                          ' h-4 w-4 text-current dark:text-current hover:text-yellow-400 dark:hover:text-yellow-400'
                        )}
                        aria-hidden="true"
                      />
                    </button>
                    <button
                      onClick={() => removeFire()}
                      className={classNames(
                        fromReducer.totalToMove.length == 0
                          ? 'pointer-events-none text-gray-200 dark:text-gray-600'
                          : 'text-gray-600 dark:text-gray-400'
                      )}
                    >
                      <BanIcon
                        className={classNames(
                          ' h-4 w-4 text-current dark:text-current hover:text-red-400 dark:hover:text-red-400'
                        )}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </th>
                <th className="md:hidden table-cell px-6 py-2 border-b border-gray-200 bg-gray-50   dark:border-opacity-50 dark:bg-dark-level-two text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <span className="md:hidden"></span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100 dark:divide-gray-500 dark:text-gray-400 dark:bg-dark-level-one">
              {storageFiltered.map((project, index) => (
                <tr
                  key={project.item_id}
                  className="hover:shadow-inner findRow"
                >
                  <StorageRow projectRow={project} index={index} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default function FromMainComponent() {
  return (
    <Routes>
      <Route path="*" element={<StorageUnits />} />
    </Routes>
  );
}
