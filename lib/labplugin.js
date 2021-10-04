var plugin = require('./index');
var base = require('@jupyter-widgets/base');

module.exports = {
  id: 'jupyter-rs-radia',
  requires: [base.IJupyterWidgetRegistry],
  activate: function(app, widgets) {
      widgets.registerWidget({
          name: 'jupyter-rs-radia',
          version: plugin.version,
          exports: plugin
      });
  },
  autoStart: true
};

