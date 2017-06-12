'use strict';

const webpack = require("webpack");
const path = require("path");
const PROD = (process.env.NODE_ENV === 'production');

let plugins = PROD ? [new webpack.optimize.UglifyJsPlugin({sourceMap: true})] : [];

module.exports = {
  context: __dirname + "/src",
  entry: {
    "playkit-js-ima": "ima.js"
  },
  output: {
    path: path.join(__dirname, "dist"),
    filename: '[name].js'
  },
  devtool: 'source-map',
  plugins: plugins,
  module: {
    rules: [{
      test: /\.js$/,
      use: [{
        loader: "babel-loader"
      }],
      exclude: [
        /node_modules/
      ]
    }, {
      test: /\.js$/,
      exclude: [
        /node_modules/,
        /Applications\/XAMPP\/xamppfiles\/htdocs\/repo\/playkit-js/,
      ],
      enforce: 'pre',
      use: [{
        loader: 'eslint-loader',
        options: {
          rules: {
            semi: 0
          }
        }
      }],
    }]
  },
  devServer: {
    contentBase: __dirname + "/src"
  },
  resolve: {
    modules: [
      path.resolve(__dirname, "src"),
      "node_modules"
    ]
  }
};
