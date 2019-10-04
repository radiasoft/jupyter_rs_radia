var plugin = require('./index');
var base = require('@jupyter-widgets/base');

module.exports = {
  id: 'jupyter-rs-vtk-widget',
  requires: [base.IJupyterWidgetRegistry],
  activate: function(app, widgets) {
      widgets.registerWidget({
          name: 'jupyter-rs-vtk-widget',
          version: plugin.version,
          exports: plugin
      });
  },
  autoStart: true
};

