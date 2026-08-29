
import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { searchFilter } from '../../../../renderer/functionsClasses/filters/search';
import { RequestPrices } from '../../../../renderer/functionsClasses/prices';
import { ReducerManager } from '../../../../renderer/functionsClasses/reducerManager';
import { classNames, sortDataFunction } from '../shared/filters/inventoryFunctions';
import RenameModal from '../shared/modals & notifcations/modalRename';
import { RowCollections } from './inventoryRows/collectionsRow';
import { RowFloat } from './inventoryRows/floatRow';
import { RowHeader, RowHeaderCondition, RowHeaderConditionNoSort } from './inventoryRows/headerRows';
import { RowLinkInventory } from './inventoryRows/inventoryLinkRow';
import { RowMoveable } from './inventoryRows/moveableRow';
import { RowPrice } from './inventoryRows/priceRow';
import { RowQTY } from './inventoryRows/QTYRow';
import { RowRarity } from './inventoryRows/rarityRow';
import { RowProduct } from './inventoryRows/rowName';
import { RowStickersPatches } from './inventoryRows/stickerPatchesRow';
import { RowStorage } from './inventoryRows/storageRow';
import { RowTradehold } from './inventoryRows/tradeholdRow';

// Storage Units are loaded one at a time, so the store contains one combined
// row per Storage Unit.  On the Inventory page this used to make the same
// available item appear repeatedly. Available and trade-locked stock must stay
// separate: a locked item is still in Inventory, but cannot be moved yet.
function combineAvailableRows(rows: any[], settingsData: any) {
  const grouped = new Map<string, any>();
  const keepFloatSeparate = settingsData?.columns?.includes('Float');

  return rows.map((row) => {
    const key = JSON.stringify([
      row.item_name,
      row.item_customname || '',
      row.item_url || '',
      row.item_moveable === true,
      row.item_wear_name || '',
      keepFloatSeparate ? row.item_paint_wear ?? null : null,
      row.trade_unlock === undefined ? 'available' : 'trade-locked',
    ]);
    const isTradeLocked = row.trade_unlock !== undefined;
    // A market trade-lock follows the item into a Storage Unit. Preserve its
    // real location instead of assuming every locked item is in Inventory.
    const sourceName = row.storage_name || 'Inventory';
    const quantity = Number(row.combined_QTY) || row.combined_ids?.length || 1;
    const itemIDs = row.combined_ids?.length ? row.combined_ids : [row.item_id];
    const unlockDates = row.trade_unlock !== undefined ? [row.trade_unlock] : [];
    const existing = grouped.get(key);

    if (!existing) {
      const initial = {
        ...row,
        combined_QTY: quantity,
        combined_ids: [...itemIDs],
        storage_names: [sourceName],
        storage_name: sourceName,
        trade_unlocks: isTradeLocked ? unlockDates : [],
      };
      grouped.set(key, initial);
      return initial;
    }

    existing.combined_QTY += quantity;
    existing.combined_ids.push(...itemIDs);
    if (isTradeLocked) {
      existing.trade_unlocks.push(row.trade_unlock);
      if (
        existing.trade_unlock === undefined ||
        row.trade_unlock.getTime() < existing.trade_unlock.getTime()
      ) {
        existing.trade_unlock = row.trade_unlock;
      }
    }
    if (!existing.storage_names.includes(sourceName)) {
      existing.storage_names.push(sourceName);
      existing.storage_name = existing.storage_names.join(' + ');
    }
    return null;
  }).filter(Boolean);
}

function content() {
  const [getInventory, setInventory] = useState([] as any);
  const ReducerClass = new ReducerManager(useSelector)
  const inventory = ReducerClass.getStorage('inventoryReducer');
  const inventoryFilters = ReducerClass.getStorage('inventoryFiltersReducer');
  const pricesResult = ReducerClass.getStorage('pricingReducer');
  const settingsData = ReducerClass.getStorage('settingsReducer');
  const auth = ReducerClass.getStorage('authReducer');

  const dispatch = useDispatch();

  // Sort function

  const inventoryToUse = useMemo(() => {
    if (inventoryFilters.inventoryFilter.length == 0) {
      return [...inventory.combinedInventory, ...inventory.storageInventory];
    }
    return inventoryFilters.inventoryFiltered;
  }, [
    inventory.combinedInventory,
    inventory.storageInventory,
    inventoryFilters.inventoryFilter,
    inventoryFilters.inventoryFiltered,
  ]);

  let PricingRequest = new RequestPrices(dispatch, settingsData, pricesResult)
  PricingRequest.handleRequestArray(inventoryToUse)

  useEffect(() => {
    let cancelled = false;
    const inventoryToSort = combineAvailableRows(inventoryToUse, settingsData);

    sortDataFunction(
      inventoryFilters.sortValue,
      inventoryToSort,
      pricesResult.prices,
      settingsData?.source?.title,
    ).then((sortedInventory) => {
      if (!cancelled) {
        setInventory(sortedInventory);
      }
    }).catch((error) => {
      console.error('Inventory sort error:', error);
      if (!cancelled) {
        setInventory(inventoryToSort);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    inventoryToUse,
    inventoryFilters.sortValue,
    pricesResult.prices,
    settingsData?.source?.title,
    settingsData?.columns?.join('|'),
  ]);

  const rowsToUse = inventoryFilters.sortBack ? [...getInventory].reverse() : getInventory;
  const finalToUse = searchFilter(rowsToUse, inventoryFilters, inventoryFilters)

  return (
    <>
      <RenameModal />

      {/* Projects list (only on smallest breakpoint) */}
      <div className="mt-10 sm:hidden">
        <div className="px-4 sm:px-6">
          <h2 className="text-gray-500 text-xs font-medium uppercase tracking-wide">
            Product details
          </h2>
        </div>
        <ul
          role="list"
          className="mt-3 border-t border-gray-200 divide-y divide-gray-100 dark:divide-gray-500"
        >
          {finalToUse.map((project) => (
            <li key={project.item_id}>
              <a
                href="#"
                className="group flex items-center justify-between px-4 py-4 hover:bg-gray-50 sm:px-6"
              >
                <span className="flex items-center truncate space-x-3">
                  <span
                    className={classNames(
                      project.bgColorClass,
                      'w-2.5 h-2.5 shrink-0 rounded-full'
                    )}
                    aria-hidden="true"
                  />
                  <span className="font-medium truncate text-sm leading-6">
                    {project.item_name}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>

      <table className="min-w-full">
        <thead>
          <tr
            className={classNames(
              settingsData.os == 'win32' ? 'top-7' : 'top-0',
              'border-gray-200 sticky'
            )}
          >

            <RowHeader headerName='Product' sortName='Product name' />
            <RowHeaderCondition headerName='Collection' sortName='Collection' condition='Collections' />
            <RowHeaderCondition headerName='Price' sortName='Price' condition='Price' />
            <RowHeaderCondition headerName='Stickers/Patches' sortName='Stickers' condition='Stickers/patches' />
            <RowHeaderCondition headerName='Float' sortName='wearValue' condition='Float' />
            <RowHeaderCondition headerName='Rarity' sortName='Rarity' condition='Rarity' />
            <RowHeaderCondition headerName='Storage' sortName='StorageName' condition='Storage' />
            <RowHeaderCondition headerName='Tradehold' sortName='tradehold' condition='Tradehold' />
            <RowHeader headerName='QTY' sortName='QTY' />
            <RowHeaderConditionNoSort headerName='Moveable' condition='Moveable' />
            <RowHeaderConditionNoSort headerName='Link' condition='Inventory link' />



          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100 dark:bg-dark-level-one dark:divide-gray-500">
              {finalToUse.map((projectRow) => (
            <tr
              key={projectRow.item_id}

            >

              <RowProduct itemRow={projectRow}  />
              <RowCollections itemRow={projectRow} settingsData={settingsData} />
              <RowPrice itemRow={projectRow} settingsData={settingsData} pricesReducer={pricesResult} />
              <RowStickersPatches itemRow={projectRow} settingsData={settingsData} />
              <RowFloat itemRow={projectRow} settingsData={settingsData} />
              <RowRarity itemRow={projectRow} settingsData={settingsData} />
              <RowStorage itemRow={projectRow}  settingsData={settingsData}/>
              <RowTradehold itemRow={projectRow} settingsData={settingsData} />
              <RowQTY itemRow={projectRow} />
              <RowMoveable itemRow={projectRow} settingsData={settingsData} />
              <RowLinkInventory itemRow={projectRow} settingsData={settingsData} userDetails={auth}/>
              <td
                key={Math.random().toString(36).substr(2, 9)}
                className="hidden md:px-6 py-3 whitespace-nowrap text-right text-sm font-medium"
              ></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default function InventoryRowsComponent() {
  return content();
}
