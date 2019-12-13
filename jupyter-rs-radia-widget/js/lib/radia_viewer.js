let _ = require('lodash');
let $ = require('jquery');
let controls = require('@jupyter-widgets/controls');
let d3 = require('d3');
let d3Scale = require('d3-scale');
let guiUtils = require('./gui_utils');
let rsUtils = require('./rs_utils');
//let rsjpyStyle = require('../css/rsjpy.css');
let widgets = require('@jupyter-widgets/base');

const template = [
    '<div class="radia-viewer">',
        '<div class="radia-viewer-title" style="font-weight: normal; text-align: center"></div>',
        '<div class="selection-info">',
          '<span class="selection-info-value" style="padding-left: 4px;"></span>',
        '</div>',
        '<div class="vector-field-color-map-content" style="display: none; padding-left: 4px; padding-right: 4px;">',
            '<div class="vector-field-color-map" style="height: 32px; overflow: hidden; box-shadow: 0 0 0 1px black inset;">',
                '<span class="vector-field-indicator-pointer" style="font-size: x-large;">▼</span>',
            '</div>',
            '<div class="vector-field-color-map-axis" style="height: 32px;">',
                '<svg width="100%" height="24px"><g class="axis" style="font-size: small;"></g></svg>',
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

    fieldColorMapAxis: null,
    fieldColorMapScale: null,

    //TODO(mvk): read schema from file
    schema: {
        field_color_maps: guiUtils.getColorMaps(),
        field_color_map_name: 'viridis',
        num_field_cmap_ticks: 6,
        vector_scaling_types: ['Uniform', 'Linear', 'Log'],
        vector_scaling: 'Uniform',
    },
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
    processSelectedObject: function(viewer) {
        return function (objectInfo) {
            viewer.setSelectionText((objectInfo || {}).group || '--');
        };
    },

    // have to return a function constructed with this viewer, otherwise "this" will refer to
    // the child viewer
    processSelectedVector: function(viewer) {
        return function (point, vect) {
            let v = viewer.getVectors();
            viewer.setFieldIndicator(point, vect, (v.units || ''));
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
        const showScale = vectors.vertices.length > 3;

        //TODO(mvk): real axis with tick marks, labels, etc.
        this.select('.vector-field-color-map-content').css(
            'display', 'block'
        );
        this.select('.vector-field-color-map').css(
            'display',  showScale? 'block' : 'none'
        );
        this.select('.vector-field-color-map-axis').css(
            'display',  showScale? 'block' : 'none'
        );

        if (this.schema.num_field_cmap_ticks >= 2) {
            this.fieldColorMapScale = d3Scale.scaleLinear()
                .domain(vectors.range).nice()
                .range([0, this.select('.vector-field-color-map-axis').width()]);
            this.fieldColorMapAxis.scale(this.fieldColorMapScale);
            this.select('.vector-field-color-map-axis > svg > g', 'd3').call(this.fieldColorMapAxis);
        }

        this.setFieldColorMap();
        this.setFieldScaling();
        this.processSelectedObject(this)();
        this.processSelectedVector(this)([], []);
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
            view.fieldColorMapAxis = d3.axisBottom(d3Scale.scaleLinear())
                .ticks(view.schema.num_field_cmap_ticks);
            view.select('.vector-field-color-map-axis .axis', 'd3')
                .call(view.fieldColorMapAxis);

            view.setTitle();
            view.vtkViewer.processPickedObject = view.processSelectedObject(view);
            view.vtkViewer.processPickedVector = view.processSelectedVector(view);
        });

        this.model.on('change:field_color_map_name', this.setFieldColorMap, this);
        this.model.on('change:title', this.setTitle, this);
        this.model.on('change:vector_scaling', this.setFieldScaling, this);

        this.listenTo(this.model, "msg:custom", this.handleCustomMessages);

        // set dropdown contents and initial values
        // change to "schema?"  Place in actual schema file?
        this.model.set('client_props', this.schema);

        // required to get the python model in sync right away
        this.touch();
    },


    select: function(selector, module) {
        if (! module || module === '$') {
            return $(this.el).find(selector);
        }
        if (module === 'd3') {
            return d3.select(selector);
        }
        return null;
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

    setFieldIndicator: function(point, vect, units) {
        // mapping a Float32Array does not work
        let pt = [];
        point.forEach(function (c) {
            pt.push(rsUtils.roundToPlaces(c, 2));
        });
        const val = Math.hypot(vect[0], vect[1], vect[2]);
        const theta = 180 * Math.acos(vect[2] / (val || 1)) / Math.PI;
        const phi = 180 * Math.atan2(vect[1], vect[0]) / Math.PI;
        //rsUtils.rsdbg('point', point, 'val', val, 'theta', theta, 'phi', phi, 'min/max', min, max);
        const txt = isNaN(val) ?
            '--' :
            rsUtils.roundToPlaces(val, 4) + units +
            '  θ ' + rsUtils.roundToPlaces(theta, 2) +
            '°  φ ' + rsUtils.roundToPlaces(phi, 2) +
            '°  at (' + pt + ')';

        const min = this.fieldColorMapScale.domain()[0];
        const max = this.fieldColorMapScale.domain()[1];

        const iw = this.select('.vector-field-indicator-pointer').width();
        const f = Math.abs(val - min) / ((max - min) || 1);
        const l = this.fieldColorMapScale((isNaN(val) ? min : val)) - 0.5 * iw;
        const g = guiUtils.getColorMap(this.model.get('field_color_map_name'), null, '');
        const i = Math.floor(f * (g.length - 1));

        this.select('.vector-field-indicator-pointer')
            .css('margin-left', (l + 'px'))
            .css('color', guiUtils.fgColorForBG(g[i || 0], '#'));
        this.setSelectionText(txt);
    },

    setSelectionText: function(txt) {
        this.select('.selection-info-value')
            .text(txt);
    },

    setTitle: function() {
        this.select('.radia-viewer-title').text(this.model.get('title'));
    },

});

module.exports = {
    RadiaViewerModel: RadiaViewerModel,
    RadiaViewerView: RadiaViewerView
};

