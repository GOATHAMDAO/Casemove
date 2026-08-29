# Casemove — user guide and FAQ

Casemove helps you view your CS2 inventory and Storage Units, combine identical items, move items between inventory and storage, and work with multiple saved Steam profiles.

## Download and run without an installer

1. Download the source code through **Code → Download ZIP** on GitHub, or clone the repository with Git.
2. Extract the archive to a normal folder, for example `C:\Casemove`.
3. Install [Node.js LTS](https://nodejs.org/), version 22 or newer.
4. Double-click `Start-Casemove-Dev.bat` in the project folder.
5. Dependencies are required in the project folder for the first launch. If the launcher says they are missing, open PowerShell in that folder, run `npm ci`, and start the `.bat` file again.

You need Windows 10/11 x64, [Node.js LTS](https://nodejs.org/), an internet connection, and Steam Guard on your phone for QR sign-in. Git and VS Code are optional; a CS2 installation is not required.

## How to start the app

After preparing the project folder:

1. Double-click `Start-Casemove-Dev.bat`.
2. On the first launch, wait 30–60 seconds while Electron compiles the app and opens the sign-in window.
3. Sign in to Steam with the QR code and wait for the **Connected** status.
4. Open **Overview** after connecting. The app will load your inventory and available Storage Units.

Only use files from this repository or a trusted author. Do not run unknown `.bat` or `.vbs` files received from other sources.

## First sign-in

1. In Casemove, choose QR-code sign-in.
2. Open the Steam mobile app and scan the QR code.
3. Once signed in, you can save the session and quickly switch between your own profiles later.

Saved profiles are not shared with other users and are never uploaded to GitHub. Do not copy or share `%APPDATA%\casemove`.

## Shortcut and taskbar pinning

To start without a visible `cmd` window, use `Launch-Casemove-Dev.vbs`. Create a desktop shortcut to it, optionally set `assets\icon.ico` as its icon, then pin that shortcut to the taskbar.

Do not pin a separate icon named **Electron**. It is a technical runtime process, and that shortcut may open Electron's empty welcome window instead of Casemove.

## Application features

### Steam profiles

- Sign in with a QR code and save a session when needed.
- Add several of your own profiles and switch between them with the green check button on a saved profile.
- Transfer lists use account logins, so accounts with the same display name are not confused.

### Overview

- Automatically loads items from the regular inventory and Storage Units.
- Shows total items, items in inventory, and items in Storage Units.
- Shows item distribution by category.
- **Export CSV** downloads a simple CSV containing item names and total quantities.

### Inventory

- Shows items from inventory and every loaded Storage Unit in one list.
- Identical items are merged, including items from several Storage Units; `QTY` shows their total.
- Trade-locked items are displayed separately from available items. Identical locked items are merged with each other, while **Tradehold** shows their unlock-date range.
- Includes search, filters, sorting, Storage Unit, trade-hold, quantity, and moveability information.
- The `↻` button refreshes data from Steam.

### Transfer | From

- Select one or several Storage Units.
- Find an item, set the quantity, and move it from storage to the regular inventory.
- If the same item exists in several selected units, the app shows one total row and distributes the move between those units.

### Transfer | To

- Select a Storage Unit.
- Select items from the regular inventory, set their quantity, and insert them into storage.
- Steam data refreshes automatically after confirmation; use `↻` if a manual refresh is needed.

### Transfer | Saved account

- Select a saved recipient account and save its Steam trade link.
- Press **Refresh profiles** to check the recipient's current free inventory capacity.
- The list only contains items that can be sent now. Storage Unit items, trade-locked items, and non-transferable items are hidden.
- Select the amount of every item, create the trade offer, and confirm it in Steam Guard if Steam requests confirmation.

### Appearance

- The switch at the bottom of the sidebar changes between light and dark themes.
- The preference is saved locally for the current Windows user.

## FAQ

### Do I need Node.js, Git, or VS Code?

Node.js is required because the app runs from source code without an installer. Git is only needed to clone the repository; downloading a ZIP is an alternative. VS Code is not required.

### Where are my saved Steam profiles stored?

They are stored locally in your Windows user profile, in application data. They are not kept in the GitHub repository and are not included when another user installs the app.

### Why are trade-locked items visible in Inventory?

They still belong to the account and occupy inventory space, but cannot be traded until the lock expires. The **Tradehold** column shows the remaining time. They are not mixed with available items: identical locked items are merged only with each other, with a total `QTY` and unlock-date range.

### Why is an item visible in Inventory but missing from Transfer | Saved account?

That menu only shows items that can be sent now. Storage Units, trade-locked items, and non-transferable items are intentionally hidden.

### Why are several Storage Units shown in Inventory?

Casemove loads items from all available Storage Units. When the same item is in several units, its quantities are added together and the **Storage** column lists the sources.

### How do I refresh items after moving them?

Click the `↻` refresh button in the relevant section or open Overview again. Steam may take a short time to update data after an operation.

### Why does Steam Guard ask me to confirm an action?

Steam requires confirmation for certain trade-related actions. Open Steam on your phone and confirm the operation normally.

### Can I give Casemove to a friend?

Yes. Send a repository link or ZIP without `.env` files, certificates, logs, or `%APPDATA%\casemove`. Your friend needs Node.js, then runs `npm ci` followed by `Start-Casemove-Dev.bat`.
