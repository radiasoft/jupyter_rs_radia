const path = require('path');
const version = require('./package.json').version;

// Custom webpack rules are generally the same for all webpack bundles, hence
// stored in a separate local variable.
const rules = [
    { test: /\.css$/, use: ['style-loader', 'css-loader']}
]


module.exports = (env, argv) => {
    const devtool = argv.mode === 'development' ? 'source-map' : false;
    return [
        {// Embeddable jupyter_rs_radia bundle
        //
        // This bundle is identical to the notebook bundle containing the custom
        // widget views and models. The only difference is it is placed in the
        // dist/ directory and shipped with the npm package for use from a CDN
        // like jsdelivr.
        //
        // The target bundle is always `dist/index.js`, which is the path
        // required by the custom widget embedder.
            entry: ['./amd-public-path.js', './lib/index.js'],
            output: {
                filename: 'index.js',
                path: path.resolve(__dirname, 'dist'),
                libraryTarget: 'amd',
                publicPath: '', // Set in amd-public-path.js
            },
            devtool,
            module: {
                rules: rules
            },
            // 'module' is the magic requirejs dependency used to set the publicPath
            externals: ['@jupyter-widgets/base', 'module']
        }
    ];
}
