# Casemove — simple installation and launch guide

Casemove is a desktop app for working with Counter-Strike 2 inventory and Storage Units. It can view items, move items between inventory and storage, use multiple Steam profiles, and create Excel reports.

This guide is written for Windows users with no programming experience. You do not need to install CS2, Git, or VS Code.

## What you need

- a computer running **Windows 10 or Windows 11, 64-bit**;
- a stable internet connection;
- access to your Steam account;
- the Steam mobile app to approve QR-code sign-in;
- 3–5 GB of free disk space.

> Never share `%APPDATA%\casemove`, Steam QR codes, refresh tokens, or API keys. They are private account data.

---

## How to run the app now

There is currently no ready-made `.exe` installer. Download the source ZIP and start the app by following the steps below.

### Step 1. Download the project

1. Open the repository page on GitHub.
2. Click the green **Code** button.
3. Click **Download ZIP**.
4. Wait for the download. The file is normally saved to your Downloads folder.
5. Right-click the ZIP file and choose **Extract All…**.
6. Extract it to a simple folder, for example `C:\Casemove`.

Do not run the app from inside the ZIP archive. Always extract all files first.

### Step 2. Install Node.js

Node.js is required only for the source-code version.

1. Open [nodejs.org](https://nodejs.org/).
2. Download the **LTS** version for Windows. This project supports Node.js **22 LTS or newer**.
3. Run the downloaded installer.
4. Click **Next** and keep the default options.
5. Click **Finish**.
6. Close and reopen any PowerShell or Command Prompt windows that were already open.

You do not need Git, Python, Visual Studio Code, or a CS2 installation.

### Step 3. Install the files required by the app

1. Open the extracted Casemove folder.
2. Right-click an empty area inside the folder.
3. Select **Open in Terminal** or **Open PowerShell window here**.
4. Paste this command:

```powershell
npm ci
```

5. Press Enter and wait for it to finish. The first run can take several minutes.
6. When the command prompt returns, close the terminal.

If `npm ci` shows an error, use this command instead:

```powershell
npm install
```

Do not close the terminal while the command is running. Package names and download progress are normal.

### Step 4. Start Casemove

1. In the Casemove folder, double-click `Start-Casemove-Dev.bat`.
2. On the first launch, wait 1–3 minutes while the app builds its files.
3. The Casemove sign-in window should open.

To start without a visible command window, use `Launch-Casemove-Dev.vbs`. It starts the same app in the background.

---

## First Steam sign-in

1. Open Casemove.
2. Choose QR-code sign-in.
3. Open the Steam mobile app.
4. Scan the QR code and approve the sign-in on your phone.
5. Wait until the CS2 connection status is **Connected**.

Casemove connects to the CS2 servers to work with Storage Units. This can take some time, especially after the first sign-in.

Saving a session lets you switch between your own profiles later without repeating the QR sign-in. The session is stored only on your computer in encrypted local storage.

---

## Main parts of the app

### Inventory

- Shows items from the current account and its Storage Units.
- The `↻` button refreshes Steam inventory data.
- When you open Inventory, the app loads every Storage Unit. Do not close it while it shows `Loading storages…`.
- **Export all to Excel** creates one Excel report for all saved Steam profiles.

The Excel report includes:

- total item quantity (`Total`);
- quantity across PriceEmpire portfolios when an API key is configured;
- `Add / Remove`: a positive number means add that amount to PriceEmpire, and a negative number means remove it;
- the separate quantity in Storage Units;
- the active main Steam profile, followed by other saved profiles.

The finished Excel file opens in the Windows **Downloads** folder.

### Storage Units

- **Transfer | From** moves items from a Storage Unit into the normal inventory.
- **Transfer | To** moves normal inventory items into a selected Storage Unit.
- **Transfer | Saved account** creates a trade offer for another saved account.

Trade-locked, non-tradable, and Storage Unit items are not shown as available for a trade offer. This is a Steam limitation.

### Multiple Steam profiles

1. Open the saved-profiles list.
2. Sign in to every account you want to include with QR sign-in, and save each session.
3. The all-profiles Excel export can then include all of those accounts.

Do not remove a saved profile if you want it included in the combined export.

### PriceEmpire

PriceEmpire is optional. It is used only to compare the Excel report with your PriceEmpire portfolios.

1. Open **Settings** → **Market API keys**.
2. Paste a new API key into `PriceEmpire API key`.
3. Click **Save**.
4. Add a portfolio name to `Ignore PriceEmpire portfolios` when its items should not be counted in the report.
5. Create an export from Inventory.

The key is not displayed after saving and is not written into Excel, GitHub, or source files. If you have sent a key to anyone, revoke it in PriceEmpire and create a new one.

---

## Common problems

### “Node.js is not installed” or `npm` is not found

1. Install Node.js LTS from [nodejs.org](https://nodejs.org/).
2. Close every terminal window.
3. Restart the computer if the problem remains.
4. Open the Casemove folder and run `Start-Casemove-Dev.bat` again.

### “Dependencies are missing”

Open a terminal in the Casemove folder and run:

```powershell
npm ci
```

After it finishes, run `Start-Casemove-Dev.bat` again.

### The app does not open or closes immediately

- Make sure the project was extracted from the ZIP archive.
- Check that the folder contains `package.json` and `Start-Casemove-Dev.bat`.
- Run `Start-Casemove-Dev.bat`, not Electron itself.
- Check whether antivirus software blocked a file. Only allow files from a repository you trust.
- To see a startup error, open a terminal in the folder and run `npm run start`.

### `Loading storages…` takes a long time

Casemove reads the contents of every Storage Unit from CS2 one at a time. Units with many items and a slow or unstable connection increase the wait.

- Keep the app open while the loading continues.
- Check your internet connection.
- Wait a few minutes, then press `↻` if loading ends with an error.
- Do not run multiple Casemove copies for the same account at once.

### Export all to Excel does not create a file

- Check the Windows **Downloads** folder.
- Make sure at least one Steam profile is saved in Casemove.
- Wait until the current profile connects to CS2.
- If PriceEmpire is not configured, the Steam part of the report should still be created; PriceEmpire columns will remain blank.

### PriceEmpire columns are blank

- Open **Settings** → **Market API keys**.
- Check that an API key is saved.
- Make sure the key has Portfolio API access.
- Check that the desired portfolio is not listed as ignored.

### Steam asks you to sign in again

The saved Steam session may have expired or been revoked by Steam. Sign in to that profile with the QR code again and save the renewed session.

---

## Security and private data

- Casemove does not require your Steam password in this guide, an Excel file, or GitHub.
- Sign-in is approved in the official Steam mobile app.
- Saved Steam sessions and API keys stay on your computer.
- Do not publish `%APPDATA%\casemove`, `.env` files, certificates, logs, or screenshots with keys.
- When sharing the project, send a GitHub link or a fresh GitHub ZIP instead of your own working folder.

## Updating the app

The simplest safe method is:

1. Download a fresh ZIP from GitHub.
2. Extract it to a new folder, for example `C:\Casemove-new`.
3. Run `npm ci` in the new folder.
4. Start `Start-Casemove-Dev.bat`.

Saved Steam profiles and API keys are not stored inside the project folder, so updating the source files keeps them local.

---

## For developers: create a Windows installer

Regular users do not need this section. In the project folder, run:

```powershell
npm run make:win
```

The completed installer will be created here:

```text
out\make\squirrel.windows\x64\Casemove-Setup.exe
```

For more installer details, read [BUILD-WINDOWS.md](BUILD-WINDOWS.md). For safe publishing instructions, read [PUBLISH-TO-GITHUB-RU.md](PUBLISH-TO-GITHUB-RU.md).
