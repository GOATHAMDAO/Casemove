import { ItemRow, ItemRowStorage } from "../../renderer/interfaces/items";

// Excel uses a semicolon as the CSV separator in many European locales.
function escapeCSV(value: string) {
  if (value == null) return '""';
  value = String(value);
  if (value.includes(';') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

type DownloadOptions = {
  // Raw arrays contain one row for each actual Steam item. Combined rows are
  // used only by table views and already carry their own quantity.
  rawItems?: boolean;
};

async function handleDownload(
  itemData: Array<ItemRow | ItemRowStorage>,
  { rawItems = false }: DownloadOptions = {},
) {
    const totals = new Map<string, number>();
    const seenRawItemIds = new Set<string>();

    itemData.forEach((item) => {
      // A storage can finish loading twice when pages are switched quickly.
      // Steam item IDs are unique, so an ID is the safe unit for CSV totals.
      if (rawItems && item.item_id) {
        if (seenRawItemIds.has(item.item_id)) {
          return;
        }
        seenRawItemIds.add(item.item_id);
      }

      const itemName = [item.item_name, item.item_wear_name]
        .filter(Boolean)
        .join(', ');
      const quantity = rawItems ? 1 : Number(item.combined_QTY) || 1;
      totals.set(itemName, (totals.get(itemName) || 0) + quantity);
    });

    const rows = Array.from(totals.entries())
      .sort(([firstName], [secondName]) => firstName.localeCompare(secondName))
      .map(([itemName, quantity]) => [escapeCSV(itemName), quantity].join(';'));
    const csv = `\ufeffItem Name;Quantity\r\n${rows.join('\r\n')}`;

    try {
      window.electron.ipcRenderer.downloadFile(csv);
    } catch (error) {
      console.error('Download error:', error);
      alert('Ошибка при скачивании');
    }
  }

export async function downloadReport(
  itemArray: Array<ItemRow | ItemRowStorage>,
  options: DownloadOptions = {},
) {
    handleDownload(itemArray, options);
}
