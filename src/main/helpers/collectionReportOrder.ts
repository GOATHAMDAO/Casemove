import type { ReportRow } from './exportSavedProfileReport';

function nonSkinGroup(itemName: string) {
  if (itemName.startsWith('Sticker |')) return stickerGroup(itemName);
  if (itemName.startsWith('Charm |')) return 'Charms';
  if (itemName.includes('Case') || itemName.includes('Capsule') || itemName.includes('Package')) return 'Containers';
  if (itemName.includes('Service Medal') || itemName.includes('Badge') || itemName.includes('Coin')) return 'Collectibles';
  if (itemName.startsWith('Music Kit')) return 'Music Kits';
  if (itemName === 'Storage Unit') return 'Storage Units';
  if (/^(AWP|USP-S)$/i.test(itemName)) return 'Base weapons';
  return 'Other items';
}

const stickerCollections: Record<string, string> = {
  blinky: 'Character Craft Stickers',
  chompers: 'Character Craft Stickers',
  flex: 'Character Craft Stickers',
  'fly high': 'Character Craft Stickers',
  'from the deep': 'Character Craft Stickers',
  'from the deep glitter': 'Character Craft Stickers',
  glare: 'Character Craft Stickers',
  'gold teef foil': 'Character Craft Stickers',
  'hypnoteyes holo': 'Character Craft Stickers',
  'quick peek': 'Character Craft Stickers',
  'red shades foil': 'Character Craft Stickers',
  'ribbon tie': 'Character Craft Stickers',
  'say cheese holo': 'Character Craft Stickers',
  'strike a pose': 'Character Craft Stickers',
  'taste bud': 'Character Craft Stickers',
  xd: 'Character Craft Stickers',
  'bolt charge': 'Elemental Craft Stickers',
  'bolt charge foil': 'Elemental Craft Stickers',
  'bolt energy': 'Elemental Craft Stickers',
  'bolt strike': 'Elemental Craft Stickers',
  'bolt strike foil': 'Elemental Craft Stickers',
  'boom blast': 'Elemental Craft Stickers',
  'boom blast glitter': 'Elemental Craft Stickers',
  'boom detonation': 'Elemental Craft Stickers',
  'boom detonation glitter': 'Elemental Craft Stickers',
  'boom epicenter glitter': 'Elemental Craft Stickers',
  'boom trail': 'Elemental Craft Stickers',
  'boom trail glitter': 'Elemental Craft Stickers',
  'hot rod heat': 'Elemental Craft Stickers',
  'hydro stream': 'Elemental Craft Stickers',
  'hydro wave': 'Elemental Craft Stickers',
  'scorch loop reverse': 'Elemental Craft Stickers',
  'winding scorch': 'Elemental Craft Stickers',
  'winding scorch foil': 'Elemental Craft Stickers',
  'clavis holo': 'Sugarface 2 Stickers',
  lorena: 'Sugarface 2 Stickers',
  'lorena holo': 'Sugarface 2 Stickers',
  lucas: 'Sugarface 2 Stickers',
  'fade mangos': 'Community Stickers 2025',
  'gloves on': 'Community Stickers 2025',
};

function normaliseStickerName(itemName: string) {
  return itemName
    .replace(/^Sticker\s*\|\s*/i, '')
    .replace(/[()]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function stickerGroup(itemName: string) {
  const knownCollection = stickerCollections[normaliseStickerName(itemName)];
  if (knownCollection) return knownCollection;

  // Tournament stickers include their event in the Steam item name. Keep each
  // event together, just as the CSGOSKINS catalogue separates them.
  const event = itemName.match(/\|\s*([^|]*\b20\d{2})\s*$/)?.[1]?.trim();
  if (event) return `${event} Stickers`;
  return 'Other Stickers';
}

function headingRow(name: string, profileCount: number): ReportRow {
  return {
    itemName: name,
    total: 0,
    storageTotal: 0,
    profileTotals: Array(profileCount).fill(0),
    priceEmpireTotal: undefined,
    priceEmpireDifference: undefined,
    rowType: 'heading',
  };
}

/** Groups skins by their in-game collection, using the names shown by CSGOSKINS.GG. */
export function orderReportRowsByCollection(rows: ReportRow[], profileCount: number) {
  const groups = new Map<string, ReportRow[]>();
  rows.forEach((row) => {
    const collection = row.collection || nonSkinGroup(row.itemName);
    const group = groups.get(collection) || [];
    group.push(row);
    groups.set(collection, group);
  });

  return Array.from(groups.entries())
    .sort(([first], [second]) => first.localeCompare(second))
    .flatMap(([collection, collectionRows]) => [
      headingRow(collection, profileCount),
      ...collectionRows.sort((first, second) => first.itemName.localeCompare(second.itemName)),
      {
        itemName: '',
        total: 0,
        storageTotal: 0,
        profileTotals: Array(profileCount).fill(0),
        priceEmpireTotal: undefined,
        priceEmpireDifference: undefined,
        rowType: 'spacer' as const,
      },
    ]);
}
