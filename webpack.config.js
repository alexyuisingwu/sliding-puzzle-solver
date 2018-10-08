var path = require('path');
var webpack = require('webpack');
// TODO: try changing polyfill to regenerator-runtime/runtime to avoid costly polyfill import
module.exports = {
    entry: './src/script.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'main.bundle.js'
    },
    module: {
        rules: [
            {

                test: /\.m?js$/,
                loader: 'babel-loader',
                include: [
                    path.resolve(__dirname, "src"),
                ],
                options: {
                    presets: ["@babel/preset-env"]
                }
            },
            {
                test: /\.css$/,
                use: [
                    { loader: "style-loader" },
                    { loader: "css-loader" }
                ]
            }
        ]
    },
    plugins: [
        // new webpack.optimize.UglifyJsPlugin(),
        new webpack.SourceMapDevToolPlugin({
          filename: "[file].map"
        })
    ],
    stats: {
        colors: true
    },
    devtool: 'eval-source-map',
    // TODO: switch to production to use default optimizations after done
    mode: 'development'
};