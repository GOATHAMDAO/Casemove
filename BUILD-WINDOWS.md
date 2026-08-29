# Windows `.exe` build

The project is configured to create a 64-bit Windows installer using Electron Forge.

## Create the installer

From the project directory, run:

```powershell
npm run make:win
```

The installer is written to:

```text
out\make\squirrel.windows\x64\casemove-<version> Setup.exe
```

Run that file on Windows to install Casemove. It creates a Start-menu shortcut
and an uninstaller. The installer contains only the application files: it does
not include `.env`, `cert.pfx`, saved Steam sessions, trade links, or the local
image cache. Each person's saved sessions are created only after they log in,
inside their own Windows user-data folder.

## Portable test build

To only package the app without creating an installer, run:

```powershell
npm run package:win
```

Then launch `out\casemove-win32-x64\casemove.exe`.

## Signing before distributing

The installer builds without a certificate. Windows may show a SmartScreen
warning for an unsigned app. To sign a release, place `cert.pfx` in the project
root and set `CERTIFICATE_PASSWORD` before running `npm run make:win`.
