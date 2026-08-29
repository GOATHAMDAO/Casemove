import { CollectionIcon } from "@heroicons/react/solid";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getAllStorages } from "../../../renderer/functionsClasses/storageUnits/storageUnitsFunctions";
import { LoadingButton } from "./shared/animations";
import { classNames } from "./shared/filters/inventoryFunctions";

export function LoadButton() {
    const dispatch = useDispatch();
    const [isLoading, setIsLoading] = useState(false);
    
    // ✅ Правильные типы (или используй 'any' если нет типов)
    const moveFromReducer = useSelector((state: any) => state.moveFromReducer || {});
    const settingsReducer = useSelector((state: any) => state.settingsReducer);
    const pricingReducer = useSelector((state: any) => state.pricingReducer);
    const inventoryReducer = useSelector((state: any) => state.inventoryReducer);
    const inventoryFiltersReducer = useSelector((state: any) => state.inventoryFiltersReducer);

    const handleLoad = async () => {
        setIsLoading(true);
        try {
            await getAllStorages(
                dispatch,
                settingsReducer,
                pricingReducer,
                moveFromReducer,
                inventoryReducer,
                inventoryFiltersReducer
            );
        } catch (error) {
            console.error('Storage units load error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            type="button"
            onClick={handleLoad}
            disabled={isLoading}
            className={classNames(
                moveFromReducer?.activeStorages?.length === 0 || isLoading
                    ? 'bg-green-700'
                    : 'bg-dark-level-three hover:bg-dark-level-four',
                "inline-flex items-center px-4 py-2 shadow-sm text-sm font-medium rounded-md text-dark-white disabled:opacity-50"
            )}
        >
            {isLoading ? (
                <LoadingButton 
                    className="shrink-0 mr-1.5 h-5 w-5 text-dark-white" 
                    aria-hidden="true" 
                />
            ) : (
                <CollectionIcon 
                    className="shrink-0 mr-1.5 h-5 w-5 text-dark-white" 
                    aria-hidden="true" 
                />
            )}
            {moveFromReducer?.activeStorages?.length > 0
                ? `${moveFromReducer.activeStorages.length} Storage units loaded`
                : "Load storage units"
            }
        </button>
    );
}
