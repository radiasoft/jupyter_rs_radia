// Export widget models and views, and the npm package version number.
module.exports = Object.assign(
    require('./radia_viewer.js'),
);
module.exports['version'] = require('../package.json').version;
