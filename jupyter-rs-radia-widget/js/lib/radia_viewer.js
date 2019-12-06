let _ = require('lodash');
let $ = require('jquery');
let controls = require('@jupyter-widgets/controls');
let guiUtils = require('./gui_utils');
let rsUtils = require('./rs_utils');
//let rsjpyStyle = require('../css/rsjpy.css');
let widgets = require('@jupyter-widgets/base');

const template = [
    '<div class="radia-viewer">',
        '<div class="radia-viewer-title" style="font-weight: normal; text-align: center"></div>',
        '<div class="vector-field-color-map-content" style="display: none; padding-left: 4px; padding-right: 4px;">',
            '<div class="vector-field-indicator">',
                '<span class="vector-field-indicator-value" style="padding-left: 4px;">0</span>',
            '</div>',
            '<div class="vector-field-color-map" style="height: 32px; overflow: hidden; border-color: black; border-width: 1px;">',
                '<span class="vector-field-indicator-pointer" style="font-size: x-large;">▼</span>',
            '</div>',
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

function getVTKView(o) {
    if ((o.model || {}).name === 'VTKModel') {
        return o;
    }
    // child views are Promises, must wait for them to resolve
    for (let vx in (o.children_views || {}).views) {
        let v = o.children_views.views[vx].then(getVTKView);
        if (v) {
            return v;
        }
    }
    return null;
}

const RadiaViewerView = controls.VBoxView.extend({

    isLoaded: false,
    vtkViewer: null,
    vtkViewerEl: null,

    getVectors: function() {
        return ((this.model.get('model_data').data || [])[0] || {}).vectors;
    },

    handleCustomMessages: function(msg) {
        if (msg.type === 'debug') {
            rsUtils.rsdbg(msg.msg);
        }

        if (msg.type === 'refresh') {
            this.refresh();
        }
    },

    // have to return a function constructed with this viewer, otherwise "this" will refer to
    // the child viewer
    processPickedValue: function(viewer) {
        return function (val) {
            let v = viewer.getVectors();
            //rsUtils.rsdbg('radia processPickedValue', v);
            viewer.setFieldIndicator(val, v.range[0], v.range[1], (v.units || ''));
        };
    },

    refresh: function() {
        rsUtils.rsdbg('radia refresh');
        this.select('.vector-field-color-map-content').css(
            'display', 'none');
        let vectors = this.getVectors();
        if (! vectors) {
            return;
        }

        //TODO(mvk): real axis with tick marks, labels, etc.
        this.select('.vector-field-color-map-content').css(
            'display', 'block'
        );
        let fieldTicks = this.select('.vector-field-color-map-axis span');
        let numTicks = fieldTicks.length;
        if (numTicks >= 2) {
            let minV = vectors.range[0];
            let maxV = vectors.range[1];
            fieldTicks[0].textContent = ('' + rsUtils.roundToPlaces(minV, 2));
            fieldTicks[numTicks - 1].textContent = ('' + rsUtils.roundToPlaces(maxV, 2));
            let dv = (maxV - minV) / (numTicks - 1);
            for (let i = 1; i < numTicks - 1; ++i) {
                fieldTicks[i].textContent = ('' + rsUtils.roundToPlaces(i * dv, 2));
            }
        }

        this.setFieldScaling();
        this.setFieldIndicator(vectors.range[0], vectors.range[0], vectors.range[1], vectors.units);
    },

    render: function() {
        rsUtils.rsdbg('radia render');
        // this is effectively "super.render()"
        controls.VBoxView.prototype.render.apply((this));

        const view = this;

        getVTKView(this).then(function (o) {
            view.vtkViewer = o;
            view.vtkViewerEl = $(view.vtkViewer.el).find('.vtk-widget');
            view.vtkViewerEl.append($(template));

            view.vtkViewer.processPickedValue = view.processPickedValue(view);
        });

        // store current settings in cookies?
        //let c = document.cookie;
        //rsUtils.rsdbg('cookies', c);

        //this.model.on('change:model_data', this.refresh, this);
        this.model.on('change:field_color_map_name', this.setFieldColorMap, this);
        this.model.on('change:title', this.setTitle, this);
        this.model.on('change:vector_scaling', this.setFieldScaling, this);

        this.listenTo(this.model, "msg:custom", this.handleCustomMessages);

        // set dropdown contents and initial values
        // change to "schema?"
        this.model.set('client_props', {
            field_color_maps: guiUtils.getColorMaps(),
            field_color_map_name: 'viridis',
            vector_scaling_types: ['Uniform', 'Linear', 'Log'],
            vector_scaling: 'Uniform',
        });

        // required to get the python model in sync right away
        this.touch();
    },


    select: function(selector) {
        return $(this.el).find(selector);
    },

    setFieldColorMap: function() {
        let mapName = this.model.get('field_color_map_name');
        if (! mapName) {
            rsUtils.rslog('setFieldColorMap: No color map');
            return;
        }
        this.setFieldColorMapScale();
    },

    setFieldColorMapScale: function() {
        const mapName = this.model.get('field_color_map_name');
        if (! mapName) {
            rsUtils.rslog('setFieldColorMapScale: No color map');
            return;
        }
        const g = guiUtils.getColorMap(mapName, null, '#');
        this.select('.vector-field-color-map')
            .css('background', 'linear-gradient(to right, ' + g.join(',') + ')');
    },

    setFieldScaling: function() {
        this.vtkViewer.setVectorScaling(this.model.get('vector_scaling'));
    },

    setFieldIndicator: function(val, min, max, units) {
        const w = this.select('.vector-field-color-map').width();
        const iw = this.select('.vector-field-indicator-pointer').width();
        const f = Math.abs(val - min) / ((max - min) || 1);
        const l = w * f - 0.5 * iw;
        const g = guiUtils.getColorMap(this.model.get('field_color_map_name'), null, '');
        const i = Math.floor(f * (g.length - 1));
        rsUtils.rsdbg('val', val, 'min/max', min, max, 'frac', f, 'el width', w, 'i w', iw, 'left', l, 'i', i, 'c', g[i]);
        this.select('.vector-field-indicator-pointer')
            .css('margin-left', (l + 'px'))
            .css('color', guiUtils.fgColorForBG(g[i || 0], '#'));
        this.select('.vector-field-indicator-value')
            .text(rsUtils.roundToPlaces(val, 4) + ' ' + units);
    },

    setTitle: function() {
        this.select('.radia-viewer-title').text(this.model.get('title'));
    },

});

module.exports = {
    RadiaViewerModel: RadiaViewerModel,
    RadiaViewerView: RadiaViewerView
};

