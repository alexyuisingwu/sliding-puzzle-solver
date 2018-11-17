var path = require('path');
var webpack = require('webpack');

module.exports = {
    entry: './src/script.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        publicPath: './dist/',
        filename: '[name].bundle.js'
    },
    module: {
        rules: [
            {
                test: /\.worker\.js$/,
                include: [
                    path.resolve(__dirname, "src"),
                ],
                loader: 'worker-loader',
                options: {name: '[name].js'}
            },
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