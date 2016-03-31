var path = require('path');

function getExternals(names) {
    var externals = {};

    names.forEach((name) => {
        externals[name] = `require("${name}")`;
    });

    return externals;
}

module.exports = {
    entry: {
        server: './server/index.js',
    },
    output: {
        path: path.resolve('./dist/'),
        filename: '[name].bundle.js'
    },
    watch: true,
    module: {
        loaders: [{
            test: /\.js$/,
            exclude: /(node_modules|bower_components)/,
            loader: 'babel',
            query: {
                presets: ["node5"]
            }
        }, {
            test: /\.json$/,
            loader: 'json'
        }]
    },
    externals: getExternals([
        'koa',
        'koa-router',
        'koa-handlebars',
        'koa-static',
        'koa-logger',
        'koa-send',
        'hashids',
        'locallydb',
        'fs',
        'os',
        'lru-cache',
        'koa-webpack-dev-middleware',
        'co-busboy'
    ])
};
