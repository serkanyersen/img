var path = require('path');

module.exports = {
    entry: {
        client: './client/index.js'
    },
    output: {
        path: path.resolve('./public/js/'),
        filename: '[name].bundle.js'
    },
    watch: true,
    module: {
        loaders: [{
            test: /\.js$/,
            exclude: /(node_modules|bower_components)/,
            loader: 'babel',
            query: {
                presets: ['es2015']
            }
        }, {
            test: /\.json$/,
            loader: 'json'
        }]
    }
};
