import type { Configuration } from 'webpack';

import { rules } from './webpack.rules';
import { rendererPlugins } from './webpack.plugins';

export const rendererConfig: Configuration = {
  module: {
    rules,
  },
  plugins: rendererPlugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
  },
  optimization: {
    minimize: false,
  },
};
