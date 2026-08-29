import { sortDataFunction } from "../../../renderer/components/content/shared/filters/inventoryFunctions"
import { Filter } from "../../../renderer/interfaces/filters"
import { Inventory, InventoryFilters, Prices, Settings, State } from "../../../renderer/interfaces/states"
import _ from 'lodash';
import { filterItemRows } from "../../../renderer/functionsClasses/filters/custom";

export const allButClear = (filterString: any, sortValue, inventoryFiltered) => {
    return {
        type: 'ALL_BUT_CLEAR',
        payload: {
            inventoryFilter: filterString,
            sortValue: sortValue,
            inventoryFiltered: inventoryFiltered

        }
    }
}
export const inventorySetFilteredStorage = (storageFilter, storageFiltered) => {
  return {
      type: 'SET_FILTERED_STORAGE',
      payload: {
          storageFiltered,
          storageFilter

      }
  }
}
export const inventorySetFilter = (inventoryFilter: any, sortValue, inventoryFiltered) => {
    return {
        type: 'SET_FILTERED',
        payload: {
            inventoryFilter,
            sortValue,
            inventoryFiltered
        }
    }
}
export const filterInventoryClearAll = () => {
    return {
        type: 'CLEAR_ALL'
    }
}
export const inventoryFilterSetSearch = (searchField) => {
  return {
      type: 'INVENTORY_FILTERS_SET_SEARCH',
      payload: {
          searchField: searchField
      }
  }
}

export const inventoryAddCategoryFilter = (filterToAdd) => {
  return {
      type: 'INVENTORY_ADD_CATEGORY_FILTER',
      payload: filterToAdd
  }
}
export const inventoryAddRarityFilter = (filterToAdd) => {
  return {
      type: 'INVENTORY_ADD_RARITY_FILTER',
      payload: filterToAdd
  }
}

export async function storageInventoryAddOption(currentState: State, newFilter: Filter) {
  let newFilterState = [] as Array<Filter>;
  let wasSeen: boolean = false;
  currentState.inventoryFiltersReducer.storageFilter.forEach(element => {
      if (!_.isEqual(element, newFilter)) {
          newFilterState.push(element)

      } else {
          wasSeen = true;
      }
  });

  if (!wasSeen) {
      newFilterState.push(newFilter)
  }

  let filteredStorage = await filterItemRows(currentState.inventoryReducer.storageInventory, newFilterState)
  filteredStorage = await sortDataFunction(currentState.moveFromReducer.sortValue, filteredStorage, currentState.pricingReducer.prices, currentState.settingsReducer?.source?.title)
  return inventorySetFilteredStorage(newFilterState, filteredStorage)
}

export async function filterInventoryAddOption(inventoryFiltersReducer: InventoryFilters, inventoryReducer: Inventory,pricingReducer: Prices, settingsReducer: Settings, newFilter: Filter) {
    let newFilterState = [] as Array<Filter>;
    let wasSeen: boolean = false;
    inventoryFiltersReducer.inventoryFilter.forEach(element => {
        if (!_.isEqual(element, newFilter)) {
            newFilterState.push(element)

        } else {
            wasSeen = true;
        }
    });

    if (!wasSeen) {
        newFilterState.push(newFilter)
    }
    let filteredInv = await filterItemRows(
      [...inventoryReducer.combinedInventory, ...inventoryReducer.storageInventory],
      newFilterState,
    )
    filteredInv = await sortDataFunction(inventoryFiltersReducer.sortValue, filteredInv, pricingReducer.prices, settingsReducer.source?.title)
    return inventorySetFilter(newFilterState, inventoryFiltersReducer.sortValue, filteredInv)
}

export async function filterInventorySetSort(inventoryFiltersReducer: InventoryFilters, inventoryReducer: Inventory, pricingReducer: Prices,settingsReducer: Settings, newSort: string) {
    let inventoryData = sortDataFunction(
      newSort,
      [...inventoryReducer.combinedInventory, ...inventoryReducer.storageInventory],
      pricingReducer.prices,
      settingsReducer?.source?.title,
    )
    return allButClear(inventoryFiltersReducer.inventoryFilter, newSort, inventoryData)
}
