let _ = require('lodash');
let $ = require('jquery');
let widgets = require('@jupyter-widgets/base');
let controls = require('@jupyter-widgets/controls');

let rsdbg = console.log.bind(console);
let rslog = console.log.bind(console);

var RadiaViewerModel = controls.VBoxModel.extend({

    defaults: _.extend(controls.VBoxModel.prototype.defaults(), {
        _model_name: 'RadiaViewerModel',
        _view_name: 'RadiaViewerView',
        _model_module: 'jupyter-rs-vtk-widget',
        _view_module: 'jupyter-rs-vtk-widget',
        _model_module_version: '0.0.1',
        _view_module_version: '0.0.1',
    }),
}, {});

var RadiaViewerView = controls.VBoxView.extend({

    handleCustomMessages: function(msg) {
        if (msg.type === 'debug') {
            rsdbg(msg.msg);
        }
    },

    render: function() {
        // this is effectively "super.render()"
        controls.VBoxView.prototype.render.apply((this));
        this.listenTo(this.model, "msg:custom", this.handleCustomMessages);
    }
});

module.exports = {
    RadiaViewerModel: RadiaViewerModel,
    RadiaViewerView: RadiaViewerView
};
