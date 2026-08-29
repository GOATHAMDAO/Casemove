import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { existsSync } from 'node:fs';

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    // Electron Packager expects the path without an extension here. It uses
    // assets/icon.ico for the Windows application executable.
    icon: './assets/icon',
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      // Produces the installable Windows .exe in out/make/squirrel.windows.
      name: 'casemove',
      setupExe: 'Casemove-Setup.exe',
      setupIcon: './assets/icon.ico',
      noMsi: true,
      // A local build must work even when a signing certificate is not present.
      // If cert.pfx is later added, set CERTIFICATE_PASSWORD before packaging
      // and the generated installer will be signed automatically.
      ...(existsSync('./cert.pfx') && process.env.CERTIFICATE_PASSWORD
        ? {
            certificateFile: './cert.pfx',
            certificatePassword: process.env.CERTIFICATE_PASSWORD,
          }
        : {}),
    }),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new WebpackPlugin({
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/renderer/index.html',
            js: './src/renderer/index.tsx',
            name: 'main_window',
            preload: {
              js: './src/main/preload.ts',
            },
          },
        ],
      },
    }),
  ],
};

export default config;
