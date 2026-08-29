const CopyWebpackPlugin = require('copy-webpack-plugin');

// TypeScript is checked explicitly before packaging. Running a second full
// type-checker in both Webpack compilers exceeds the memory budget on Windows.
export const mainPlugins = [
  new CopyWebpackPlugin({
    patterns: [
      {
        from: 'node_modules/@doctormckay/steam-crypto/system.pem',
        to: 'system.pem',
      },
    ],
  }),
];

export const rendererPlugins = [];
