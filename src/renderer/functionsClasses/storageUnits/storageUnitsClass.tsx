import combineInventory, {
  sortDataFunction,
} from '../../../renderer/components/content/shared/filters/inventoryFunctions';
import { ItemRow, ItemRowStorage } from '../../../renderer/interfaces/items';
import { Inventory, InventoryFilters, MoveFromReducer, Prices, Settings, State } from '../../../renderer/interfaces/states';
import { inventorySetFilteredStorage } from '../../../renderer/store/actions/filtersInventoryActions';
import { addStorageInventoryData } from '../../../renderer/store/inventory/inventoryActions';
import { moveFromAddCasketToStorages } from '../../../renderer/store/actions/moveFromActions';
import { filterItemRows } from '../filters/custom';

// The Steam GC reply channel is shared. Serialising calls avoids one Storage
// Unit consuming another unit's response while a previous page is still
// loading in the background.
let storageRequestQueue: Promise<void> = Promise.resolve();

function requestStorageUnit(itemID: string, storageName: string | null) {
  const request = storageRequestQueue.then(() =>
    window.electron.ipcRenderer.getStorageUnitData(itemID, storageName),
  );
  storageRequestQueue = request.then(
    () => undefined,
    () => undefined,
  );
  return request;
}

export class HandleStorageData {
  dispatch: Function;
  settingsReducer: Settings;
  pricingReducer: Prices;
  moveFromReducer: MoveFromReducer;
  inventoryReducer: Inventory;
  inventoryFiltersReducer: InventoryFilters;

  constructor(dispatch: Function, settingsReducer: Settings, pricingReducer: Prices, moveFromReducer: MoveFromReducer, inventoryReducer: Inventory, inventoryFiltersReducer: InventoryFilters) {
    this.dispatch = dispatch;
    this.settingsReducer = settingsReducer;
    this.pricingReducer = pricingReducer;
    this.moveFromReducer = moveFromReducer;
    this.inventoryReducer = inventoryReducer;
    this.inventoryFiltersReducer = inventoryFiltersReducer;
  }

  async addStorage(storageRow: ItemRow, addArray: Array<ItemRow> = []) {
    // Adding the casket ID
    this.dispatch(moveFromAddCasketToStorages(storageRow.item_id));

    // Fetch the storage unit data
    let storageResult = await this._getStorageUnitData(storageRow);
    if (addArray.length == 0) {
      addArray = this.inventoryReducer.storageInventory
    }
    let filteredStorage = await filterItemRows(
      [...addArray, ...storageResult.combinedStorages],
      this.inventoryFiltersReducer.storageFilter
    );
    filteredStorage = await sortDataFunction(
      this.moveFromReducer.sortValue,
      filteredStorage,
      this.pricingReducer.prices,
      this.settingsReducer?.source?.title
    );

    this.dispatch(inventorySetFilteredStorage(this.inventoryFiltersReducer.storageFilter, filteredStorage))
    this.dispatch(
      addStorageInventoryData(
        storageResult.rawStorages,
        storageResult.combinedStorages,
        storageRow.item_id,
        this.moveFromReducer.sortValue
      )
    );
    return storageResult.combinedStorages
  }

  // Get storage unit
  async _getStorageUnitData(storageRow: ItemRow) {
    console.log(storageRow.item_id, storageRow.item_customname);
    const storageResult = await requestStorageUnit(
      storageRow.item_id,
      storageRow.item_customname,
    );
    if (!Array.isArray(storageResult) || storageResult[0] !== 1 || !Array.isArray(storageResult[1])) {
      throw new Error(`Steam did not return Storage Unit ${storageRow.item_customname || storageRow.item_id}`);
    }
    let returnData: Array<ItemRowStorage> = storageResult[1];

    if (storageRow.item_storage_total > 0 && returnData.length < storageRow.item_storage_total) {
      throw new Error(
        `Storage Unit ${storageRow.item_customname || storageRow.item_id} returned ${returnData.length} of ${storageRow.item_storage_total} items`,
      );
    }

    let finalReturnData = (await combineInventory(
      returnData,
      this.settingsReducer,
      {
        storage_id: storageRow.item_id,
        storage_name: storageRow.item_customname,
      }
    )) as Array<ItemRowStorage>;
    finalReturnData = await sortDataFunction(
      this.moveFromReducer.sortValue,
      finalReturnData,
      this.pricingReducer.prices,
      this.settingsReducer?.source?.title
    );

    returnData.forEach((element) => {
      element.storage_id = storageRow.item_id;
      element.storage_name = storageRow.item_customname as string;
    });

    return {
      combinedStorages: finalReturnData,
      rawStorages: returnData,
    };
  }
}
