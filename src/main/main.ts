import 'core-js/stable';
import { BrowserWindow, app, ipcMain, session, shell } from 'electron';
import * as fs from 'fs';
import GlobalOffensive from 'globaloffensive';
import os from 'os';
import path from 'path';
import 'regenerator-runtime/runtime';
import { CurrencyReturnValue } from '../shared/Interfaces.tsx/IPCReturn';
import { LoginCommandReturnPackage } from '../shared/Interfaces.tsx/store';
import SteamUser from 'steam-user';
const TradeOfferManager = require('steam-tradeoffer-manager');
const SteamID = require('steamid');
import { LoginGenerator } from './helpers/classes/IPCGenerators/loginGenerator';
import { currency } from './helpers/classes/steam/currency';
import { fetchItems } from './helpers/classes/steam/items/getCommands';
import {
  currencyCodes,
  pricingEmitter,
  runItems,
} from './helpers/classes/steam/pricing';
import {
  deleteUserData,
  getRefreshToken,
  getValue,
  setAccountPosition,
  setValue,
  setAccountTradeURL,
  setAccountInventoryCapacity,
  refreshSavedProfileDetails,
  storeRefreshToken,
  storeUserAccount,
} from './helpers/classes/steam/settings';
import { login } from './helpers/classes/steam/steam';
import { tradeUps } from './helpers/classes/steam/tradeup';
import MenuBuilder from './menu';
import { getGithubVersion } from './scripts/versionHelper';
import { resolveHtmlPath } from './util';
// import log from 'electron-log';
import log from 'electron-log';
import { autoUpdater } from 'electron-updater';
import { emitterAccount } from '../emitters';
import { flowLoginRegularQR } from './helpers/login/flowLoginRegularQR';
import find from 'find-process';

declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;

if (require('electron-squirrel-startup')) app.quit();

autoUpdater.logger = log;
// @ts-ignore
autoUpdater.logger.transports.file.level = 'info';
log.info('App starting...');

app.on('ready', function () {
  autoUpdater.checkForUpdatesAndNotify();
});

autoUpdater.on('checking-for-update', () => {
  sendUpdaterStatusToWindow('Checking for update...');
});
autoUpdater.on('update-available', (_info) => {
  sendUpdaterStatusToWindow('Update available.');
});
autoUpdater.on('update-not-available', (_info) => {
  sendUpdaterStatusToWindow('Update not available.');
});
autoUpdater.on('error', (err) => {
  sendUpdaterStatusToWindow('Error in auto-updater. ' + err);
});
autoUpdater.on('download-progress', (progressObj) => {
  let log_message = 'Download speed: ' + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message =
    log_message +
    ' (' +
    progressObj.transferred +
    '/' +
    progressObj.total +
    ')';
  sendUpdaterStatusToWindow(log_message);
});
autoUpdater.on('update-downloaded', (_info) => {
  sendUpdaterStatusToWindow('Update downloaded');
});

async function checkSteam(): Promise<{
  pid?: number;
  status: boolean;
}> {
  let steamName = 'steam.exe';
  if (process.platform == 'linux') {
    return {
      status: false,
    };
  }
  if (process.platform == 'darwin') {
    return {
      status: false,
    };
    steamName = 'steam_osx';
  }
  return await find('name', steamName, true)
    .then(function (list) {
      if (list.length > 0) {
        return {
          pid: list[0].pid,
          status: true,
        };
      }
      return {
        status: false,
      };
    })
    .catch(function (_err) {
      return {
        status: false,
      };
    });
}
checkSteam();

// Define helpers
var ByteBuffer = require('bytebuffer');
const Protos = require('globaloffensive/protobufs/generated/_load.js');
const Language = require('globaloffensive/language.js');
const currencyClass = new currency();
let tradeUpClass = new tradeUps();
const ClassLoginResponse = new LoginGenerator();
let activeTradeManager: any = null;
let tradeManagerError = 'Steam trade session is not ready yet.';
let savedCapacityQueue: Promise<void> = Promise.resolve();
const CS2_INVENTORY_LIMIT = 1000;
const MAX_CS2_TRADE_OFFER_ITEMS = 1000;

function refreshSavedAccountCapacity(username: string): Promise<{
  inventorySlots: number;
  freeSlots: number;
  limit: number;
  updatedAt: string;
}> {
  const runAfterPreviousRequest = savedCapacityQueue.catch(() => undefined);
  const task = runAfterPreviousRequest.then(async () => {
    const accounts = await getValue('account') as any;
    if (!accounts?.[username]) {
      throw new Error('Saved Steam profile was not found.');
    }

    let refreshToken: string;
    try {
      refreshToken = await getRefreshToken(username);
    } catch (_error) {
      throw new Error('The saved session for this profile has expired. Sign in to it again.');
    }

    return new Promise<{
      inventorySlots: number;
      freeSlots: number;
      limit: number;
      updatedAt: string;
    }>((resolve, reject) => {
      const temporaryUser = new SteamUser({
        autoRelogin: false,
        // Steam-user's TCP implementation is the compatible client-session
        // transport for Game Coordinator inventory requests.
        protocol: (SteamUser as any).EConnectionProtocol.TCP,
      });
      const temporaryCSGO = new GlobalOffensive(temporaryUser);
      let finished = false;
      let timeout: NodeJS.Timeout;
      const finish = (error?: Error, result?: {
        inventorySlots: number;
        freeSlots: number;
        limit: number;
        updatedAt: string;
      }) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        temporaryCSGO.removeAllListeners();
        temporaryUser.removeAllListeners();
        temporaryUser.gamesPlayed([]);
        temporaryUser.logOff();
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      };
      timeout = setTimeout(() => {
        finish(new Error('Steam did not return this profile inventory in time. Try again.'));
      }, 45000);

      temporaryUser.once('error', (error) => {
        finish(new Error(`Steam could not open this saved session: ${error}`));
      });
      temporaryUser.once('loggedOn', () => {
        temporaryUser.gamesPlayed([730], true);
      });
      temporaryCSGO.once('connectedToGC', () => {
        const sourceInventory = Array.isArray(temporaryCSGO.inventory)
          ? temporaryCSGO.inventory
          : Object.values(temporaryCSGO.inventory || {});
        // This is the authenticated GC inventory. Do not filter by
        // tradability: trade-held items consume a normal inventory slot too.
        // The GC also keeps loaded Storage Unit contents in this array. Those
        // rows have casket_id and must be excluded: an incoming trade-held
        // item cannot use space inside a Storage Unit.
        const directItems = sourceInventory.filter(
          (item: any) => item?.id && item.casket_id === undefined,
        );
        const inventorySlots = directItems.length;
        const result = {
          inventorySlots,
          freeSlots: Math.max(0, CS2_INVENTORY_LIMIT - inventorySlots),
          limit: CS2_INVENTORY_LIMIT,
          updatedAt: new Date().toISOString(),
        };
        const steamID = String(
          temporaryUser.logOnResult?.client_supplied_steamid ||
          temporaryUser.steamID?.getSteamID64?.() ||
          '',
        );
        setAccountInventoryCapacity(username, result, steamID)
          .then(() => finish(undefined, result))
          .catch((error) => finish(error));
      });

      temporaryUser.logOn({ refreshToken });
    });
  });

  savedCapacityQueue = task.then(() => undefined, () => undefined);
  return task;
}

// Electron stuff
let mainWindow: BrowserWindow | null = null;
ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDevelopment =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS', 'REDUX_DEVTOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  // Downloading browser extensions can block the first window for a long
  // time, especially when GitHub is slow or unavailable. Opt in only when
  // actively debugging React or Redux.
  if (isDevelopment && process.env.INSTALL_DEVTOOLS === '1') {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  let frameValue = true;
  if (process.platform == 'win32') {
    frameValue = false;
  }

  mainWindow = new BrowserWindow({
    show: false,
    width: 1124,
    height: 850,
    minWidth: 1030,
    minHeight: 800,
    frame: frameValue,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      // This is a user-facing app, not a browser. Prevent DevTools from
      // opening through shortcuts or programmatically in every build.
      devTools: false,
      nodeIntegration: true,
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      sandbox: false,
      enableBlinkFeatures: 'CSSColorSchemeUARendering',
    },
  });
  mainWindow.webContents.session.clearStorageData();

  // Set a more compatible CSP for React/Webpack/Electron
  mainWindow.webContents.session.webRequest.onHeadersReceived(
    (details, callback) => {
      const { responseHeaders } = details;
      UpsertKeyValue(responseHeaders, 'Access-Control-Allow-Origin', ['*']);
      UpsertKeyValue(responseHeaders, 'Access-Control-Allow-Headers', ['*']);

      UpsertKeyValue(responseHeaders, 'Content-Security-Policy', [
          "default-src 'self' 'unsafe-inline' data:; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data: https://raw.githubusercontent.com https://cdn.jsdelivr.net https://community.akamai.steamstatic.com https://cdn.steamstatic.com https://avatars.akamai.steamstatic.com https://avatars.fastly.steamstatic.com; " +
            "connect-src 'self' https://steamcommunity.com;",
      ]);

      callback({
        responseHeaders,
      });
    },
  );

  mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
    (details, callback) => {
      callback({ requestHeaders: { Origin: '*', ...details.requestHeaders } });
    },
  );

  ipcMain.on('download', (_event, info) => {
    const downloadsDirectory = app.getPath('downloads');
    let fileP = path.join(downloadsDirectory, 'casemove.csv');

    try {
      fs.writeFileSync(fileP, info, 'utf-8');
    } catch (error: any) {
      // Excel locks an opened CSV on Windows. Preserve the open file and
      // create a timestamped export instead of crashing the application.
      if (error?.code !== 'EBUSY' && error?.code !== 'EPERM') {
        throw error;
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      fileP = path.join(downloadsDirectory, `casemove-${timestamp}.csv`);
      fs.writeFileSync(fileP, info, 'utf-8');
    }
    shell.showItemInFolder(fileP);
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  mainWindow.on('ready-to-show', () => {
    console.log(app.getVersion());
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (process.platform == 'linux') {
    mainWindow.removeMenu();
  }
};

/**
 * Add event listeners...
 */
// Windows actions

ipcMain.on('windowsActions', async (_event, message) => {
  if (message == 'min') {
    mainWindow?.minimize();
  }
  if (message == 'max') {
    if (mainWindow?.isMaximized()) {
      mainWindow.restore();
    } else {
      mainWindow?.maximize();
    }
  }
  if (message == 'close') {
    mainWindow?.close();
  }
});

let currentLocale = 'da-dk';

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
    // localStorage.clear();
  }
});

let myWindow = null as any;
const gotTheLock = app.requestSingleInstanceLock();
const reactNombers = false;

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (myWindow) {
      if (myWindow.isMinimized()) myWindow.restore();
      myWindow.focus();
    }
  });
  app
    .whenReady()
    .then(async () => {
      currentLocale = app.getLocale();
      console.log('Currentlocal', currentLocale);

      if (process.env.NODE_ENV === 'development' && reactNombers) {
        let reactDevToolsPath = '';
        // on windows
        console.log(process.platform);
        if (process.platform == 'win32') {
          reactDevToolsPath = path.join(
            os.homedir(),
            '/AppData/Local/Google/Chrome/User Data/Default/Extensions/lmhkpmbekcpmknklioeibfkpmmfibljd/3.0.9_0',
          );
        }

        // On linux
        if (process.platform == 'linux') {
          reactDevToolsPath = path.join(
            os.homedir(),
            '/.config/google-chrome/Default/Extensions/lmhkpmbekcpmknklioeibfkpmmfibljd/3.0.9_0',
          );
        }
        // on macOS
        if (process.platform == 'darwin') {
          reactDevToolsPath = path.join(
            os.homedir(),
            '/Library/Application Support/Google/Chrome/Default/Extensions/lmhkpmbekcpmknklioeibfkpmmfibljd/3.0.9_0',
          );
        }

        await session.defaultSession.loadExtension(reactDevToolsPath);
      }
      createWindow();
      app.on('activate', () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (mainWindow === null) createWindow();
      });
    })
    .catch(console.log);
}

/**
 * IPC...
 */

var fetchItemClass = new fetchItems();
// The GC can briefly return an old inventory snapshot after a CasketAdded
// notification. Keep confirmed stored asset IDs out of every direct-inventory
// view until Steam itself marks them with casket_id.
const confirmedStoredAssetIDs = new Set<string>();

function getDirectInventoryForRenderer(inventoryData: any) {
  const rows = Array.isArray(inventoryData)
    ? inventoryData
    : Object.values(inventoryData || {});
  return rows.filter(
    (item: any) => !confirmedStoredAssetIDs.has(String(item?.id)),
  );
}

// Version manager

let gitHub = 0;
ipcMain.on('needUpdate', async (event: any) => {
  try {
    if (gitHub == 0) {
      getGithubVersion(process.platform).then((returnValue) => {
        // Get the current version
        const version = parseInt(
          app.getVersion().toString().replaceAll('.', ''),
        );

        // Check success status
        let successStatus: boolean = false;
        if (returnValue.version > version) {
          successStatus = true;
        } else {
          successStatus = false;
        }

        // Send the event back back
        event.reply('needUpdate-reply', {
          requireUpdate: successStatus,
          currentVersion: app.getVersion(),
          githubResponse: returnValue,
        });
      });
    }
  } catch {
    event.reply('needUpdate-reply', [false, app.getVersion(), 0]);
    gitHub = 1;
  }
});

// Return 1 = Success
// Return 2 = Steam Guard
// Return 3 = Steam Guard wrong
// Return 4 = Wrong password
// Return 5 = Unknown
// Return 6 = Error with loginkey
async function sendLoginReply(event: any) {
  event.reply('login-reply', ClassLoginResponse.returnValue);
}

ipcMain.handle('check-steam', async () => {
  const pid = await checkSteam();
  if (pid.status) {
    return true;
  }
  return false;
});

ipcMain.handle('close-steam', async () => {
  const pid = await checkSteam();
  if (pid.status) {
    process.kill(pid.pid as number);
    return true;
  }
  return false;
});

emitterAccount.on(
  'login',
  async (
    event,
    user: SteamUser,
    csgo: GlobalOffensive,
    username: string,
    shouldRemember: boolean,
    secretKey: string | null,
  ) => {
    log.info(`[login] starting Steam session for ${username}`);
    confirmedStoredAssetIDs.clear();
    user.once('loggedOn', () => {
      log.info(`[login] Steam accepted session for ${username}`);
    });
    user.once('error', (error) => {
      log.warn(`[login] Steam session error for ${username}: ${String(error)}`);
    });

    // Success
    user.once('accountInfo', (displayName) => {
      console.log('Logged into Steam as main ' + displayName);
      getValue('pricing.currency').then((returnValue) => {
        if (returnValue == undefined) {
          setValue(
            'pricing.currency',
            currencyCodes?.[user?.wallet?.currency] || 'USD',
          );
        }
      });
      console.log('logged on main');

      async function gameCoordinate(resolve: any = null) {
        csgo.once('connectedToGC', () => {
          if (resolve) {
            resolve('GC');
          }
          console.log('Connected to GC!');
          if (csgo.haveGCSession) {
            console.log('Have Session!');
            fetchItemClass
              .convertInventory(getDirectInventoryForRenderer(csgo.inventory))
              .then((returnValue) => {
                tradeUpClass
                  .getTradeUp(returnValue)
                  .then((newReturnValue: any) => {
                    let walletToSend = user.wallet;
                    if (walletToSend) {
                      walletToSend.currency =
                        currencyCodes?.[walletToSend?.currency];
                    }
                    const returnPackage: LoginCommandReturnPackage = {
                      steamID: user.logOnResult.client_supplied_steamid,
                      displayName,
                      haveGCSession: csgo.haveGCSession,
                      csgoInventory: newReturnValue,
                      walletToSend: walletToSend,
                    };

                    startEvents(csgo, user);
                    if (shouldRemember) {
                      storeUserAccount(
                        username,
                        displayName,
                        user.logOnResult.client_supplied_steamid,
                        secretKey,
                      );
                    }
                    ClassLoginResponse.setResponseStatus('loggedIn');
                    ClassLoginResponse.setPackage(returnPackage);
                    sendLoginReply(event);
                  });
              });
          }
        });
      }

      // // Create a timeout race to catch an infinite loading error in case the Steam account hasnt added the CSGO license
      // Run the normal version

      let gameCoordinatorStarted = false;
      const startGameCoordinatorOnce = (resolve: any = null) => {
        if (gameCoordinatorStarted) return;
        gameCoordinatorStarted = true;
        gameCoordinate(resolve);
        startGameCoordinator();
      };

      let GCResponse = new Promise((resolve) => {
        user.once('playingState', function (blocked, _playingApp) {
          if (!blocked) {
            startGameCoordinatorOnce(resolve);
          } else {
            ClassLoginResponse.setEmptyPackage();
            ClassLoginResponse.setResponseStatus('playingElsewhere');
            sendLoginReply(event);
            resolve('error');
          }
        });
      });

      // Refresh-token sessions do not always emit playingState. Start the
      // CS2 coordinator after a brief fallback delay so saved-profile login
      // cannot remain pending forever.
      setTimeout(() => {
        startGameCoordinatorOnce();
      }, 1500);

      // Run the timeout
      let timeout = new Promise((resolve, _reject) => {
        setTimeout(resolve, 10000, 'time');
      });

      // Run the timeout
      let error = new Promise((resolve, _reject) => {
        user.once('error', (error) => {
          if (error == 'Error: LoggedInElsewhere') {
            resolve('error');
          }
        });
      });

      // Race the two
      Promise.race([timeout, GCResponse, error]).then((value) => {
        if (value == 'error') {
          // Force login
          ipcMain.on('forceLogin', async () => {
            console.log('forceLogin');
            setTimeout(() => {
              // user.setPersona(SteamUser.EPersonaState.Online);
              gameCoordinate();
              user.gamesPlayed([730], true);
            }, 3000);

            ipcMain.removeAllListeners('forceLogin');
            ipcMain.removeAllListeners('signOut');
          });
          ipcMain.once('signOut', async () => {
            console.log('Sign out');
            user.logOff();
            ipcMain.removeAllListeners('forceLogin');
            ipcMain.removeAllListeners('signOut');
          });
        }
        if (value == 'time') {
          console.log(
            'GC didnt start in time, adding CSGO to the library and retrying.',
          );
          user.requestFreeLicense([730], function (err, packageIds, appIds) {
            if (err) {
              console.log(err);
              ClassLoginResponse.setEmptyPackage();
              ClassLoginResponse.setResponseStatus('playingElsewhere');
              sendLoginReply(event);
            }
            console.log('Granted package: ', packageIds);
            console.log('Granted App: ', appIds);
            startGameCoordinator();
          });
        }
      });
    });

    // Steam guard
    user.once('steamGuard', function (domain, callback, lastCodeWrong) {
      domain;
      callback;
      if (lastCodeWrong) {
        console.log('Last code wrong, try again!');
        cancelLogin(user);

        ClassLoginResponse.setEmptyPackage();
        ClassLoginResponse.setResponseStatus('steamGuardCodeIncorrect');
        sendLoginReply(event);
      } else {
        cancelLogin(user);
        ClassLoginResponse.setEmptyPackage();
        ClassLoginResponse.setResponseStatus('steamGuardError');
        sendLoginReply(event);
      }
    });

    // Login

    // Start the game coordinator for CSGO
    async function startGameCoordinator() {
      // user.setPersona(SteamUser.EPersonaState.Online);

      setTimeout(() => {
        // user.setPersona(SteamUser.EPersonaState.Online);
        user.gamesPlayed([730], true);
      }, 3000);
    }
  },
);

ipcMain.on(
  'login',
  async (
    event,
    username,
    password = null,
    shouldRemember,
    steamGuard = null,
    secretKey = null,
    clientjstoken = null,
  ) => {
    let user = new SteamUser({
      renewRefreshTokens: true,
      protocol: (SteamUser as any).EConnectionProtocol.TCP,
    });
    user.on('refreshToken', (refreshToken) => {
      if (shouldRemember) {
        storeRefreshToken(username, refreshToken);
      }
    });
    let csgo = new GlobalOffensive(user);
    emitterAccount.emit(
      'login',
      event,
      user,
      csgo,
      username,
      shouldRemember,
      secretKey,
    );
    let loginClass = new login();
    loginClass
      .mainLogin(
        user,
        username,
        shouldRemember,
        password,
        steamGuard,
        secretKey,
        clientjstoken,
      )
      .then((returnValue: any) => {
        console.log(returnValue);
        event.reply('login-reply', returnValue);
      });
  },
);

emitterAccount.on('qrLogin:show', async (qrChallengeLogin) => {
  mainWindow?.webContents.send('qrLogin:show', qrChallengeLogin);
});
ipcMain.on('startQRLogin', async (event, shouldRemember) => {
  let user = new SteamUser({
    renewRefreshTokens: true,
    protocol: (SteamUser as any).EConnectionProtocol.TCP,
  });
  let csgo = new GlobalOffensive(user);
  let loginClass = new login();
  emitterAccount.emit('qrLogin:cancel');
  flowLoginRegularQR(shouldRemember).then((returnValue) => {
    if (!returnValue.session) {
      // QR errors previously left the renderer waiting forever because it
      // never received a login-reply. Always finish the IPC request.
      event.reply('login-reply', {
        responseStatus: returnValue.responseStatus,
        returnPackage: {
          errorMessage: returnValue.errorMessage,
        },
      });
      return;
    }

    user.on('refreshToken', (refreshToken) => {
      if (shouldRemember) {
        storeRefreshToken(returnValue.session.accountName, refreshToken);
      }
    });

    emitterAccount.emit(
      'login',
      event,
      user,
      csgo,
      returnValue.session.accountName,
      shouldRemember,
    );
    loginClass
      .mainLogin(
        user,
        returnValue.session.accountName,
        shouldRemember,
        null,
        null,
        null,
        null,
        returnValue.session.refreshToken,
      )
      .then((returnValue: any) => {
        event.reply('login-reply', returnValue);
      });
  });
});

ipcMain.on('qrLogin:cancel', async () => {
  emitterAccount.emit('qrLogin:cancel');
});

async function cancelLogin(user) {
  console.log('Cancel login');
  user.removeAllListeners('loggedOn');
  user.removeAllListeners('loginKey');
  user.removeAllListeners('steamGuard');
  user.removeAllListeners('error');
}

function sendUpdaterStatusToWindow(text) {
  log.info(text);
  mainWindow?.webContents.send('updater', [text]);
}

// Adds events listeners the user
// Forward Steam notifications to renderer
async function startEvents(csgo, user) {
  // Trade offers use the authenticated web session of the currently active
  // account. No public inventory endpoint is involved, so trade-held items
  // remain part of the inventory data shown in the renderer.
  activeTradeManager = new TradeOfferManager({
    steam: user,
    language: 'en',
    pollInterval: 30000,
  });
  tradeManagerError = 'Preparing Steam trade session…';
  user.on('webSession', (_sessionID, cookies) => {
    activeTradeManager.setCookies(cookies, (error) => {
      tradeManagerError = error
        ? `Steam trade session error: ${error.message || error}`
        : '';
      if (error) {
        console.log('Steam trade session error:', error);
      }
    });
  });
  user.webLogOn();

  // Pricing
  const pricing = new runItems(user);
  pricingEmitter.on('result', (message) => {
    mainWindow?.webContents.send('pricing', [message]);
  });
  ipcMain.on('getPrice', async (_event, info) => {
    pricing.handleItem(info);
  });

  // Trade up handlers
  ipcMain.on('getTradeUpPossible', async (event, itemsToGet) => {
    tradeUpClass.getPotentitalOutcome(itemsToGet).then((returnValue) => {
      pricing.handleTradeUp(returnValue);
      event.reply('getTradeUpPossible-reply', returnValue);
    });
  });
  ipcMain.on('processTradeOrder', async (_event, idsToProcess, rarityToUse) => {
    const rarObject = {
      0: '00000A00',
      1: '01000A00',
      2: '02000A00',
      3: '03000A00',
      4: '04000A00',
      10: '0a000a00',
      11: '0b000a00',
      12: '0c000a00',
      13: '0d000a00',
      14: '0e000a00',
    };
    let idsToUse = [] as any;
    idsToProcess.forEach((element) => {
      idsToUse.push(parseInt(element));
    });
    let tradeupPayLoad = new ByteBuffer(
      1 + 2 + idsToUse.length * 8,
      ByteBuffer.LITTLE_ENDIAN,
    );
    tradeupPayLoad.append(rarObject[rarityToUse], 'hex');
    for (let id of idsToUse) {
      tradeupPayLoad.writeUint64(id);
    }
    await csgo._send(Language.Craft, null, tradeupPayLoad);
  });

  // Open container
  ipcMain.on('openContainer', async (_event, itemsToOpen) => {
    let containerPayload = new ByteBuffer(16, ByteBuffer.LITTLE_ENDIAN);
    containerPayload.append('0000000000000000', 'hex');
    for (let id of itemsToOpen) {
      containerPayload.writeUint64(parseInt(id));
    }
    await csgo._send(Language.UnlockCrate, null, containerPayload);
  });

  // CSGO listeners
  // Inventory events
  async function startChangeEvents() {
    console.log('Start events');
    csgo.on('itemRemoved', (item) => {
      if (
        !Object.keys(item).includes('casket_id') &&
        !Object.keys(item).includes('casket_contained_item_count')
      ) {
        console.log('Item ' + item.id + ' was removed');
        fetchItemClass.convertInventory(getDirectInventoryForRenderer(csgo.inventory)).then((returnValue) => {
          tradeUpClass.getTradeUp(returnValue).then((newReturnValue: any) => {
            mainWindow?.webContents.send('userEvents', [
              1,
              'itemRemoved',
              [item, newReturnValue],
            ]);
          });
        });
      }
    });

    csgo.on('itemChanged', (item) => {
      fetchItemClass.convertInventory(getDirectInventoryForRenderer(csgo.inventory)).then((returnValue) => {
        tradeUpClass.getTradeUp(returnValue).then((newReturnValue: any) => {
          mainWindow?.webContents.send('userEvents', [
            1,
            'itemChanged',
            [item, newReturnValue],
          ]);
        });
      });
    });

    csgo.on('itemAcquired', (item) => {
      if (
        !Object.keys(item).includes('casket_id') &&
        !Object.keys(item).includes('casket_contained_item_count')
      ) {
        console.log('Item ' + item.id + ' was acquired');
        removeInventoryListeners();
        setTimeout(function () {
          console.log('ran');
          startChangeEvents();
          fetchItemClass
            .convertInventory(getDirectInventoryForRenderer(csgo.inventory))
            .then((returnValue) => {
              tradeUpClass.getTradeUp(returnValue).then((newReturnValue) => {
                mainWindow?.webContents.send('userEvents', [
                  1,
                  'itemAcquired',
                  [{}, newReturnValue],
                ]);
              });
            });
        }, 1000);

        fetchItemClass.convertInventory(getDirectInventoryForRenderer(csgo.inventory)).then((returnValue) => {
          tradeUpClass.getTradeUp(returnValue).then((newReturnValue: any) => {
            mainWindow?.webContents.send('userEvents', [
              1,
              'itemAcquired',
              [item, newReturnValue],
            ]);
          });
        });
      }
    });
  }
  startChangeEvents();

  csgo.on('disconnectedFromGC', (reason) => {
    console.log('Disconnected from GC - reason: ', reason);
    mainWindow?.webContents.send('userEvents', [
      3,
      'disconnectedFromGC',
      [reason],
    ]);
  });

  csgo.on('connectedToGC', () => {
    console.log('Connected to GC!');
    if (csgo.haveGCSession) {
      mainWindow?.webContents.send('userEvents', [3, 'connectedToGC']);
    }
  });

  // User listeners
  // Steam Connection
  user.on('error', (eresult, msg) => {
    console.log('main', eresult, msg);
    mainWindow?.webContents.send('userEvents', [2, 'fatalError']);
    clearForNewSession();
  });
  user.on('disconnected', (eresult, msg) => {
    console.log(eresult, msg);
    mainWindow?.webContents.send('userEvents', [2, 'disconnected']);
  });
  user.on('loggedOn', () => {
    mainWindow?.webContents.send('userEvents', [2, 'reconnected']);
  });
  user.on('wallet', (hasWallet, currency, balance) => {
    let walletToSend = { hasWallet, currency, balance };
    walletToSend.currency = currencyCodes?.[walletToSend?.currency];
    console.log('Wallet update: ', balance);
    mainWindow?.webContents.send('userEvents', [4, walletToSend]);
  });

  // Get commands from Renderer
  async function removeInventoryListeners() {
    console.log('Removed inventory listeners');
    csgo.removeAllListeners('itemRemoved');
    csgo.removeAllListeners('itemChanged');
    csgo.removeAllListeners('itemAcquired');
  }
  ipcMain.on('refreshInventory', async () => {
    removeInventoryListeners();
    startChangeEvents();

    fetchItemClass.convertInventory(getDirectInventoryForRenderer(csgo.inventory)).then((returnValue) => {
      tradeUpClass.getTradeUp(returnValue).then((newReturnValue) => {
        mainWindow?.webContents.send('userEvents', [
          1,
          'itemAcquired',
          [{}, newReturnValue],
        ]);
      });
    });
  });
  // Retry connection
  ipcMain.on('retryConnection', async () => {
    user.gamesPlayed([]);
    user.gamesPlayed([730]);
    console.log('Retrying');
  });
  // Rename Storage units
  ipcMain.on('renameStorageUnit', async (event, itemID, newName) => {
    csgo.nameItem(0, itemID, newName);
    csgo.once('itemCustomizationNotification', (itemIds, notificationType) => {
      if (
        notificationType ==
        GlobalOffensive.ItemCustomizationNotification.NameItem
      ) {
        event.reply('renameStorageUnit-reply', [1, itemIds[0]]);
      }
    });
  });

  // Set item positions
  ipcMain.on('setItemsPositions', async (_event, dictOfItems) => {
    await csgo._send(
      Language.SetItemPositions,
      Protos.CMsgSetItemPositions,
      dictOfItems,
    );
  });

  // Set item positions
  ipcMain.on(
    'setItemEquipped',
    async (_event, item_id, item_name, itemClass) => {
      item_name;

      await csgo._send(
        Language.k_EMsgGCAdjustItemEquippedState,
        Protos.CMsgAdjustItemEquippedState,
        {
          item_id: item_id,
          new_class: itemClass,
          new_slot: 0,
          swap: 0,
        },
      );
    },
  );

  // Remove items from storage unit
  ipcMain.on(
    'removeFromStorageUnit',
    async (event, casketID, itemID, fastMode) => {
      removeInventoryListeners();
      if (fastMode == false) {
        let finished = false;
        const finish = (result) => {
          if (finished) return;
          finished = true;
          clearTimeout(timeout);
          csgo.removeListener('itemCustomizationNotification', onNotification);
          event.reply('removeFromStorageUnit-reply', result);
        };
        const onNotification = (itemIds, notificationType) => {
          if (
            notificationType ==
            GlobalOffensive.ItemCustomizationNotification.CasketRemoved
          ) {
            console.log(itemIds + ' got an item removed from it');
            confirmedStoredAssetIDs.delete(String(itemID));
            finish([1, itemIds[0]]);
          }
        };
        const timeout = setTimeout(
          () => finish([0, 'Steam did not confirm the item removal in time.']),
          8000,
        );
        // Listen before sending the request. A different item-customisation
        // notification must not consume the one confirmation we are waiting for.
        csgo.on('itemCustomizationNotification', onNotification);
        csgo.removeFromCasket(casketID, itemID);
      } else {
        csgo.removeFromCasket(casketID, itemID);
      }
    },
  );

  // Move to Storage Unit
  ipcMain.on('moveToStorageUnit', async (event, casketID, itemID, fastMode) => {
    removeInventoryListeners();
    if (fastMode == false) {
      let finished = false;
      const finish = (result) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        csgo.removeListener('itemCustomizationNotification', onNotification);
        event.reply('moveToStorageUnit-reply', result);
      };
      const onNotification = (itemIds, notificationType) => {
          if (
            notificationType ==
            GlobalOffensive.ItemCustomizationNotification.CasketAdded
          ) {
            console.log(itemIds[0] + ' got an item added to it');
            confirmedStoredAssetIDs.add(String(itemID));
            finish([1, itemIds[0]]);
        }
      };
      const timeout = setTimeout(
        () => finish([0, 'Steam did not confirm the item insertion in time.']),
        8000,
      );
      csgo.on('itemCustomizationNotification', onNotification);
      csgo.addToCasket(casketID, itemID);
    } else {
      csgo.addToCasket(casketID, itemID);
    }
  });

  // Get storage unit contents
  ipcMain.on('getCasketContents', async (event, casketID, _casketName) => {
    await csgo.getCasketContents(casketID, async function (err, items) {
      fetchItemClass.convertStorageData(items).then((returnValue) => {
        tradeUpClass.getTradeUp(returnValue).then((newReturnValue: any) => {
          event.reply('getCasketContent-reply', [1, newReturnValue]);
          console.log('Casket contains: ', newReturnValue.length);
        });
      });

      if (err) {
        event.reply('getCasketContent-reply', [0]);
      }
    });
  });
  // Get commands from Renderer
  ipcMain.on('signOut', async () => {
    clearForNewSession();
  });

  async function clearForNewSession() {
    console.log('Signout');
    // Remove for CSGO
    removeInventoryListeners();
    csgo.removeAllListeners('connectedToGC');
    csgo.removeAllListeners('disconnectedFromGC');

    user.logOff();
    pricingEmitter.removeAllListeners('result');
    // Remove for user
    user.removeAllListeners('error');
    user.removeAllListeners('disconnected');
    user.removeAllListeners('loggedOn');
    user.removeAllListeners('webSession');
    activeTradeManager = null;
    tradeManagerError = 'Steam trade session is not ready yet.';

    // IPC
    ipcMain.removeAllListeners('renameStorageUnit');
    ipcMain.removeAllListeners('removeFromStorageUnit');
    ipcMain.removeAllListeners('moveToStorageUnit');
    ipcMain.removeAllListeners('getCasketContents');
    ipcMain.removeAllListeners('signOut');
    ipcMain.removeAllListeners('forceLogin');
  }
}

// Get currency
ipcMain.on('getCurrency', async (event) => {
  getValue('pricing.currency').then((returnValue: string) => {
    currencyClass.getRate(returnValue).then((response) => {
      let returnObject: CurrencyReturnValue = {
        currency: returnValue,
        rate: response as number,
      };
      event.reply('getCurrency-reply', returnObject);
    });
  });
});

// Set initial settings
async function settingsSetup() {
  getValue('devmode').then((returnValue) => {
    if (returnValue == undefined) {
      setValue('devmode', false);
    }
  });
  getValue('fastmove').then((returnValue) => {
    if (returnValue == undefined) {
      console.log('fastmove', returnValue);
      setValue('fastmove', false);
    }
  });
}
settingsSetup();

// Set platform
setValue('os', process.platform);

// Kinda store
ipcMain.on('electron-store-getAccountDetails', async (event) => {
  const accountDetails = await getValue('account');
  event.returnValue = event.reply(
    'electron-store-getAccountDetails-reply',
    accountDetails,
  );
});

ipcMain.handle('refresh-saved-profile-details', async () => {
  return refreshSavedProfileDetails();
});

ipcMain.on('electron-store-deleteAccountDetails', async (_event, username) => {
  deleteUserData(username);
});

ipcMain.on(
  'electron-store-setAccountPosition',
  async (_event, username, position) => {
    setAccountPosition(username, position);
  },
);

ipcMain.handle('saved-account-trade', async (_event, payload) => {
  const username = String(payload?.username || '');
  const itemIDs = Array.from(new Set((payload?.itemIDs || [])
    .map((itemID) => String(itemID))
    .filter((itemID) => /^\d+$/.test(itemID)))) as string[];

  if (!username || itemIDs.length === 0) {
    throw new Error('Choose a saved profile and at least one transferable item.');
  }
  if (itemIDs.length > MAX_CS2_TRADE_OFFER_ITEMS) {
    throw new Error(`Steam allows at most ${MAX_CS2_TRADE_OFFER_ITEMS} CS2 items in one trade offer.`);
  }

  const accounts = await getValue('account') as any;
  let receiver = accounts?.[username];
  if (!receiver?.tradeURL) {
    throw new Error('Add the Steam trade link for this saved profile first.');
  }
  if (!activeTradeManager || tradeManagerError) {
    throw new Error(tradeManagerError || 'Steam trade session is not ready yet.');
  }

  // Refresh immediately before sending. A recipient may have received trades
  // after it was last opened in Casemove, so cached/public counts are never
  // used to decide whether there is enough room.
  const recipientCapacity = await refreshSavedAccountCapacity(username);
  const refreshedAccounts = await getValue('account') as any;
  receiver = refreshedAccounts?.[username];
  if (!receiver?.steamID) {
    throw new Error('Steam ID could not be read from this saved session. Sign in to it once and try again.');
  }
  if (itemIDs.length > recipientCapacity.freeSlots) {
    throw new Error(
      `Not enough room on ${receiver.displayName || username}: ${recipientCapacity.freeSlots} free slot(s), ${itemIDs.length} selected.`,
    );
  }

  let tradeURL: URL;
  try {
    tradeURL = new URL(receiver.tradeURL);
  } catch (_error) {
    throw new Error('The saved Steam trade link is invalid.');
  }
  if (
    tradeURL.hostname !== 'steamcommunity.com' ||
    !tradeURL.pathname.startsWith('/tradeoffer/new') ||
    !tradeURL.searchParams.get('partner')
  ) {
    throw new Error('The saved link must be a Steam trade offer link.');
  }
  try {
    const savedAccountID = String(new SteamID(receiver.steamID).accountid);
    if (tradeURL.searchParams.get('partner') !== savedAccountID) {
      throw new Error('The saved trade link belongs to a different Steam profile.');
    }
  } catch (error) {
    if (error.message === 'The saved trade link belongs to a different Steam profile.') {
      throw error;
    }
    throw new Error('The saved profile Steam ID could not be verified.');
  }

  const offer = activeTradeManager.createOffer(receiver.tradeURL);
  offer.addMyItems(itemIDs.map((assetid) => ({
    appid: 730,
    contextid: '2',
    assetid,
  })));

  const status = await new Promise((resolve, reject) => {
    offer.send((error, tradeStatus) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(tradeStatus);
    });
  });

  return { status, offerID: offer.id };
});

ipcMain.handle('saved-account-capacity', async (_event, username) => {
  return refreshSavedAccountCapacity(String(username));
});

ipcMain.handle('saved-account-trade-url', async (_event, username, tradeURL) => {
  const normalizedURL = String(tradeURL || '').trim();
  let parsedURL: URL;
  try {
    parsedURL = new URL(normalizedURL);
  } catch (_error) {
    throw new Error('Enter a valid Steam trade link.');
  }
  if (
    parsedURL.hostname !== 'steamcommunity.com' ||
    !parsedURL.pathname.startsWith('/tradeoffer/new') ||
    !parsedURL.searchParams.get('partner')
  ) {
    throw new Error('The link must look like steamcommunity.com/tradeoffer/new/?partner=…');
  }

  await setAccountTradeURL(String(username), normalizedURL);
  return true;
});

// Store IPC
ipcMain.on('electron-store-get', async (event, val, key) => {
  if (val == 'locale') {
    event.reply('electron-store-get-reply' + key, currentLocale);
    return;
  }
  getValue(val).then((returnValue) => {
    event.reply('electron-store-get-reply' + key, returnValue);
  });
});
ipcMain.on('electron-store-set', async (event, key, val) => {
  event;
  setValue(key, val);
});

function UpsertKeyValue(obj, keyToChange, value) {
  const keyToChangeLower = keyToChange.toLowerCase();
  for (const key of Object.keys(obj)) {
    if (key.toLowerCase() === keyToChangeLower) {
      // Reassign old key
      obj[key] = value;
      // Done
      return;
    }
  }
  // Insert at end instead
  obj[keyToChange] = value;
}
