var plugin = require('./index');
var base = require('@jupyter-widgets/base');

module.exports = {
  id: 'jupyter_rs_radia',
  requires: [base.IJupyterWidgetRegistry],
  activate: function(app, widgets) {
      widgets.registerWidget({
          name: 'jupyter_rs_radia',
          version: plugin.version,
          exports: plugin
      });
  },
  autoStart: true
};
