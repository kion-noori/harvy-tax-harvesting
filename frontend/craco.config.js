const webpack = require('webpack');

module.exports = {
  devServer: {
    port: 3000,
  },
  webpack: {
    configure: (webpackConfig) => {
      // Add fallbacks for node modules (only what's actually needed)
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        "process": require.resolve("process/browser.js"),
        "buffer": require.resolve("buffer/"),
        "util": require.resolve("util/"),
        "url": require.resolve("url/"),
      };

      // Add plugins
      webpackConfig.plugins = [
        ...(webpackConfig.plugins || []),
        new webpack.ProvidePlugin({
          process: 'process/browser.js',
          Buffer: ['buffer', 'Buffer'],
        }),
      ];

      return webpackConfig;
    },
  },
};
