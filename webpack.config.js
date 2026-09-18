const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin'); // Import the plugin

module.exports = {
  entry: './src/index.js', // Entry point for your JavaScript
  output: {
    filename: 'bundle.js', // Output bundled file name
    path: path.resolve(__dirname, 'docs'), // Output directory
    clean: true, // Clean the docs folder before each build
    publicPath: '',
  },
  devServer: {
    static: {
      directory: path.resolve(__dirname, 'docs'), // Serve files from the docs directory
    },
    port: 9000, // Dev server port
    open: false,
    hot: true, // Enable Hot Module Replacement
    historyApiFallback: true,
  },
  module: {
    rules: [
      {
        test: /\.js$/, // Process JS files
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html', // Specify the HTML template
    }),
  ],
  optimization: {
    minimize: true,
  },
};
