
export function RowTradehold({itemRow, settingsData}) {
  const now = new Date();
  const unlockDates = itemRow.trade_unlocks ||
    (itemRow.trade_unlock !== undefined ? [itemRow.trade_unlock] : []);
  const remainingHours = unlockDates
    .map((unlockDate) => Math.max(0, Math.ceil(
      (unlockDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    )))
    .sort((first, second) => first - second);
  const formatRemainingTime = (hours) => {
    if (hours < 24) return `${hours} h`;

    const days = Math.floor(hours / 24);
    const hoursAfterDays = hours % 24;
    return hoursAfterDays === 0 ? `${days} d` : `${days} d ${hoursAfterDays} h`;
  };
  const lockedLabel = remainingHours.length === 0
    ? ''
    : remainingHours[0] === remainingHours[remainingHours.length - 1]
      ? formatRemainingTime(remainingHours[0])
      : `${formatRemainingTime(remainingHours[0])}–${formatRemainingTime(remainingHours[remainingHours.length - 1])}`;
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
