import { CheckCircleIcon } from "@heroicons/react/solid";

export function RowMoveable({itemRow, settingsData}) { 
    const now = new Date();
    
    // Рассчитываем дни до разблокировки
    const daysUntilUnlock = itemRow.trade_unlock 
        ? Math.ceil((itemRow.trade_unlock.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
    
    // Галочка только если нет tradehold (дни <= 0)
    const isMoveable = itemRow.item_moveable === true && daysUntilUnlock <= 0;
    
    return (
        <>
          {settingsData.columns.includes('Moveable') ? (
                <td
                  key={Math.random().toString(36).substr(2, 9)}
                  className="hidden md:table-cell px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-right"
                >
                  <div className="flex justify-center rounded-full drop-shadow-lg">
                    {isMoveable ? (
                      <CheckCircleIcon
                        className="h-5 w-5 text-green-500"
                        aria-hidden="true"
                      />
                    ) : (
                      ''
                    )}
                  </div>
                </td>
              ) : (
                ''
              )}
        </>
      );
}
