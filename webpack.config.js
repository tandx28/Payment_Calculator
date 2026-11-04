const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin'); // Import the plugin
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { PNG } = require('pngjs');

// Opaque lime S icons, with the mark inside the maskable safe area.
function appIcon(size) {
  const png = new PNG({ width: size, height: size });
  const points = [];
  const curves = [
    [[.64, .35], [.35, .23], [.29, .46], [.49, .49]],
    [[.49, .49], [.73, .53], [.64, .77], [.35, .65]],
  ];
  for (const [a, b, c, d] of curves) {
    for (let i = 0; i <= 160; i += 1) {
      const t = i / 160, u = 1 - t;
      points.push([u ** 3 * a[0] + 3 * u ** 2 * t * b[0] + 3 * u * t ** 2 * c[0] + t ** 3 * d[0], u ** 3 * a[1] + 3 * u ** 2 * t * b[1] + 3 * u * t ** 2 * c[1] + t ** 3 * d[1]]);
    }
  }
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const mark = points.some(([px, py]) => (x / size - px) ** 2 + (y / size - py) ** 2 < .045 ** 2);
    const color = mark ? [7, 20, 17] : [201, 247, 103];
    png.data.set([...color, 255], (y * size + x) * 4);
  }
  return PNG.sync.write(png);
}

const appAssets = {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('SettleAppAssets', (compilation) => {
      compilation.hooks.processAssets.tap({ name: 'SettleAppAssets', stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL }, () => {
        const emit = (name, content) => compilation.emitAsset(name, new compiler.webpack.sources.RawSource(content));
        for (const size of [180, 192, 512]) emit(`icons/settle-${size}.png`, appIcon(size));
        emit('manifest.webmanifest', JSON.stringify({
          id: '/', name: 'Settle Lah SG', short_name: 'Settle', lang: 'en-SG',
          description: 'Host a table, invite your kakis, and settle up together. No account needed.',
          start_url: '/sessions', scope: '/', display: 'standalone',
          theme_color: '#071411', background_color: '#071411', prefer_related_applications: false,
          icons: [
            { src: '/icons/settle-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icons/settle-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
        }, null, 2));
      });
    });
  },
};

module.exports = {
  entry: './src/index.js', // Entry point for your JavaScript
  output: {
    filename: 'bundle.js', // Output bundled file name
    path: path.resolve(__dirname, 'docs'), // Output directory
    clean: true, // Clean the docs folder before each build
    publicPath: '/',
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
      { test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'] },
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
    appAssets,
    new MiniCssExtractPlugin({ filename: 'bundle.css' }),
    new HtmlWebpackPlugin({
      template: './src/index.html', // Specify the HTML template
    }),
  ],
  optimization: {
    minimize: true,
  },
};
