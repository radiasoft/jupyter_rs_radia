// Export widget models and views, and the npm package version number.
//module.exports = require('./radia_viewer.js');
//module.exports = require('./vtk_viewer.js');
module.exports = Object.assign(
    require('./radia_viewer.js'),
    require('./vtk_viewer.js')
);
module.exports['version'] = require('../package.json').version;
