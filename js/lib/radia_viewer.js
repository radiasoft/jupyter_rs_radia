
import $ from 'jquery';
import * as d3 from 'd3';
import * as guiUtils from './gui_utils.js';
import * as rsUtils from './rs_utils.js';
import { VBoxModel, VBoxView } from '@jupyter-widgets/controls';
import { scaleLinear } from 'd3-scale';

const MSG_TYPE_DEBUG = 'debug';
const MSG_TYPE_ERROR = 'error';
const MSG_TYPE_REFRESH = 'refresh';
const MSG_TYPE_UPLOAD = 'upload';

const MSG_TYPES = [
    MSG_TYPE_DEBUG,
    MSG_TYPE_ERROR,
    MSG_TYPE_REFRESH,
    MSG_TYPE_UPLOAD
];

const template = [
    '<div class="radia-viewer">',
        '<div class="radia-viewer-title" style="font-weight: normal; text-align: center"></div>',
        '<input class="radia-file-input" type="file" style="visibility:hidden" />',  // move to widget?
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

export class RadiaViewerModel extends VBoxModel {
    defaults() {
        return {
            ...super.defaults(),
            _model_name: 'RadiaViewerModel',
            _view_name: 'RadiaViewerView',
            _model_module: 'jupyter_rs_radia',
            _view_module: 'jupyter_rs_radia',
            _model_module_version: '0.1.0',
            _view_module_version: '0.1.0',
        };
    }
}

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

export class RadiaViewerView extends VBoxView {

    fieldColorMapAxis = null;
    fieldColorMapScale = null;

    //TODO(mvk): read schema from file
    schema = {
        field_color_maps: guiUtils.getColorMaps(),
        field_color_map_name: 'viridis',
        num_field_cmap_ticks: 6,
        vector_scaling_types: ['Uniform', 'Linear', 'Log'],
        vector_scaling: 'Uniform',
    };
    vtkViewer = null;
    vtkViewerEl =  null;

    getVectors() {
        return ((this.model.get('model_data').data || [])[0] || {}).vectors;
    }

    handleCustomMessages(msg) {
        //rsUtils.rsdbg(msg);
        if (MSG_TYPES.indexOf(msg.type) < 0) {
            throw new Error(msg.type + ': Unknown message type')
        }

        if (msg.type === MSG_TYPE_DEBUG) {
            rsUtils.rsdbg(msg.msg);
        }

        if (msg.type === MSG_TYPE_ERROR) {
            rsUtils.rserr(msg.msg);
        }

        if (msg.type === MSG_TYPE_REFRESH) {
            this.refresh();
        }

        if (msg.type === MSG_TYPE_UPLOAD) {
            this.upload();
        }
    }

    // have to return a function constructed with this viewer, otherwise "this" will refer to
    // the child viewer
    processSelectedObject(viewer) {
        return function (objectInfo) {
            viewer.setSelectionText((objectInfo || {}).group || '--');
        };
    }

    // have to return a function constructed with this viewer, otherwise "this" will refer to
    // the child viewer
    processSelectedVector(viewer) {
        return function (point, vect) {
            let v = viewer.getVectors();
            viewer.setFieldIndicator(point, vect, (v.units || ''));
        };
    }

    refresh() {
        //rsUtils.rserr('radia refresh');
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
            this.fieldColorMapScale = scaleLinear()
                .domain(vectors.range).nice()
                .range([0, this.select('.vector-field-color-map-axis').width()]);
            this.fieldColorMapAxis.scale(this.fieldColorMapScale);
            this.select('.vector-field-color-map-axis > svg > g', 'd3').call(this.fieldColorMapAxis);
        }

        this.setFieldColorMap();
        this.setFieldScaling();
        this.processSelectedObject(this)();
        this.processSelectedVector(this)([], []);
    }

    render() {
        //rsUtils.rsdbg('radia render');
        // this is effectively "super.render()"
        VBoxView.prototype.render.apply((this));

        const view = this;

        getVTKView(this).then(function (o) {
            view.vtkViewer = o;
            view.vtkViewerEl = $(view.vtkViewer.el).find('.vtk-widget');
            view.vtkViewerEl.append($(template));
            view.fieldColorMapAxis = d3.axisBottom(scaleLinear())
                .ticks(view.schema.num_field_cmap_ticks);
            view.select('.vector-field-color-map-axis .axis', 'd3')
                .call(view.fieldColorMapAxis);

            view.setTitle();
            view.vtkViewer.processPickedObject = view.processSelectedObject(view);
            view.vtkViewer.processPickedVector = view.processSelectedVector(view);

            // this is a hidden element
            $(view.el).find('.radia-file-input')
                .on('change', function (e) {
                    const f = e.target.files[0];
                    const fr = new FileReader();
                    fr.onload = function() {
                        const d = fr.result.split(/,\s*/).map(function (x) {
                            return parseFloat(x);
                        });
                        $(view.el).find('.widget-label.rs-file-input-label').text(f.name);
                        view.model.set('file_data', d);
                        view.touch();
                    };
                    fr.readAsText(f);
                });

            /*
            $(view.el).find('.radia-file-output')
                .on('click', function (e) {
                    //'data:text/plain;charset=utf-8,' + encodeURIComponent(csv);
                    e.stopPropagation();
                });
            */
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
    }

    select(selector, module) {
        if (! module || module === '$') {
            return $(this.el).find(selector);
        }
        if (module === 'd3') {
            return d3.select(selector);
        }
        return null;
    }

    setFieldColorMap() {
        let mapName = this.model.get('field_color_map_name');
        if (! mapName) {
            rsUtils.rslog('setFieldColorMap: No color map');
            return;
        }
        this.setFieldColorMapScale();
    }

    setFieldColorMapScale() {
        const mapName = this.model.get('field_color_map_name');
        if (! mapName) {
            rsUtils.rslog('setFieldColorMapScale: No color map');
            return;
        }
        const g = guiUtils.getColorMap(mapName, null, '#');
        this.select('.vector-field-color-map')
            .css('background', 'linear-gradient(to right, ' + g.join(',') + ')');
    }

    setFieldScaling() {
        this.vtkViewer.setVectorScaling(this.model.get('vector_scaling'));
    }

    setFieldIndicator(point, vect, units) {
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
    }

    setSelectionText(txt) {
        this.select('.selection-info-value')
            .text(txt);
    }

    setTitle() {
        this.select('.radia-viewer-title').text(this.model.get('title'));
    }

    upload() {
        $(this.el).find('.radia-file-input').trigger('click');
    }
}
