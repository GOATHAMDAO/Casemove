import type { Configuration } from 'webpack';

import { rules } from './webpack.rules';
import { mainPlugins } from './webpack.plugins';

import path from 'path';

export const mainConfig: Configuration = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: './src/main/main.ts',
  module: {
    rules,
  },

  externals: {
    // This native-compatible module is loaded from the packaged dependency
    // directory. LZMA is intentionally *not* external: it is plain
    // JavaScript and must be included in the webpack bundle, otherwise a
    // Squirrel-installed EXE fails before the first window is created.
    'steam-crypto': 'commonjs steamcrypto',
  },

  plugins: mainPlugins,
  resolve: {
    alias: {
      // See src/main/shims/lzma.js. This keeps the worker inside app.asar.
      'lzma$': path.resolve(__dirname, 'src/main/shims/lzma.js'),
    },
    modules: [
      path.resolve(__dirname, 'src'),
      'node_modules'
    ],
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
  },
  // Minifying large generated Steam protocol files uses multiple gigabytes of
  // memory and gives no practical benefit for a local desktop application.
  optimization: {
    minimize: false,
  },
  // Full source maps for the bundled Steam protocol libraries consume several
  // gigabytes during a production Windows build. Keep them for development,
  // but omit them from the distributable installer.
  devtool: process.env.NODE_ENV === 'development' ? 'source-map' : false,
};
