let _ = require('lodash');
let $ = require('jquery');
require('vtk.js');
let controls = require('@jupyter-widgets/controls');
let guiUtils = require('./gui_utils');
let widgets = require('@jupyter-widgets/base');
let rsUtils = require('./rs_utils');

const MAIN_ACTOR = 'main';
const VECTOR_ACTOR = 'vector';

let template = [
    '<div style="border-style: solid; border-color: blue; border-width: 1px;">',
        '<div class="viewer-title" style="font-weight: normal; text-align: center"></div>',
        '<div style="margin: 1em;">',
            '<div class="vtk-content"></div>',
        '</div>',
    '</div>',
    // this to move to radia viewer
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
].join('');

// used to create array of arrows (or other objects) for vector fields
// change to use magnitudes and color locally
function getVectFormula(vectors, colorMapName) {

    // can we cache these?
    const cmap = guiUtils.getColorMap(colorMapName);
    const norms = rsUtils.normalize(vectors.magnitudes);

    let logMags = vectors.magnitudes.map(function (n) {
        return Math.log(n);
    });

    // get log values back into the original range, so that the extremes have the same
    // size as a linear scale
    let minLogMag = Math.min.apply(null, logMags);
    let maxLogMag = Math.max.apply(null, logMags);
    let minMag = Math.min.apply(null, vectors.magnitudes);
    let maxMag = Math.max.apply(null, vectors.magnitudes);

    logMags = logMags.map(function (n) {
        return minMag + (n - minLogMag) * (maxMag - minMag) / (maxLogMag - minLogMag);
    });

    return {
        getArrays: function(inputDataSets) {
            return {
                input: [
                    {
                        location: vtk.Common.DataModel.vtkDataSet.FieldDataTypes.COORDINATE,
                    }
                ],
                output: [
                    {
                        location: vtk.Common.DataModel.vtkDataSet.FieldDataTypes.POINT,
                        name: 'orientation',
                        dataType: 'Float32Array',
                        numberOfComponents: 3,
                    },
                    {
                        location: vtk.Common.DataModel.vtkDataSet.FieldDataTypes.POINT,
                        name: 'linScale',
                        dataType: 'Float32Array',
                        numberOfComponents: 3,
                    },
                    {
                        location: vtk.Common.DataModel.vtkDataSet.FieldDataTypes.POINT,
                        name: 'logScale',
                        dataType: 'Float32Array',
                        numberOfComponents: 3,
                    },
                    // use unsigned char array ('Uint8Array') to use our own colors by default
                    // (instead of the mapper's built-in lookup table)
                    {
                        location: vtk.Common.DataModel.vtkDataSet.FieldDataTypes.POINT,
                        name: 'magnitude',
                        dataType: 'Uint8Array',
                        attribute: vtk.Common.DataModel.vtkDataSetAttributes.AttributeTypes.SCALARS,
                        numberOfComponents: 3,
                    },
                ],
            }
        },
        evaluate: function (arraysIn, arraysOut) {
            let coords = arraysIn.map(function (d) {
                return d.getData();
            })[0];
            let o = arraysOut.map(function (d) {
                return d.getData();
            });
            // note these arrays already have the correct length, so we need to set elements, not append
            let orientation = o[0];
            let linScale = o[1];
            let logScale = o[2];
            let magnitude = o[3];

            for (let i = 0; i < coords.length / 3; i += 1) {
                let cIdx  = Math.floor(norms[i] * (cmap.length - 1));
                let c = guiUtils.rgbFromColor(cmap[cIdx], 1.0);
                // scale arrow length (object-local x-direction) only
                // this can stretch/squish the arrowhead though so the actor may have to adjust the ratio
                linScale[3 * i] = vectors.magnitudes[i];
                linScale[3 * i + 1] = 1.0;
                linScale[3 * i + 2] = 1.0;
                logScale[3 * i] = logMags[i];
                logScale[3 * i + 1] = 1.0;
                logScale[3 * i + 2] = 1.0;
               for (let j = 0; j < 3; ++j) {
                    const k = 3 * i + j;
                    orientation[k] = vectors.directions[k];
                    magnitude[k] = c[j];
                }
            }

            // Mark the output vtkDataArray as modified?
            arraysOut.forEach(function (x) {
                x.modified();
            });
        },
    };
}

function indexArray(size) {
    var res = [];
    for (var i = 0; i < size; i++) {
      res.push(i);
    }
    return res;
}

function objToPolyData(json) {
    let colors = [];

    ['lines', 'polygons'].forEach(function (o) {
        for (let i = 0; i < json[o].colors.length; i++) {
            let j = i % 3;
            colors.push(Math.floor(255 * json[o].colors[i]));
            if (j === 2) {
                colors.push(255);
            }
        }
    });

    let polys = [];
    let polyIdx = 0;
    let polyInds = indexArray(json.polygons.vertices.length / 3);
    for (let i = 0; i < json.polygons.lengths.length; i++) {
        let len = json.polygons.lengths[i];
        polys.push(len);
        for (var j = 0; j < len; j++) {
            polys.push(polyInds[polyIdx++]);
        }
    }
    polys = new window.Uint32Array(polys);

    let points = json.polygons.vertices;
    let lineVertOffset = points.length / 3;
    for (let i = 0; i < json.lines.vertices.length; i++) {
        points.push(json.lines.vertices[i]);
    }
    let lines = [];
    let lineIdx = 0;
    let lineInds = indexArray(json.lines.vertices.length / 3);
    for (let i = 0; i < json.lines.lengths.length; i++) {
        let len = json.lines.lengths[i];
        lines.push(len);
        for (let j = 0; j < len; j++) {
            lines.push(lineInds[lineIdx++] + lineVertOffset);
        }
    }
    lines = new window.Uint32Array(lines);
    points = new window.Float32Array(points);

    let pd = vtk.Common.DataModel.vtkPolyData.newInstance();
    pd.getPoints().setData(points, 3);
    pd.getLines().setData(lines);
    pd.getPolys().setData(polys);

    pd.getCellData().setScalars(vtk.Common.Core.vtkDataArray.newInstance({
        numberOfComponents: 4,
        values: colors,
        dataType: vtk.Common.Core.vtkDataArray.VtkDataTypes.UNSIGNED_CHAR
    }));

    pd.buildCells();
    return pd;
}

function vectorsToPolyData(json) {
    let cm = json.vectors.colorMap;
    let points = new window.Float32Array(json.vectors.vertices);
    let pd = vtk.Common.DataModel.vtkPolyData.newInstance();
    pd.getPoints().setData(points, 3);
    return pd;
}

// Custom Model. Custom widgets models must at least provide default values
// for model attributes, including
//
//  - `_view_name`
//  - `_view_module`
//  - `_view_module_version`
//
//  - `_model_name`
//  - `_model_module`
//  - `_model_module_version`
//
//  when different from the base class.

// When serialiazing the entire widget state for embedding, only values that
// differ from the defaults will be specified.
var VTKModel = widgets.DOMWidgetModel.extend({
    defaults: _.extend(widgets.DOMWidgetModel.prototype.defaults(), {
        _model_name : 'VTKModel',
        _view_name : 'VTKView',
        _model_module : 'jupyter-rs-vtk-widget',
        _view_module : 'jupyter-rs-vtk-widget',
        _model_module_version : '0.0.1',
        _view_module_version : '0.0.1',
        bg_color: '#fffaed',
        poly_alpha: 1.0,
        show_marker: true,
        title: ''
    })
});


// Custom View. Renders the widget model.
var VTKView = widgets.DOMWidgetView.extend({

    actors: {},
    fsRenderer: null,
    isLoaded: false,
    orientationMarker: null,


    addActor: function(name, actor) {
        if (! this.fsRenderer) {
            rsUtils.rslog('No renderer');
            return;
        }
        this.actors[name] = actor;
        this.fsRenderer.getRenderer().addActor(actor);
    },

    addViewPort: function() {

    },

    addViewPorts: function() {

    },

    getActor: function(name) {
        return this.actors[name];
    },

    handleCustomMessages: function(msg) {
        if (msg.type == 'axis') {
            this.setAxis(msg.axis, msg.dir);
        }

        if (msg.type === 'debug') {
            rsUtils.rsdbg(msg.msg);
        }

        if (msg.type === 'refresh') {
            rsUtils.rsdbg('msg rfrs');
            //this.refresh();
        }

        if (msg.type === 'reset') {
            this.resetView();
        }

    },

    setData: function(d) {
        this.model.set('model_data', d);
        this.refresh();
    },

    refresh: function(o) {

        let v = this;
        if (! this.fsRenderer) {
            this.fsRenderer = vtk.Rendering.Misc.vtkFullScreenRenderWindow.newInstance({
                container: $(this.el).find('.vtk-content')[0],
            });
            this.setBgColor();
            this.setEdgesVisible();
        }

        if (! this.orientationMarker) {
            this.orientationMarker = vtk.Interaction.Widgets.vtkOrientationMarkerWidget.newInstance({
                actor: vtk.Rendering.Core.vtkAxesActor.newInstance(),
                interactor: this.fsRenderer.getRenderWindow().getInteractor()
            });
            this.orientationMarker.setViewportCorner(
                vtk.Interaction.Widgets.vtkOrientationMarkerWidget.Corners.TOP_RIGHT
            );
            this.orientationMarker.setViewportSize(0.08);
            this.orientationMarker.setMinPixelSize(100);
            this.orientationMarker.setMaxPixelSize(300);
            this.setMarkerVisible();
        }

        this.removeActors();
        $(this.el).find('.vector-field-color-map').css('display', 'none');

        let sceneData = this.model.get('model_data');
        if ($.isEmptyObject(sceneData)) {
            rsUtils.rslog('No data');
            this.fsRenderer.getRenderWindow().render();
            return;
        }

        let pData = objToPolyData(sceneData);
        let mapper = vtk.Rendering.Core.vtkMapper.newInstance();
        mapper.setInputData(pData);
        let actor = vtk.Rendering.Core.vtkActor.newInstance();
        actor.setMapper(mapper);
        actor.getProperty().setEdgeVisibility(true);
        this.addActor(MAIN_ACTOR, actor);

        if (sceneData.vectors && sceneData.vectors.vertices.length) {
            let vData = vectorsToPolyData(sceneData);
            let vectorCalc = vtk.Filters.General.vtkCalculator.newInstance();
            vectorCalc.setFormula(getVectFormula(sceneData.vectors, this.model.get('field_color_map_name')));
            vectorCalc.setInputData(vData);

            let mapper = vtk.Rendering.Core.vtkGlyph3DMapper.newInstance();
            mapper.setInputConnection(vectorCalc.getOutputPort(), 0);

            let s = vtk.Filters.Sources.vtkArrowSource.newInstance();
            mapper.setInputConnection(s.getOutputPort(), 1);
            mapper.setOrientationArray('orientation');
            //mapper.setScaleArray('linScale');

            // this scales by a constant - the default is to use scalar data
            //TODO(mvk): set based on bounds size
            //rsUtils.rsdbg('bounds', mapper.getBounds());
            mapper.setScaleFactor(8.0);
            mapper.setScaleModeToScaleByConstant();
            mapper.setColorModeToDefault();

            let actor = vtk.Rendering.Core.vtkActor.newInstance();
            actor.setMapper(mapper);
            actor.getProperty().setEdgeVisibility(false);
            actor.getProperty().setLighting(false);
            this.addActor(VECTOR_ACTOR, actor);
            $(this.el).find('.vector-field-color-map').css('display', 'block');

            //TODO(mvk): real axis with tick marks, labels, etc.
            let fieldTicks = $(this.el).find('.vector-field-color-map-axis span');
            let numTicks = fieldTicks.length;
            if (numTicks >= 2) {
                let minV = Math.min.apply(null, sceneData.vectors.magnitudes);
                let maxV = Math.max.apply(null, sceneData.vectors.magnitudes);
                fieldTicks[0].textContent = ('' + minV).substr(0, 4);
                fieldTicks[numTicks - 1].textContent = ('' + maxV).substr(0, 4);
                let dv = (maxV - minV) / (numTicks - 1);
                for (let i = 1; i < numTicks - 1; ++i) {
                    fieldTicks[i].textContent = ('' + (i * dv)).substr(0, 4);
                }
            }

        }

        this.resetView();
    },

    removeActors: function() {
        let r = this.fsRenderer.getRenderer();
        r.getActors().forEach(function(actor) {
            r.removeActor(actor);
        });
        this.actors = {};
    },

    render: function() {
        //let c = document.cookie;
        //rsUtils.rsdbg('cookies', c);
        this.model.on('change:model_data', this.refresh, this);
        this.model.on('change:bg_color', this.setBgColor, this);
        this.model.on('change:field_color_map_name', this.setFieldColorMap, this);
        this.model.on('change:poly_alpha', this.setPolyAlpha, this);
        this.model.on('change:show_marker', this.setMarkerVisible, this);
        this.model.on('change:show_edges', this.setEdgesVisible, this);
        this.model.on('change:title', this.refresh, this);
        this.model.on('change:vector_scaling', this.setFieldScaling, this);
        if (! this.isLoaded) {
            $(this.el).append($(template));
            this.setTitle();
            this.model.set('field_color_maps', guiUtils.getColorMaps());
            this.setFieldColorMapScale();
            this.isLoaded = true;
            this.listenTo(this.model, "msg:custom", this.handleCustomMessages);
        }
    },

    resetView: function() {
        this.setCam([1, -0.4, 0], [0, 0, 1]);
    },

    // may have to get axis orientation from data?
    setAxis: function(axis, dir) {
        let camPos = axis === 'X' ? [dir, 0, 0] : (axis === 'Y' ? [0, dir, 0] : [0, 0, dir] );
        let camViewUp = axis === 'Y' ? [0, 0, 1] : [0, 1, 0];
        this.setCam(camPos, camViewUp);
    },

    setCam: function(pos, vu) {
        let r = this.fsRenderer.getRenderer();
        let cam = r.get().activeCamera;
        cam.setPosition(pos[0], pos[1], pos[2]);
        cam.setFocalPoint(0, 0, 0);
        cam.setViewUp(vu[0], vu[1], vu[2]);
        r.resetCamera();
        cam.zoom(1.3);
        this.orientationMarker.updateMarkerOrientation();
        this.fsRenderer.getRenderWindow().render();
    },

    setBgColor: function() {
        this.fsRenderer.setBackground(vtk.Common.Core.vtkMath.hex2float(this.model.get('bg_color')));
        this.fsRenderer.getRenderWindow().render();
    },

    setEdgesVisible: function() {
        let v = this;
        let r = this.fsRenderer.getRenderer();
        r.getActors().forEach(function(actor) {
            actor.getProperty().setEdgeVisibility(v.model.get('show_edges'));
            let l = actor.getMapper().getInputData().getLines();
        });
        this.fsRenderer.getRenderWindow().render();
    },

    setFieldColorMap: function() {
        let mapName = this.model.get('field_color_map_name');
        this.getActor(VECTOR_ACTOR)
            .getMapper().getInputConnection(0).filter
            .setFormula(getVectFormula(this.model.get('model_data').vectors, mapName));
        this.setFieldColorMapScale();
        this.fsRenderer.getRenderWindow().render();
    },

    setFieldColorMapScale: function() {
        let mapName = this.model.get('field_color_map_name');
        let g = guiUtils.getColorMap(mapName, null, '#');
        $(this.el).find('.vector-field-color-map')
            .css('background', 'linear-gradient(to right, ' + g.join(',') + ')');
    },

    setFieldScaling: function() {
        let vs = this.model.get('vector_scaling');
        let mapper = this.getActor(VECTOR_ACTOR).getMapper();
        //rsUtils.rsdbg('bounds', mapper.getBounds());
        if (vs === 'Uniform') {
            // use bounds
            mapper.setScaleFactor(8.0);
            mapper.setScaleModeToScaleByConstant();
        }
        if (vs === 'Linear') {
            mapper.setScaleFactor(8.0);
            mapper.setScaleArray('linScale');
            mapper.setScaleModeToScaleByComponents();
        }
        if (vs === 'Log') {
            mapper.setScaleFactor(8.0);
            mapper.setScaleArray('logScale');
            mapper.setScaleModeToScaleByComponents();
        }
        this.fsRenderer.getRenderWindow().render();
    },

    setMarkerVisible: function() {
        this.orientationMarker.setEnabled(this.model.get('show_marker'));
        this.fsRenderer.getRenderWindow().render();
    },

    setPolyAlpha: function() {
        let v = this;
        let r = this.fsRenderer.getRenderer();
        r.getActors().forEach(function(actor) {
            //TODO(mvk): should only affect polygons, not entire actor
            //let m = actor.getMapper();
            //let p = m.getInputData();
            actor.getProperty().setOpacity(v.model.get('poly_alpha'));
        });
        this.fsRenderer.getRenderWindow().render();
    },

    setTitle: function() {
        $(this.el).find('.viewer-title').text(this.model.get('title'));
    },

});

var ViewerModel = controls.VBoxModel.extend({

    defaults: _.extend(controls.VBoxModel.prototype.defaults(), {
        _model_name: 'ViewerModel',
        _view_name: 'ViewerView',
        _model_module: 'jupyter-rs-vtk-widget',
        _view_module: 'jupyter-rs-vtk-widget',
        _model_module_version: '0.0.1',
        _view_module_version: '0.0.1',
    }),
}, {});

var ViewerView = controls.VBoxView.extend({

    handleCustomMessages: function(msg) {
        if (msg.type === 'debug') {
            rsUtils.rsdbg(msg.msg);
        }
    },

    render: function() {
        // this is effectively "super.render()"
        controls.VBoxView.prototype.render.apply((this));
        this.listenTo(this.model, "msg:custom", this.handleCustomMessages);
    }
});

module.exports = {
    ViewerModel: ViewerModel,
    ViewerView: ViewerView,
    VTKModel: VTKModel,
    VTKView: VTKView
};
