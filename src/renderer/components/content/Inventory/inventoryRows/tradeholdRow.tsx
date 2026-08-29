
export function RowTradehold({itemRow, settingsData}) {
  const now = new Date();
  const unlockDates = itemRow.trade_unlocks ||
    (itemRow.trade_unlock !== undefined ? [itemRow.trade_unlock] : []);
  const daysToUnlock = unlockDates
    .map((unlockDate) => Math.max(0, Math.ceil(
      (unlockDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )))
    .sort((first, second) => first - second);
  const lockedLabel = daysToUnlock.length === 0
    ? ''
    : daysToUnlock[0] === daysToUnlock[daysToUnlock.length - 1]
      ? `${daysToUnlock[0]} days`
      : `${daysToUnlock[0]}–${daysToUnlock[daysToUnlock.length - 1]} days`;
  const tradeholdLabel = lockedLabel;

  return (
    <>

      {settingsData.columns.includes('Tradehold') ?
        <td className="hidden md:table-cell px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center font-normal">
          {tradeholdLabel}
        </td> : ''}

    </>
  );
}
