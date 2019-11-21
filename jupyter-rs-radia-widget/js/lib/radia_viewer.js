let _ = require('lodash');
let $ = require('jquery');
let controls = require('@jupyter-widgets/controls');
let guiUtils = require('./gui_utils');
let rsUtils = require('./rs_utils');
let widgets = require('@jupyter-widgets/base');

const template = [
    '<div class="radia-viewer">',
    '<div class="vector-field-color-map-content">',
        '<div class="vector-field-indicator">',
            '<span class="vector-field-indicator-pointer" style="font-size: x-large">▼</span>',
            '<span class="vector-field-indicator-value">0</span>',
        '</div>',
        '<div class="vector-field-color-map" style="height: 32px;"></div>',
        '<div class="vector-field-color-map-axis" style="height: 32px;">',
            '<div style="display: flex; flex-direction: row; flex-wrap: nowrap; justify-content: space-between;">',
                '<span>0.0</span>',
                '<span>0.2</span>',
                '<span>0.4</span>',
                '<span>0.6</span>',
                '<span>0.8</span>',
                '<span>1.0</span>',
            '</div>',
        '</div>',
    '</div>',
    '</div>',
].join('');

const RadiaViewerModel = controls.VBoxModel.extend({
    defaults: _.extend(controls.VBoxModel.prototype.defaults(), {
        _model_name: 'RadiaViewerModel',
        _view_name: 'RadiaViewerView',
        _model_module: 'jupyter-rs-radia-widget',
        _view_module: 'jupyter-rs-radia-widget',
        _model_module_version: '0.0.1',
        _view_module_version: '0.0.1',
    }),
}, {});

function rpv(o) {
    rsUtils.rsdbg('rpv', o);
    rsUtils.rsdbg('vtk widget', $(o.el).find('.vtk-widget'));
}

const RadiaViewerView = controls.VBoxView.extend({

    isLoaded: false,
    vtkViewer: null,

    handleCustomMessages: function(msg) {
        if (msg.type === 'debug') {
            rsUtils.rsdbg(msg.msg);
        }
    },

    refresh: function() {

    },

    render: function() {
        // this is effectively "super.render()"
        controls.VBoxView.prototype.render.apply((this));

        // child views are Promises, must wait for them to resolve to
        // select with jquery
        //rsUtils.rsdbg('got children', this.children_views);
        //for (let vx in this.children_views.views) {
        //    this.children_views.views[vx].then(rpv);
        //}

        //let w = $(this.el).find('.vtk-widget');
        //rsUtils.rsdbg('wdiget', w);
        $(this.el).find('.vtk-widget').append($(template));

        // store current settings in cookies?
        //let c = document.cookie;
        //rsUtils.rsdbg('cookies', c);

        this.model.on('change:model_data', this.refresh, this);
        this.model.on('change:field_color_map_name', this.setFieldColorMap, this);
        this.model.on('change:title', this.refresh, this);
        this.model.on('change:vector_scaling', this.setFieldScaling, this);

        this.listenTo(this.model, "msg:custom", this.handleCustomMessages);

        // set dropdown contents and initial values
        this.model.set('external_props', {
            field_color_maps: guiUtils.getColorMaps(),
            field_color_map_name: 'viridis',
            vector_scaling_types: ['Uniform', 'Linear', 'Log'],
            vector_scaling: 'Uniform',
        });

        // required to get the python model in sync right away
        this.touch();
    },


    setFieldColorMap: function() {
        let mapName = this.model.get('field_color_map_name');
        if (! mapName) {
            rsUtils.rslog('setFieldColorMap: No color map');
            return;
        }
        // send info to vtk - actor name, map name, formula function?
        actor.getMapper().getInputConnection(0).filter
            .setFormula(getVectFormula(this.model.get('model_data').data[0].vectors, mapName));
        this.setFieldColorMapScale();
    },

    setFieldColorMapScale: function() {
        let mapName = this.model.get('field_color_map_name');
        if (! mapName) {
            rsUtils.rslog('setFieldColorMapScale: No color map');
            return;
        }
        let g = guiUtils.getColorMap(mapName, null, '#');
        $(this.el).find('.vector-field-color-map')
            .css('background', 'linear-gradient(to right, ' + g.join(',') + ')');
    },

    setFieldScaling: function() {
        let vs = this.model.get('vector_scaling');
         // send info to vtk - actor name, scaling type, scale factor?
        //mapper.setScaleFactor(8.0);
        //if (vs === 'Uniform') {
        //    mapper.setScaleModeToScaleByConstant();
       // }
       // if (vs === 'Linear') {
       //     mapper.setScaleArray(LINEAR_SCALE_ARRAY);
        //    mapper.setScaleModeToScaleByComponents();
        //}
        //if (vs === 'Log') {
        //    mapper.setScaleArray(LOG_SCALE_ARRAY);
        //    mapper.setScaleModeToScaleByComponents();
        //}
    },


    setFieldIndicator: function(val, min, max) {
        let w = $(this.el).find('.vector-field-color-map').width();
        let f = Math.abs(val / (max - min));
        let l = w * f;
        rsUtils.rsdbg('val', val, 'min/max', min, max, 'frac', f, 'el width', w, 'left', l);
        $(this.el).find('.vector-field-indicator').css('left', '25px');
        $(this.el).find('.vector-field-indicator-value').text(val);
    },

});

module.exports = {
    RadiaViewerModel: RadiaViewerModel,
    RadiaViewerView: RadiaViewerView
};

