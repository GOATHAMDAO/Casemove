const fs = require('fs');
const path = require('path');
const VDF = require('@node-steam/vdf');
const axios = require('axios');

const itemsLink = 'https://raw.githubusercontent.com/SteamDatabase/GameTracking-CS2/refs/heads/master/game/csgo/pak01_dir/scripts/items/items_game.txt';
const translationsLink =
  'https://raw.githubusercontent.com/SteamDatabase/GameTracking-CS2/refs/heads/master/game/csgo/pak01_dir/resource/csgo_english.txt';
const itemImageCatalogLink =
  'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/inventory.json';
const stickerImageCatalogLink =
  'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/stickers.json';
const itemImageCacheMaxAge = 7 * 24 * 60 * 60 * 1000;

function getItemImageCachePath() {
  const appDataDirectory = process.env.APPDATA || process.env.LOCALAPPDATA || process.cwd();
  return path.join(appDataDirectory, 'casemove', 'item-image-catalog.json');
}


function fileCatcher(endNote) {
  return `${csgo_install_directory}${endNote}`;
}

async function fileGetError(items) {
  let csgoEnglish = require('./itemsBackupFiles/csgo_english.json');
  items.setTranslations(csgoEnglish, 'Error');
  let itemsGame = require('./itemsBackupFiles/items_game.json');
  items.setCSGOItems(itemsGame.items_game || itemsGame);
}

async function getTranslations(items) {
  try {
    const returnValue = await axios.get(translationsLink).then((response) => {
      const finalDict = {};
      const data = response.data;
      var ks = data.split(/\n/);
      ks.forEach(function (value) {
        // Iterate hits
        var test = value.match(/"(.*?)"/g);
        if (test && test[1]) {
          finalDict[test[0].replaceAll('"', '').toLowerCase()] = test[1];
        }
      });

      return finalDict;
    });
    returnValue['stickerkit_cs20_boost_holo'];
    items.setTranslations(returnValue, 'normal');
  } catch (err) {
    console.log('Error occurred during translation parsing');
    fileGetError(items);
  }
}

function updateItemsLoop(jsonData, keyToRun) {
  const returnDict = {};
  for (const [key, value] of Object.entries(jsonData['items_game'])) {
    if (key == keyToRun) {
      for (const [subKey, subValue] of Object.entries(value)) {
        returnDict[subKey] = subValue;
      }
    }
  }
  return returnDict;
}

async function updateItems(items) {
  try {
    const returnValue = await axios.get(itemsLink).then((response) => {
      const dict_to_write = {
        items: {},
        paint_kits: {},
        prefabs: {},
        sticker_kits: {},
        item_sets: {},
        casket_icons: {},
      };
      const data = response.data;
      const jsonData = VDF.parse(data);
      dict_to_write['items'] = updateItemsLoop(jsonData, 'items');
      dict_to_write['paint_kits'] = updateItemsLoop(jsonData, 'paint_kits');
      dict_to_write['prefabs'] = updateItemsLoop(jsonData, 'prefabs');
      dict_to_write['sticker_kits'] = updateItemsLoop(jsonData, 'sticker_kits');
      dict_to_write['item_sets'] = updateItemsLoop(jsonData, 'item_sets');
      dict_to_write['music_kits'] = updateItemsLoop(
        jsonData,
        'music_definitions'
      );
      dict_to_write['keychains'] = updateItemsLoop(
        jsonData,
        'keychain_definitions'
      );
      dict_to_write['graffiti_tints'] = updateItemsLoop(
        jsonData,
        'graffiti_tints'
      );

      dict_to_write['casket_icons'] = updateItemsLoop(
        jsonData,
        'alternate_icons2'
      )['casket_icons'];

      return dict_to_write;
    });
    // Validate data
    returnValue['items'][1209];
    items.setCSGOItems(returnValue);
  } catch (err) {
    console.log('Error occurred during items parsing');
    fileGetError(items);
  }
}

class items {
  translation = {};
  csgoItems = {};
  collectionIndex = null;
  itemImageCatalog = null;
  itemImagePaths = {};
  itemImageCatalogPromise = null;
  constructor() {
    fileGetError(this);
    getTranslations(this);
    updateItems(this);
    this.loadItemImageCatalog();
  }

  setCSGOItems(value) {
    this.csgoItems = value;
    this.collectionIndex = null;
  }
  setTranslations(value, commandFrom) {
    console.log(commandFrom);
    this.translation = value;
  }

  async ensureItemImages() {
    if (this.itemImageCatalog) return;
    await this.loadItemImageCatalog();
  }

  async loadItemImageCatalog() {
    if (this.itemImageCatalogPromise) return this.itemImageCatalogPromise;

    this.itemImageCatalogPromise = (async () => {
      const cachePath = getItemImageCachePath();
      let cachedCatalog = null;
      let cachedImagePaths = {};
      let cachedAt = 0;

      try {
        const cachedValue = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        cachedCatalog = cachedValue.catalog || null;
        cachedImagePaths = cachedValue.imagePaths || {};
        cachedAt = Number(cachedValue.cachedAt) || 0;
        if (
          cachedCatalog &&
          Object.keys(cachedImagePaths).length > 0 &&
          Date.now() - cachedAt < itemImageCacheMaxAge
        ) {
          this.itemImageCatalog = cachedCatalog;
          this.itemImagePaths = cachedImagePaths;
          return;
        }
      } catch (_error) {
        // A local catalog is created after the first successful download.
      }

      try {
        const [response, stickerResponse] = await Promise.all([
          axios.get(itemImageCatalogLink, { timeout: 30000 }),
          axios.get(stickerImageCatalogLink, { timeout: 30000 }),
        ]);
        this.itemImageCatalog = response.data;
        this.itemImagePaths = {};
        for (const sticker of stickerResponse.data || []) {
          const imagePath = sticker?.original?.image_inventory;
          if (imagePath && sticker.image) {
            this.itemImagePaths[imagePath] = sticker.image;
          }
        }
        fs.mkdirSync(path.dirname(cachePath), { recursive: true });
        fs.writeFileSync(
          cachePath,
          JSON.stringify({
            cachedAt: Date.now(),
            catalog: response.data,
            imagePaths: this.itemImagePaths,
          }),
          'utf8'
        );
      } catch (error) {
        // A stale cache is still preferable to blank thumbnails while offline.
        this.itemImageCatalog = cachedCatalog;
        this.itemImagePaths = cachedImagePaths || {};
        console.log('Unable to refresh CS2 item image catalog', error?.message);
      }
    })();

    return this.itemImageCatalogPromise;
  }

  getItemImageUrl(storageRow, imagePath = '') {
    const catalog = this.itemImageCatalog;
    if (!catalog) return undefined;

    const defIndex = String(storageRow['def_index']);
    const paintIndex = storageRow['paint_index'];
    const musicIndex = storageRow['music_index'];
    const keychainIndex = storageRow['keychain_index'];
    const normalizedImagePath = String(imagePath || '').replace(/^\/+/, '');

    if (this.itemImagePaths[normalizedImagePath]) {
      return this.itemImagePaths[normalizedImagePath];
    }

    // A loose sticker uses a generic item definition. Only use its sticker
    // attribute for an actual sticker image path; weapon skins can also have
    // sticker attributes and must keep their own weapon thumbnail.
    if (normalizedImagePath.startsWith('econ/stickers/')) {
      const stickerId = storageRow['stickers']?.[0]?.['sticker_id'];
      if (stickerId !== undefined) {
        const sticker = catalog.stickers?.[String(stickerId)] ||
          catalog.patches?.[String(stickerId)];
        if (sticker?.image) return sticker.image;
      }
    }

    // Storage Units can have a custom in-game label and icon. Preserve the
    // image path returned from items_game instead of replacing it with the
    // single generic Storage Unit picture in the public catalog.
    if (defIndex === '1201') return 'casemove-storage-unit';

    // Do not replace an unknown sticker with a random picture just because
    // another item category happens to share its numeric Steam definition.
    if (normalizedImagePath.startsWith('econ/stickers/')) return undefined;

    if (paintIndex !== undefined) {
      const skin = catalog.skins?.[defIndex]?.[String(paintIndex)];
      if (skin?.image) return skin.image;
    }
    if (musicIndex !== undefined && catalog.music_kits?.[String(musicIndex)]?.image) {
      return catalog.music_kits[String(musicIndex)].image;
    }
    if (keychainIndex !== undefined && catalog.keychains?.[String(keychainIndex)]?.image) {
      return catalog.keychains[String(keychainIndex)].image;
    }

    const categories = [
      'crates', 'collectibles', 'stickers', 'graffiti', 'agents', 'patches',
      'keys', 'sticker_slabs', 'tools', 'keychains', 'highlights',
    ];
    for (const category of categories) {
      const item = catalog[category]?.[defIndex];
      if (item?.image) return item.image;
    }
    return undefined;
  }

  handleError(callback, args) {
    try {
      return callback.apply(this, args);
    } catch (err) {
      console.log(err);
      return '';
    }
  }

  inventoryConverter(inventoryResult, isCasket = false) {
    var returnList = [];
    if (typeof inventoryResult === 'object' && inventoryResult !== null) {
      returnList;
    } else {
      return returnList;
    }

    for (const [key, value] of Object.entries(inventoryResult)) {


      if (value['def_index'] == undefined) {
        continue;
      }
      const freeRewardStatusBytes = getAttributeValueBytes(value, 277);
      if (freeRewardStatusBytes && freeRewardStatusBytes.readUInt32LE(0) === 1) {
        continue;

      }
      let musicIndexBytes = getAttributeValueBytes(value, 166);
      if (musicIndexBytes) {
        value.music_index = musicIndexBytes.readUInt32LE(0);
      }
      let graffitiTint = getAttributeValueBytes(value, 233);
      if (graffitiTint) {
        value.graffiti_tint = graffitiTint.readUInt32LE(0);
      }
      let keychainIndexBytes = getAttributeValueBytes(value, 299)
      if (keychainIndexBytes) {
        value.keychain_index = keychainIndexBytes.readUInt32LE(0);
      }
      if (
        (value['casket_id'] !== undefined && isCasket == false) ||
        ['17293822569110896676', '17293822569102708641'].includes(value['id'])
      ) {
        continue;
      }
      // console.log(value['item_id'])


      const returnDict = {};
      // URL
      let imageURL = this.handleError(this.itemProcessorImageUrl, [value]);

      const iconMatch = getAttributeValueBytes(value, 70)?.readUInt32LE(0);
      if (
        value['def_index'] == 1201 &&
        iconMatch &&
        this.csgoItems['casket_icons']?.[iconMatch]?.icon_path
      ) {
        imageURL = this.csgoItems['casket_icons']?.[iconMatch]?.icon_path;
      }
      // Check names
      returnDict['item_name'] = this.handleError(this.itemProcessorName, [
        value,
        imageURL,
      ]);
      if (returnDict['item_name'] == '') {
        console.log('Error');
        try {
          console.log(value, this.get_def_index(value['def_index']));
        } catch (err) {
          console.log(value);
        }
      }
      returnDict['item_customname'] = value['custom_name'];
      returnDict['item_url'] = imageURL;
      returnDict['item_image_url'] = this.getItemImageUrl(value, imageURL);
      returnDict['item_id'] = value['id'];
      returnDict['position'] = 9999;
      if (value['position'] != null) {
        returnDict['position'] = value['position'];
      }

      // Check tradable after value
      if (value['tradable_after'] !== undefined) {
        const tradable_after_date = new Date(value['tradable_after']);
        const todaysDate = new Date();
        if (
          tradable_after_date >= todaysDate &&
          returnDict['item_name'].includes('Key') == false
        ) {
          returnDict['trade_unlock'] = tradable_after_date;
        }
      }

      if (value['casket_contained_item_count'] !== undefined) {
        returnDict['item_storage_total'] = value['casket_contained_item_count'];
      }

      // Check paint_wear value
      if (value['paint_wear'] !== undefined) {
        returnDict['item_wear_name'] = this.handleError(getSkinWearName, [
          value['paint_wear'],
        ]);
        returnDict['item_paint_wear'] = value['paint_wear'];
      }

      // Trade restrictions (maybe?)
      returnDict['item_origin'] = value['origin'];

      returnDict['item_moveable'] = this.handleError(
        this.itemProcessorCanBeMoved,
        [returnDict, value]
      );

      returnDict['item_has_stickers'] = this.handleError(
        this.itemProcessorHasStickersApplied,
        [returnDict, value]
      );
      let equipped = this.handleError(this.itemProcessorisEquipped, [value]);
      returnDict['equipped_ct'] = equipped[0];
      returnDict['equipped_t'] = equipped[1];
      returnDict['def_index'] = value['def_index'];
      returnDict['item_collection'] = this.getItemCollection(value);

      if (returnDict['item_has_stickers']) {
        const stickerList = [];
        for (const [stickersKey, stickersValue] of Object.entries(
          value['stickers']
        )) {
          stickerList.push(
            this.handleError(this.stickersProcessData, [stickersValue])
          );
        }
        returnDict['stickers'] = stickerList;
      } else {
        returnDict['stickers'] = [];
      }

      if (
        value?.rarity == 6 ||
        value?.quality == 3 ||
        returnDict['item_name'].includes('Souvenir') ||
        !returnDict['item_url'].includes('econ/default_generated')
      ) {
        returnDict['tradeUp'] = false;
      } else {
        returnDict['rarity'] = value.rarity;
        returnDict['rarityName'] = this.handleError(
          this.itemProcessorGetRarityName,
          [value.rarity]
        );
        returnDict['tradeUp'] = true;
      }
      returnDict['stattrak'] = false;
      if (this.isStatTrak(value)) {
        returnDict['stattrak'] = true;
        returnDict['item_name'] = 'StatTrak™ ' + returnDict['item_name'];
      }
      // Star
      if (value['quality'] == 3) {
        returnDict['item_name'] = '★ ' + returnDict['item_name'];
        returnDict['item_moveable'] = true;
      }

      // Promotional pin fix
      if (returnDict['item_name']?.includes('Pin') && value['origin'] == 5) {
        returnDict['item_moveable'] = false;
      }

      // Promotional music kit fix
      if (value['music_index'] != undefined && value['origin'] == 0) {
        returnDict['item_moveable'] = false;
      }

      // returnDict['coordinator_data'] = JSON.stringify(value);
      // console.log(value, returnDict)

      returnList.push(returnDict);
    }
    return returnList;
  }

  itemProcessorGetRarityName(rarity) {
    const rarityDict = {
      1: 'Consumer Grade',
      2: 'Industrial Grade',
      3: 'Mil-Spec',
      4: 'Restricted',
      5: 'Classified',
      6: 'Covert',
    };
    return rarityDict[rarity];
  }

  itemProcessorHasStickersApplied(returnDict, storageRow) {
    if (
      returnDict['item_url'].includes('econ/characters') ||
      returnDict['item_url'].includes('econ/default_generated') ||
      returnDict['item_url'].includes('weapons/base_weapons')
    ) {
      if (storageRow['stickers'] !== undefined) {
        return true;
      }
    }
    return false;
  }

  itemProcessorisEquipped(storageRow) {
    // 2 = CT
    // 3 = T
    let CT = false;
    let T = false;

    for (const [key, value] of Object.entries(storageRow?.equipped_state)) {
      if (value?.new_class == 2) {
        T = true;
      }
      if (value?.new_class == 3) {
        CT = true;
      }
    }
    return [CT, T];
  }

  isStatTrak(storageRow) {
    if (storageRow['attribute'] !== undefined) {
      for (const [, value] of Object.entries(storageRow['attribute'])) {
        if (value['def_index'] == 80) {
          return true;
        }
      }
    }
    return false;
  }

  itemProcessorName(storageRow, imageURL) {
    const defIndexresult = this.get_def_index(storageRow['def_index']);

    // Check if CSGO Case Key
    if (imageURL == 'econ/tools/weapon_case_key') {
      return 'CS:GO Case Key';
    }

    // Music kit check
    if (storageRow['music_index'] !== undefined) {
      const musicKitIndex = storageRow['music_index'];
      const musicKitResult = this.getMusicKits(musicKitIndex);
      let nameToUse =
        'Music Kit | ' + this.getTranslation(musicKitResult['loc_name']);

      return nameToUse;
    }

    // Main checks
    // Get first string
    if (defIndexresult['item_name'] !== undefined) {
      var baseOne = this.getTranslation(defIndexresult['item_name']);
    } else if (defIndexresult['prefab'] !== undefined) {
      const baseSkinName = this.getPrefab(defIndexresult['prefab'])[
        'item_name'
      ];
      var baseOne = this.getTranslation(baseSkinName);
    }

    // Get second string
    if (
      storageRow['stickers'] !== undefined &&
      imageURL.includes('econ/characters/') == false
    ) {
      var relevantStickerData = storageRow['stickers'][0];
      if (
        relevantStickerData['slot'] == 0 &&
        baseOne.includes('Coin') == false
      ) {
        var stickerDefIndex = this.getStickerDetails(
          relevantStickerData['sticker_id']
        );
        var baseTwo = this.getTranslation(stickerDefIndex['item_name']);
      }
    }
    if (storageRow['paint_index'] !== undefined) {
      var skinPatternName = this.getPaintDetails(storageRow['paint_index']);
      var baseTwo = this.getTranslation(skinPatternName['description_tag']);
    }

    // Get third string (wear name)
    if (storageRow['paint_wear'] !== undefined) {
      var baseThree = getSkinWearName(storageRow['paint_wear']);
    }

    if (baseOne) {
      var finalName = baseOne;
      if (baseTwo) {
        var finalName = `${baseOne} | ${baseTwo}`;
        if (baseThree) {
          var finalName = `${baseOne} | ${baseTwo}`;
        }
      }
    }

    if (storageRow['attribute'] !== undefined) {
      for (const [, value] of Object.entries(storageRow['attribute'])) {
        if (
          value['def_index'] == 140 &&
          finalName.includes('Souvenir') == false
        ) {
          var finalName = 'Souvenir ' + finalName;
        }
      }
    }

    // Graffiti kit check
    if (storageRow['graffiti_tint'] !== undefined) {
      const graffitiKitIndex = storageRow['graffiti_tint'];
      const graffitiKitResult = capitalizeWords(
        this.getGraffitiKitName(graffitiKitIndex).replaceAll('_', ' ')
      );
      var finalName = finalName + ' (' + graffitiKitResult + ')';
      var finalName = finalName.replace('Swat', 'SWAT');
    }

    // Keychain check only if not main item TODO: for item_name add keychain like stickers info
    if (storageRow['keychain_index'] !== undefined) {
  const keychainIndex = storageRow['keychain_index'];
  const keyChainResult = this.getKeyChains(keychainIndex);
  let nameToUse =
    'Charm | ' + this.getTranslation(keyChainResult['loc_name']);

  return nameToUse;
}

    return finalName;
  }

  itemProcessorImageUrl(storageRow) {
    const defIndexresult = this.get_def_index(storageRow['def_index']);

    // Music kit check
    if (storageRow['music_index'] !== undefined) {
      const musicKitIndex = storageRow['music_index'];
      const localMusicKits = this.getMusicKits(musicKitIndex);
      return localMusicKits['image_inventory'];
    }

    // Rest of check

    // Check if it should use the full image_inventory
    if (defIndexresult['image_inventory'] !== undefined) {
      var imageInventory = defIndexresult['image_inventory'];
    }

    // Get second string
    if (storageRow['stickers'] !== undefined && imageInventory == undefined) {
      var relevantStickerData = storageRow['stickers'][0];
      if (relevantStickerData['slot'] == 0) {
        var stickerDefIndex = this.getStickerDetails(
          relevantStickerData['sticker_id']
        );
        if (stickerDefIndex['patch_material'] !== undefined) {
          var imageInventory = `econ/patches/${stickerDefIndex['patch_material']}`;
        } else if (stickerDefIndex['sticker_material'] !== undefined) {
          var imageInventory = `econ/stickers/${stickerDefIndex['sticker_material']}`;
        }
      }
    }
    // Weapons and knifes
    if (storageRow['paint_index'] !== undefined) {
      var skinPatternName = this.getPaintDetails(storageRow['paint_index']);
      var imageInventory = `econ/default_generated/${defIndexresult['name']}_${skinPatternName['name']}_light`;
    } else if (defIndexresult['baseitem'] == 1) {
      var imageInventory = `econ/weapons/base_weapons/${defIndexresult['name']}`;
    }

    if (!imageInventory && storageRow['keychain_index'] !== undefined) {
      const keychainIndex = storageRow['keychain_index'];
      const localKeychains = this.getKeyChains(keychainIndex);
      return localKeychains['image_inventory'];
    }

    return imageInventory;
  }
  itemProcessorCanBeMoved(returnDict, storageRow) {
    const defIndexresult = this.get_def_index(storageRow['def_index']);

    if (defIndexresult['prefab'] !== undefined) {
      if (defIndexresult['prefab'] == 'collectible_untradable') {
        return false;
      }
    }
    if (defIndexresult['item_name'] !== undefined) {
      if (
        returnDict['item_url'].includes('econ/status_icons/') &&
        returnDict['item_origin'] == 0
      ) {
        return false;
      }
      if (returnDict['item_url'].includes('econ/status_icons/service_medal_')) {
        return false;
      }

      if (storageRow['def_index'] == 987) {
        return false;
      }

      if (returnDict['item_url'].includes('plusstars')) {
        return false;
      }
    }

    // If characters
    if (defIndexresult['attributes'] !== undefined) {
      for (const [key, value] of Object.entries(defIndexresult['attributes'])) {
        if (key == 'cannot trade' && value == 1) {
          return false;
        }
      }
    }
    if (
      returnDict['item_url'].includes('crate_key') &&
      storageRow['flags'] == 10
    ) {
      return false;
    }
    if (returnDict['item_url'].includes('weapons/base_weapons')) {
      return false;
    }
    return true;
  }
  stickersProcessData(relevantStickerData) {
    // Get second string
    var stickerDefIndex = this.getStickerDetails(
      relevantStickerData['sticker_id']
    );
    if (stickerDefIndex['patch_material'] !== undefined) {
      var imageInventory = `econ/patches/${stickerDefIndex['patch_material']}`;
      var stickerType = 'Patch';
    } else if (stickerDefIndex['sticker_material'] !== undefined) {
      var imageInventory = `econ/stickers/${stickerDefIndex['sticker_material']}`;
      var stickerType = 'Sticker';
    }
    const stickerDict = {
      sticker_name: this.getTranslation(stickerDefIndex['item_name']),
      sticker_url: imageInventory,
      sticker_image_url: this.getItemImageUrl(
        { def_index: relevantStickerData['sticker_id'] },
        imageInventory
      ),
      sticker_type: stickerType,
    };
    return stickerDict;
  }

  get_def_index(def_index) {
    return this.csgoItems['items'][def_index];
  }

  getCollectionIndex() {
    if (this.collectionIndex) return this.collectionIndex;

    this.collectionIndex = {};
    const itemSets = this.csgoItems['item_sets'] || {};
    for (const [, itemSet] of Object.entries(itemSets)) {
      if (!itemSet || itemSet.is_collection != 1 || !itemSet.items) continue;
      const collectionName = this.handleError(this.getTranslation, [itemSet.name])
        .replace(/^The\s+/i, '');
      if (!collectionName) continue;
      for (const itemKey of Object.keys(itemSet.items)) {
        this.collectionIndex[itemKey] = collectionName;
      }
    }
    return this.collectionIndex;
  }

  getItemCollection(storageRow) {
    if (storageRow['paint_index'] === undefined) return undefined;
    const paintKit = this.csgoItems['paint_kits']?.[storageRow['paint_index']];
    const itemDefinition = this.get_def_index(storageRow['def_index']);
    if (!paintKit?.name || !itemDefinition?.name) return undefined;
    return this.getCollectionIndex()[`[${paintKit.name}]${itemDefinition.name}`];
  }

  getTranslation(csgoString) {
    let stringFormatted = csgoString.replace('#', '').toLowerCase();

    return this.translation[stringFormatted].replaceAll('"', '');
  }
  getPrefab(prefab) {
    return this.csgoItems['prefabs'][prefab.toString()];
  }

  getPaintDetails(paintIndex) {
    return this.csgoItems['paint_kits'][paintIndex];
  }

  getMusicKits(musicIndex) {
    return this.csgoItems['music_kits'][musicIndex];
  }

  getKeyChains(keychainIndex) {
    return this.csgoItems['keychains'][keychainIndex];
  }

  getGraffitiKitName(graffitiID) {
    for (const [key, value] of Object.entries(
      this.csgoItems['graffiti_tints']
    )) {
      if (value.id == graffitiID) {
        return key;
      }
    }
  }

  getStickerDetails(stickerID) {
    return this.csgoItems['sticker_kits'][stickerID];
  }

  checkIfAttributeIsThere(item, attribDefIndex) {
    let attrib = (item.attribute || []).find(
      (attrib) => attrib.def_index == attribDefIndex
    );
    return attrib ? true : false;
  }
}

function getSkinWearName(paintWear) {
  const skinWearValues = [0.07, 0.15, 0.38, 0.45, 1];
  const skinWearNames = [
    'Factory New',
    'Minimal Wear',
    'Field-Tested',
    'Well-Worn',
    'Battle-Scarred',
  ];

  for (const [key, value] of Object.entries(skinWearValues)) {
    if (paintWear > value) {
      continue;
    }
    return skinWearNames[key];
  }
}

function getAttributeValueBytes(item, attribDefIndex) {
  let attrib = (item.attribute || []).find(
    (attrib) => attrib.def_index == attribDefIndex
  );
  return attrib ? attrib.value_bytes : null;
}

function capitalizeWords(string) {
  return string.replace(/(?:^|\s)\S/g, function (a) {
    return a.toUpperCase();
  });
}
module.exports = items;
