import { LightningBoltIcon, XIcon } from '@heroicons/react/solid';
import { useDispatch, useSelector } from 'react-redux';
import { moveFromAddRemove } from '../../../../../renderer/store/actions/moveFromActions';
import { RowPrice } from '../../Inventory/inventoryRows/priceRow';
import { RowStickersPatches } from '../../Inventory/inventoryRows/stickerPatchesRow';
import { RowStorage } from '../../Inventory/inventoryRows/storageRow';
import { RowRarity } from '../../Inventory/inventoryRows/rarityRow';
import { classNames } from '../../shared/filters/inventoryFunctions';
import { RowFloat } from '../../Inventory/inventoryRows/floatRow';
import { RowTradehold } from '../../Inventory/inventoryRows/tradeholdRow';
import { RowQTY } from '../../Inventory/inventoryRows/QTYRow';
import { RowCollections } from '../../Inventory/inventoryRows/collectionsRow';
import { RowProduct } from '../../Inventory/inventoryRows/rowName';
import { ReducerManager } from '../../../../../renderer/functionsClasses/reducerManager';
import { State } from '../../../../../renderer/interfaces/states';

function content({ projectRow, index }) {
  const dispatch = useDispatch();
  const ReducerClass = new ReducerManager(useSelector)
  const fromReducer = ReducerClass.getStorage('moveFromReducer');
  const inventory = ReducerClass.getStorage('inventoryReducer');
  const settingsReducer = ReducerClass.getStorage('settingsReducer');
  const pricingReducer = ReducerClass.getStorage('pricingReducer');
  const storageSources = projectRow.storage_sources || [{
    storage_id: projectRow.storage_id,
    item_id: projectRow.item_id,
    item_name: projectRow.item_name,
    combined_ids: (projectRow.combined_ids || []).map(String),
  }];
  const sourceItemIDs = new Set(storageSources.map((source) => source.item_id));

  async function returnField(fieldValue) {
    fieldValue = parseInt(fieldValue);
    let totalToGo = 1000 - inventory.inventory.length;
    for (const [, value] of Object.entries(fromReducer.totalToMove)) {
      let valued = value as any;
      if (!sourceItemIDs.has(valued[0])) {
        totalToGo -= valued[2].length;
      }
    }

    let returnValue = 0;
    const totalAvailable = storageSources.reduce(
      (total, source) => total + source.combined_ids.length,
      0,
    );
    let totalMax = totalAvailable;
    if (totalAvailable > totalToGo) {
      totalMax = totalToGo;
    }
    if (fieldValue > totalMax) {
      returnValue = totalMax;
    } else if (fieldValue < 0) {
      returnValue = 0;
    } else {
      if (isNaN(fieldValue)) {
        returnValue = 0;
      } else {
        returnValue = fieldValue;
      }
    }

    // A displayed row can represent the same item in several Storage Units.
    // Split it back into the original sources before asking Steam to move it.
    let remaining = returnValue;
    storageSources.forEach((source) => {
      const sourceQuantity = Math.min(source.combined_ids.length, remaining);
      remaining -= sourceQuantity;
      dispatch(
        moveFromAddRemove(
          source.storage_id,
          source.item_id,
          source.combined_ids.slice(0, sourceQuantity),
          source.item_name,
        ),
      );
    });
  }

  const selectedSourceRows = fromReducer.totalToMove.filter((row) =>
    sourceItemIDs.has(row[0]),
  );
  const isEmpty = selectedSourceRows.length == 0;

  let totalFieldValue = 0;
  selectedSourceRows.forEach((row) => {
    totalFieldValue += row[2].length;
  });

  return (
    <>

      <RowProduct itemRow={projectRow} />
      <RowCollections itemRow={projectRow} settingsData={settingsReducer} />
      <RowPrice itemRow={projectRow} settingsData={settingsReducer} pricesReducer={pricingReducer} />
      <RowStickersPatches itemRow={projectRow} settingsData={settingsReducer} />
      <RowFloat itemRow={projectRow} settingsData={settingsReducer} />
      <RowRarity itemRow={projectRow} settingsData={settingsReducer} />
      <RowStorage itemRow={projectRow} settingsData={settingsReducer} />
      <RowTradehold itemRow={projectRow} settingsData={settingsReducer} />
      <RowQTY itemRow={projectRow}/>

      <td className="table-cell px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hover:text-gray-200 text-right">
        <div className="flex justify-center rounded-full drop-shadow-lg">
          <div>
            <input
              type="text"
              name="postal-code"
              id="postal-code"
              autoComplete="off"
              value={isEmpty ? '' : totalFieldValue}
              placeholder="0"
              onChange={(e) => returnField(e.target.value)}
              className=" block w-full border rounded sm:text-sm text-gray-500 text-center border-gray-400 dark:bg-dark-level-two dark:text-dark-white"
            />
          </div>
        </div>
      </td>
      <td className="table-cell px-6 py-3 text-sm text-gray-500 dark:text-gray-400 font-medium">
        <div className="flex justify-center">
          <button
            onClick={() => returnField(1000)}
            id={`fire-${index}`}
            className={classNames(
              1000 -
                inventory.inventory.length -
                fromReducer.totalItemsToMove ==
                0 || totalFieldValue == projectRow.combined_QTY
                ? 'pointer-events-none hidden'
                : `fireButton`
            )}
          >
            <LightningBoltIcon
              className={classNames(
                isEmpty ? 'h-5 w-5' : 'h-4 w-4',
                'text-gray-400 dark:text-gray-500 hover:text-yellow-400 dark:hover:text-yellow-400'
              )}
              aria-hidden="true"
            />
          </button>
        </div>
        <div className="flex justify-center">
          <button
            onClick={() => returnField(0)}
            className={classNames(
              isEmpty ? 'pointer-events-none hidden' : 'removeXButton'
            )}
            id={`removeX-${index}`}
          >
            <XIcon
              className={classNames(
                1000 -
                  inventory.inventory.length -
                  fromReducer.totalItemsToMove ==
                  0 || totalFieldValue == projectRow.combined_QTY
                  ? 'h-5 w-5'
                  : 'h-4 w-4',
                'text-gray-400 dark:text-gray-500 hover:text-red-400 dark:hover:text-red-400  '
              )}
              aria-hidden="true"
            />
          </button>
        </div>
      </td>
      <td className="hidden md:px-6 py-3 whitespace-nowrap text-right text-sm font-medium"></td>
    </>
  );
}
export default function StorageRow(projects) {
  return content(projects);
}
