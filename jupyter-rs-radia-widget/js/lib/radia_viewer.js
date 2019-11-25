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

function getVTKView(o) {
    //rsUtils.rsdbg('rpv', o);
    //let w = $(o.el).find('.vtk-widget');
    //if (w.length) {
    //    return w;
    //}
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

        const view = this;

        getVTKView(this).then(function (o) {

            view.vtkViewer = o;
            view.vtkViewerEl = $(view.vtkViewer.el).find('.vtk-widget');
            view.vtkViewerEl.append($(template));
            rsUtils.rsdbg('got vtkViewer', view.vtkViewer);

            /*
            this.vtkViewer.vectFormula.evaluate = function (arraysIn, arraysOut) {
                let coords = arraysIn.map(function (d) {
                    return d.getData();
                })[0];
                let o = arraysOut.map(function (d) {
                    return d.getData();
                });
                // note these arrays already have the correct length, so we need to set elements, not append
                let orientation = o[getVectOutIndex(ORIENTATION_ARRAY)];
                let linScale = o[getVectOutIndex(LINEAR_SCALE_ARRAY)].fill(1.0);
                let logScale = o[getVectOutIndex(LOG_SCALE_ARRAY)].fill(1.0);
                let scalars = o[getVectOutIndex(SCALAR_ARRAY)];

                for (let i = 0; i < coords.length / 3; i += 1) {
                    let c = [0, 0, 0];
                    if (cmap.length) {
                        let cIdx = Math.floor(norms[i] * (cmap.length - 1));
                        c = guiUtils.rgbFromColor(cmap[cIdx], 1.0);
                    }
                    // scale arrow length (object-local x-direction) only
                    // this can stretch/squish the arrowhead though so the actor may have to adjust the ratio
                    linScale[3 * i] = vectors.magnitudes[i];
                    logScale[3 * i] = logMags[i];
                    for (let j = 0; j < 3; ++j) {
                        const k = 3 * i + j;
                        orientation[k] = vectors.directions[k];
                        scalars[k] = c[j];
                    }
                }

                // Mark the output vtkDataArray as modified
                arraysOut.forEach(function (x) {
                    x.modified();
                });
            }
             */
        });

        // store current settings in cookies?
        //let c = document.cookie;
        //rsUtils.rsdbg('cookies', c);

        //this.model.on('change:model_data', this.refresh, this);
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
        this.vtkViewer.setFieldColorMap(mapName);
        // send info to vtk - actor name, map name, formula function?
        //actor.getMapper().getInputConnection(0).filter
        //    .setFormula(getVectFormula(this.model.get('model_data').data[0].vectors, mapName));
        this.setFieldColorMapScale();
    },

    setFieldColorMapScale: function() {
        let mapName = this.model.get('field_color_map_name');
        if (! mapName) {
            rsUtils.rslog('setFieldColorMapScale: No color map');
            return;
        }
        //this.vtkViewer.setFieldColorMap(mapName);
        let g = guiUtils.getColorMap(mapName, null, '#');
        $(this.el).find('.vector-field-color-map')
            .css('background', 'linear-gradient(to right, ' + g.join(',') + ')');
    },

    setFieldScaling: function() {
        let vs = this.model.get('vector_scaling');
        rsUtils.rsdbg('radia set fs to', vs);
        this.vtkViewer.setFieldScaling(vs);
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

