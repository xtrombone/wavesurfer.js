/* eslint-env node */

const path = require('path');
const banner = require('./banner');

const rootDir = path.resolve(__dirname, '..', '..');

module.exports = {
    entry: {
        multicanvas: path.join(rootDir, 'src', 'drawer.multicanvas.js')
    },
    output: {
        path: path.join(rootDir, 'dist'),
        filename: '[name].js',
        library: 'MultiCanvas'
    },
    plugins: [banner.libBanner]
};
