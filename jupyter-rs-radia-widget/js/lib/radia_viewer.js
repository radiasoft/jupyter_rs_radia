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
        '<div class="vector-field-color-map-content" style="display: none; padding-left: 4px; padding-right: 4px;">',
            '<div class="vector-field-indicator">',
                '<span class="vector-field-indicator-value" style="padding-left: 4px;">--</span>',
            '</div>',
            '<div class="vector-field-color-map" style="height: 32px; overflow: hidden; box-shadow: 0 0 0 1px black inset;">',
                '<span class="vector-field-indicator-pointer" style="font-size: x-large;">▼</span>',
            '</div>',
            '<div class="vector-field-color-map-axis" style="height: 32px;">',
                '<div class="vector-field-color-map-axis-ticks">',
                    '<svg></svg>',
                '</div>',
                '<div class="vector-field-color-map-axis-scale" style="display: flex; flex-direction: row; flex-wrap: nowrap; justify-content: space-between;">',
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

    fieldColorMapAxis: null,
    scale: null,

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
    processPickedVector: function(viewer) {
        return function (coords, vect) {
            let v = viewer.getVectors();
            viewer.setFieldIndicator(coords, vect, v.range[0], v.range[1], (v.units || ''));
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
        this.select('.vector-field-color-map-axis-ticks svg')
            .css('width', '100%')
            .css('height', '8');

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

        let fieldTicks = this.select('.vector-field-color-map-axis span');
        const ticks = this.select('.vector-field-color-map-axis-ticks svg line');
        let numTicks = fieldTicks.length;
        if (numTicks >= 2) {
            this.scale = d3Scale.scaleLinear()
                .domain(vectors.range)
                .range([0, this.select('.vector-field-color-map-axis').width()]);
            this.fieldColorMapAxis = d3.axisBottom(this.scale)
                .ticks(this.schema.num_field_cmap_ticks);

            let minV = vectors.range[0];
            let maxV = vectors.range[1];
            fieldTicks[0].textContent = '' + rsUtils.roundToPlaces(minV, 2);
            fieldTicks[numTicks - 1].textContent = '' + rsUtils.roundToPlaces(maxV, 2);
            let dv = (maxV - minV) / (numTicks - 1);
            for (let i = 1; i < numTicks - 1; ++i) {
                const fp = $(fieldTicks[i]).position().left;
                fieldTicks[i].textContent = ('' + rsUtils.roundToPlaces(i * dv, 2));
                if (ticks[i - 1]) {
                    $(ticks[i - 1]).attr('transform', 'translate(' + fp + ', 0)');
                }
            }
        }

        this.setFieldScaling();
        this.setFieldIndicator([], [], vectors.range[0], vectors.range[1], vectors.units);
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
            const scale = view.select('.vector-field-color-map-axis-scale');
            const ticks = view.select('.vector-field-color-map-axis-ticks svg');
            const svgNS = 'http://www.w3.org/2000/svg';
            for (let i = 1; i <= view.schema.num_field_cmap_ticks; ++i) {
                $(scale).append('<span>');
                if (i < view.schema.num_field_cmap_ticks - 1) {
                    // translate when view is available
                    $(document.createElementNS(svgNS,'line'))
                        .attr({x2: 0, y2: 6, stroke: 'black'})
                        .appendTo($(ticks));
                }
            }

            view.vtkViewer.processPickedVector = view.processPickedVector(view);
        });

        // store current settings in cookies?  Or serialized widget?
        //let c = document.cookie;
        //rsUtils.rsdbg('cookies', c);

        //this.model.on('change:model_data', this.refresh, this);
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

    setFieldIndicator: function(coords, vect, min, max, units) {
        // mapping a Float32Array does not work
        let crd = [];
        coords.forEach(function (c) {
            crd.push(rsUtils.roundToPlaces(c, 2));
        });
        const val = Math.hypot(vect[0], vect[1], vect[2]);
        const theta = 180 * Math.acos(vect[2] / (val || 1)) / Math.PI;
        const phi = 180 * Math.atan2(vect[1], vect[0]) / Math.PI;
        //rsUtils.rsdbg('coords', coords, 'val', val, 'theta', theta, 'phi', phi, 'min/max', min, max);
        const txt = isNaN(val) ?
            '--' :
            rsUtils.roundToPlaces(val, 4) + units +
            '  θ ' + rsUtils.roundToPlaces(theta, 2) +
            '°  φ ' + rsUtils.roundToPlaces(phi, 2) +
            '°  at (' + crd + ')';

        const w = this.select('.vector-field-color-map').width();
        const iw = this.select('.vector-field-indicator-pointer').width();
        const f = Math.abs(val - min) / ((max - min) || 1);
        const l = (isNaN(val) ? 0 : w * f) - 0.5 * iw;
        const g = guiUtils.getColorMap(this.model.get('field_color_map_name'), null, '');
        const i = Math.floor(f * (g.length - 1));

        this.select('.vector-field-indicator-pointer')
            .css('margin-left', (l + 'px'))
            .css('color', guiUtils.fgColorForBG(g[i || 0], '#'));
        this.select('.vector-field-indicator-value')
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

