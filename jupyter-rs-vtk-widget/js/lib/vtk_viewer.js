let _ = require('lodash');
let $ = require('jquery');
require('vtk.js');
let controls = require('@jupyter-widgets/controls');
let guiUtils = require('./gui_utils');
//let guiUtils = require('rs-widget-utils/gui_utils');
let widgets = require('@jupyter-widgets/base');
let rsUtils = require('./rs_utils');
//let rsUtils = require('rs-widget-utils/rs_utils');
let vtkUtils = require('./vtk_utils');

const GEOM_SURFACE_ACTOR = 'geomSurface';
const LINEAR_SCALE_ARRAY = 'linScale';
const LOG_SCALE_ARRAY = 'logScale';
const ORIENTATION_ARRAY = 'orientation';
const SCALAR_ARRAY = 'scalars';
const VECTOR_ACTOR = 'vector';

const ACTOR_TYPES = [GEOM_SURFACE_ACTOR, VECTOR_ACTOR];

let template = [
    '<div class="vtk-widget" style="border-style: solid; border-color: blue; border-width: 1px;">',
        '<div class="viewer-title" style="font-weight: normal; text-align: center"></div>',
        '<div style="margin: 1em;">',
            '<div class="vtk-content"></div>',
        '</div>',
    '</div>',
    // this to move to radia viewer
    //'<div class="vector-field-color-map-content">',
    //    '<div class="vector-field-indicator">',
    //        '<span class="vector-field-indicator-pointer" style="font-size: x-large">▼</span>',
    //        '<span class="vector-field-indicator-value">0</span>',
    //    '</div>',
    //    '<div class="vector-field-color-map" style="height: 32px;"></div>',
    //    '<div class="vector-field-color-map-axis" style="height: 32px;">',
    //        '<div style="display: flex; flex-direction: row; flex-wrap: nowrap; justify-content: space-between;">',
    //            '<span>0.0</span>',
    //            '<span>0.2</span>',
    //            '<span>0.4</span>',
    //            '<span>0.6</span>',
    //            '<span>0.8</span>',
    //            '<span>1.0</span>',
    //        '</div>',
    //    '</div>',
    //'</div>',
].join('');

// these objects are used to set various vector properties
let vectInArrays = [{
    location: vtk.Common.DataModel.vtkDataSet.FieldDataTypes.COORDINATE,
}];

let vectOutArrays = [{
        location: vtk.Common.DataModel.vtkDataSet.FieldDataTypes.POINT,
        name: SCALAR_ARRAY,
        dataType: 'Uint8Array',
        attribute: vtk.Common.DataModel.vtkDataSetAttributes.AttributeTypes.SCALARS,
        numberOfComponents: 3,
    },
];
[LINEAR_SCALE_ARRAY, LOG_SCALE_ARRAY, ORIENTATION_ARRAY].forEach(function (n) {
    vectOutArrays.push({
        location: vtk.Common.DataModel.vtkDataSet.FieldDataTypes.POINT,
        name: n,
        dataType: 'Float32Array',
        numberOfComponents: 3,
    })
});

const vectArrays = {
    input: vectInArrays,
    output: vectOutArrays,
};

function getVectOutIndex(name) {
    for (let vIdx in vectArrays.output) {
        if (vectArrays.output[vIdx].name === name) {
            return vIdx;
        }
    }
    throw new Error('No vector array named ' + name);
}

// used to create array of arrows (or other objects) for vector fields
// change to use magnitudes and color locally
function getVectFormula(vectors, colorMapName) {

    // can we cache these?
    const cmap = colorMapName ? guiUtils.getColorMap(colorMapName) : [];
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
            return vectArrays;
        },
        evaluate: function (arraysIn, arraysOut) {
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
        },
    };
}

// to be used by picker
function getVectorMagnitude() {

}

function typeForName(name) {
    for (let i = 0; i <  ACTOR_TYPES.length; ++i) {
        if (name.startsWith(ACTOR_TYPES[i])) {
            return ACTOR_TYPES[i];
        }
    }
    return null;
}

// if a "line" has the same points as a polygon, associate the line index to that of the poly.
// CellPickers seem to prioritize edges
function mapLinesToPolys(polyData) {
    let lines = polyData.getLines().getData();
    let polys = polyData.getPolys().getData();
    let points = polyData.getPoints().getData();
    let map = {};
    let i = 0;
    let j = 0;
    let lp = [];
    while (i < lines.length) {
        let inds = lines.slice(i + 1, i + lines[i] + 1);
        let pts = [];
        for (let k = 0; k < inds.length; ++k) {
            let tdx = 3 * inds[k];
            pts.push(points.slice(tdx, tdx + 3));
        }
        lp.push(pts);
        i += (lines[i] + 1);
        ++j;
    }

    i = 0;
    j = 0;
    let pp = [];
    while (i < polys.length) {
        let inds = polys.slice(i + 1, i + polys[i] + 1);
        let pts = [];
        for (let k = 0; k < inds.length; ++k) {
            let tdx = 3 * inds[k];
            pts.push(points.slice(tdx, tdx + 3));
        }
        pts.push(pts[0]);  // to cf with lines
        pp.push(pts);
        i += (polys[i] + 1);
        ++j;
    }

    // loop over lines
    for (let i = 0; i < lp.length; ++i) {
        let lpts = lp[i];
        // loop over polys
        for (let j = 0; j < pp.length; ++j) {
            //if (Object.values(map).indexOf(j) >= 0) {
            //    continue;
            //}
            let ppts = pp[j];
            if (lpts.length !== ppts.length) {
                continue;
            }
            // loop over coord sets
            let smatch = true;
            for (let k = 0; k < lpts.length; ++k) {
                let cmatch = true;
                // loop over coords
                for (let m = 0; m < 3; ++m) {
                    cmatch = cmatch && lpts[k][m] === ppts[k][m];
                    if (! cmatch) {
                        break;
                    }
                }
                smatch = smatch && cmatch;
                if (! smatch) {
                    break;
                }
            }
            if (smatch) {
                map[i] = j;
                break;
            }
        }
    }
    //rsUtils.rsdbg('l -> p', map);
    return map;
}

function numLineColors(polyData) {
    return numDataColors(polyData.getLines().getData());
}

function numPolyColors(polyData) {
    return numDataColors(polyData.getPolys().getData());
}

// lines and poly data arrays look like:
//    [<num vertices for obj 0>, <vertex 0, 0>, ...,]
function numDataColors(data) {
    let i = 0;
    let j = 0;
    while (i < data.length) {
        i += (data[i] + 1);
        ++j;
    }
    return j;
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
    })
});


// Custom View. Renders the widget model.
var VTKView = widgets.DOMWidgetView.extend({

    actorInfo: {},
    cPicker: null,
    fsRenderer: null,
    isLoaded: false,
    orientationMarker: null,
    ptPicker: null,
    selectedObject: null,

    // stash the actor and associated info to avoid recalculation
    addActor: function(name, actor, pickable) {
        if (! this.fsRenderer) {
            // exception?
            //rsUtils.rslog('No renderer');
            throw new Error('No renderer');
            //return;
        }
        if (! actor.getMapper() || ! actor.getMapper().getInputData()) {
            throw new Error('Actor ' + name + ' has no mapper or data');
        }

        rsUtils.rsdbg('adding actor', name);
        let pData = actor.getMapper().getInputData();

        let info = {
            actor: actor,
            lineIndices: [],
            linePolyMap: mapLinesToPolys(pData),
            name: name,
            numLineColors: numLineColors(pData),
            numPolyColors: numPolyColors(pData),
            pData: pData,
            polyIndices: [],
            scalars: pData.getCellData().getScalars(),
            type: typeForName(name),
        };
        if (info.scalars) {
            // depends on order the points were added.  Maybe map an offset instead
            info.lineIndices = rsUtils.indexArray(info.numLineColors)
                .map(function (i) {
                    return 4 * i;
                });
            info.polyIndices = rsUtils.indexArray(info.numPolyColors)
                .map(function (i) {
                    return 4 * (i + info.numLineColors);
                });
        }

        this.actorInfo[name] = info;

        this.fsRenderer.getRenderer().addActor(actor);
        if (pickable) {
            this.ptPicker.addPickList(actor);
            this.cPicker.addPickList(actor);
        }
    },

    addViewPort: function() {

    },

    addViewPorts: function() {

    },

    getActor: function(name) {
        return (this.getActorInfo(name) || {}).actor;
    },

    getActorInfo: function(name) {
        return this.actorInfo[name];
    },

    getActorInfoOfType: function(typeName) {
        const view = this;
        return Object.keys(this.actorInfo)
            .filter(function (name) {
            return name.startsWith(typeName);
        })
            .map(function (name) {
                return view.getActorInfo(name);
            })
    },

    getActorsOfType: function(typeName) {
        return this.getActorInfoOfType(typeName).map(function (info) {
            return info.actor;
        });
    },

    getInfoForActor: function(actor) {
        for (let n in this.actorInfo) {
            if (this.getActor(n) === actor) {
                return this.getActorInfo(n);
            }
        }
    },

    // color at
    getPolyColorFor(name, pIdx) {
        let info = this.getInfo(name);
        let s = info.scalars;
        if (! info.pData || ! s || pIdx >= info.numPolyColors) {
            return null;
        }
        let colors = s.getData();
        let c = colors.slice(info.numLineColors + pIdx, info.numLineColors + pIdx + 4);
        return c;
    },

    handleCustomMessages: function(msg) {
        //rsUtils.rsdbg('VTKView custom', msg);
        if (msg.type === 'axis') {
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

        //rsUtils.rsdbg('refresh');
        const view = this;

        this.selectedObject = null;
        if (! this.fsRenderer) {
            this.fsRenderer = vtk.Rendering.Misc.vtkFullScreenRenderWindow.newInstance({
                container: $(this.el).find('.vtk-content')[0],
            });
            this.fsRenderer.getRenderWindow().getInteractor().onLeftButtonPress(function (callData) {
                let  r = view.fsRenderer.getRenderer();
                if (r !== callData.pokedRenderer) {
                    return;
                }

                // ??
                if (! callData.controlKey) {
                    return;
                }

                //view.selectedObject = null;
                const pos = callData.position;
                const point = [pos.x, pos.y, 0.0];
                view.ptPicker.pick(point, r);
                view.cPicker.pick(point, r);
                const pid = view.ptPicker.getPointId();

                // cell id is "closest cell within tolerance", meaning a single value, though
                // we may get multiple actors
                let cid = view.cPicker.getCellId();
                //rsUtils.rsdbg('Picked pt', point);
                //rsUtils.rsdbg('Picked pt at', pres, 'id', pid);
                rsUtils.rsdbg('Picked cell at', 'cid', cid);
                //if (pid < 0) {
                //    return;
                //}

                let picker = cid >= 0 ? view.cPicker : (pid >= 0 ? view.ptPicker : null);
                if (! picker) {
                    rsUtils.rsdbg('Pick failed');
                    return;
                }

                let pas = picker.getActors();
                let posArr = view.cPicker.getPickedPositions();
                rsUtils.rsdbg('pas', pas, 'positions', posArr);
                //TODO(mvk): need to get actor closest to the "screen" based on the selected points

                let selectedColor = [];
                for (let aIdx in pas) {
                    let actor = pas[aIdx];
                    //view.selectedObject = actor;

                    let pos = posArr[aIdx];
                    let info = view.getInfoForActor(actor);
                    if (! info.pData) {
                        // actor color?
                        continue;
                    }

                    let pts = info.pData.getPoints();

                    // TODO(mvk): attach pick functions to actor info
                    if (info.type === VECTOR_ACTOR) {
                        let n = pts.getNumberOfComponents();
                        let coords = pts.getData().slice(n * pid, n * (pid + 1));
                        let f = actor.getMapper().getInputConnection(0).filter;
                        let linArr = f.getOutputData().getPointData().getArrayByName(LINEAR_SCALE_ARRAY);
                        if (! linArr) {
                            continue;
                        }
                        let d = linArr.getData();
                        let m = d[pid * linArr.getNumberOfComponents()];
                        rsUtils.rsdbg(info.name, 'coords', coords, 'filter out val', m);
                        view.setFieldIndicator(m, d[0], d[d.length - 1]);
                        continue;
                    }
                    if (info.type === GEOM_SURFACE_ACTOR) {

                        // toggle -- does not work if new data is loaded...
                        if (actor === view.selectedObject) {
                            view.selectedObject = null;
                        }
                        else {
                            view.selectedObject = actor;
                        }

                        let colors = info.scalars.getData();
                        let cells = info.pData.getCellData();

                        let cellPts = info.pData.getCellPoints(cid);
                        let ct = cellPts.cellType;
                        if (info.linePolyMap[cid]) {
                            //rsUtils.rsdbg(info.name, 'using poly', info.linePolyMap[cid]);
                            cid = info.linePolyMap[cid];
                            ct = vtk.Common.DataModel.vtkCell.VTK_POLYGON  // use matching poly
                        }
                        // we picked a line cell, find a polygon
                        if (ct === vtk.Common.DataModel.vtkCell.VTK_LINE || ct === vtk.Common.DataModel.vtkCell.VTK_POLY_LINE ) {
                            let j = info.lineIndices[cid];
                            selectedColor = colors.slice(j, j + 3);  // 4 to get alpha
                            //rsUtils.rsdbg(info.name, 'line tup', cid, selectedColor);
                        }
                        else {
                            let j = info.polyIndices[cid];
                            selectedColor = colors.slice(j, j + 3);  // 4 to get alpha
                            rsUtils.rsdbg(info.name, 'poly tup', cid, selectedColor);
                        }
                        if (selectedColor.length > 0) {
                            break;
                        }
                    }
                }

                //rsUtils.rsdbg('selected', view.selectedObject, selectedColor);
                if (selectedColor.length === 0) {
                    view.selectedObject = null;
                    return;
                }
                // can't map, because we will still have a UINT8 array
                let sc = [];
                for (let cIdx = 0; cIdx < selectedColor.length; ++cIdx) {
                    sc.push(selectedColor[cIdx] / 255.0);
                }
                let hsv = [0, 0, 0];
                let scComp = [0, 0, 0];
                vtk.Common.Core.vtkMath.rgb2hsv(sc, hsv);
                rsUtils.rsdbg('rgb', sc, '-> hsv', hsv);
                hsv[0] = 1.0 - hsv[0];
                vtk.Common.Core.vtkMath.hsv2rgb(hsv, scComp);
                rsUtils.rsdbg('comp hsv', hsv, '-> comp rgb', scComp);

                let sch = vtk.Common.Core.vtkMath.floatRGB2HexCode(sc);
                //rsUtils.rsdbg('selected color float', sc, 'hex', sch);
                view.model.set('selected_obj_color', sch);
                //TODO(mvk): figure out a good highlight color programmatically
                for (let name in view.actorInfo) {
                    let a = view.getActor(name);
                    view.setEdgeColor(a, a === view.selectedObject ? [0, 255, 255] : [0, 0, 0]);
                }
            });
            this.setBgColor();
            this.setEdgesVisible();
        }

        this.removeActors();

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

        // need point picker for vector fields and cell picker for magnet objects
        if (! this.ptPicker) {
            this.ptPicker = vtk.Rendering.Core.vtkPointPicker.newInstance();
            this.ptPicker.setPickFromList(1);
            this.ptPicker.initializePickList();
        }

        if (! this.cPicker) {
            this.cPicker = vtk.Rendering.Core.vtkCellPicker.newInstance();
            //this.cPicker.setTolerance(0);
            //this.cPicker.setTolerance(10.0);
            this.cPicker.setPickFromList(false);
            //this.cPicker.initializePickList();
        }


        //this.removeActors();
        $(this.el).find('.vector-field-color-map-content').css('display', 'none');

        let sceneData = this.model.get('model_data');
        if ($.isEmptyObject(sceneData)) {
            rsUtils.rslog('No data');
            this.fsRenderer.getRenderWindow().render();
            return;
        }

        // the data to include are specific to each case and should be settable
        let totalBounds = [
            Number.MAX_VALUE, -Number.MAX_VALUE,
            Number.MAX_VALUE, -Number.MAX_VALUE,
            Number.MAX_VALUE, -Number.MAX_VALUE
        ];

        // move to test method for the user to invoke
        const useTestObjects = false;
        if (useTestObjects) {
            this.addActor('CUBE', vtkUtils.getTestBox(), false);
            this.addActor('CYL', vtkUtils.getTestCylinder(), false);
            this.resetView();
            return;
        }

        const name = sceneData.name;
        let data = sceneData.data;
        rsUtils.rsdbg('got data', data, 'for', name);
        for (let i = 0; i < data.length; ++i) {

            let sceneDatum = data[i];
            let bounds = vtkUtils.objBounds(sceneDatum);
            rsUtils.rsdbg(name, 'poly bounds', bounds);
            let pData = vtkUtils.objToPolyData(sceneDatum, vtkUtils.TYPE_POLY);
            const mapper = vtk.Rendering.Core.vtkMapper.newInstance({
                static: true
            });
            mapper.setInputData(pData);
            let actor = vtk.Rendering.Core.vtkActor.newInstance({
                mapper: mapper
            });
            actor.getProperty().setEdgeVisibility(true);
            this.addActor(GEOM_SURFACE_ACTOR + '_' + i, actor, pData.getNumberOfPolys() > 0);
            //this.addActor(GEOM_SURFACE_ACTOR + '_' + i, actor, true);

            //if (sceneData.vectors && sceneData.vectors.vertices.length) {
            let vectors = sceneDatum.vectors;
            if (vectors && vectors.vertices.length) {
                let vData = vtkUtils.objToPolyData(sceneDatum, vtkUtils.TYPE_VECT);
                let vectorCalc = vtk.Filters.General.vtkCalculator.newInstance();
                vectorCalc.setFormula(getVectFormula(vectors, this.model.get('field_color_map_name')));
                vectorCalc.setInputData(vData);

                let mapper = vtk.Rendering.Core.vtkGlyph3DMapper.newInstance();
                mapper.setInputConnection(vectorCalc.getOutputPort(), 0);

                let s = vtk.Filters.Sources.vtkArrowSource.newInstance();
                mapper.setInputConnection(s.getOutputPort(), 1);
                mapper.setOrientationArray(ORIENTATION_ARRAY);

                // this scales by a constant - the default is to use scalar data
                //TODO(mvk): set based on bounds size
                mapper.setScaleFactor(8.0);
                mapper.setScaleModeToScaleByConstant();
                mapper.setColorModeToDefault();

                let actor = vtk.Rendering.Core.vtkActor.newInstance({
                    mapper: mapper
                });
                actor.getProperty().setLighting(false);
                this.addActor(VECTOR_ACTOR + '_' + i, actor, true);

                $(this.el).find('.vector-field-color-map-content').css('display', 'block');
                this.setFieldColorMapScale();

                //TODO(mvk): real axis with tick marks, labels, etc.
                let fieldTicks = $(this.el).find('.vector-field-color-map-axis span');
                let numTicks = fieldTicks.length;
                if (numTicks >= 2) {
                    let minV = vectors.range[0];  //Math.min.apply(null, vectors.magnitudes);
                    let maxV = vectors.range[1];  //Math.max.apply(null, vectors.magnitudes);
                    fieldTicks[0].textContent = ('' + minV).substr(0, 4);
                    fieldTicks[numTicks - 1].textContent = ('' + maxV).substr(0, 4);
                    let dv = (maxV - minV) / (numTicks - 1);
                    for (let i = 1; i < numTicks - 1; ++i) {
                        fieldTicks[i].textContent = ('' + (i * dv)).substr(0, 4);
                    }
                }
            }
            for(let j = 0; j < 3; ++j) {
                let k = 2 * j;
                totalBounds[k] = Math.min(totalBounds[k], bounds[k]);
                totalBounds[k + 1] = Math.max(totalBounds[k + 1], bounds[k + 1]);
            }
        }
        this.resetView();
    },

    removeActors: function() {
        let r = this.fsRenderer.getRenderer();
        r.getActors().forEach(function(actor) {
            r.removeActor(actor);
        });
        this.actorInfo = {};
    },

    render: function() {
        // store current settings in cookies?
        //let c = document.cookie;
        //rsUtils.rsdbg('cookies', c);
        this.model.on('change:model_data', this.refresh, this);
        this.model.on('change:bg_color', this.setBgColor, this);
        this.model.on('change:selected_obj_color', this.setSelectedObjColor, this);
        this.model.on('change:field_color_map_name', this.setFieldColorMap, this);
        this.model.on('change:poly_alpha', this.setPolyAlpha, this);
        this.model.on('change:show_marker', this.setMarkerVisible, this);
        this.model.on('change:show_edges', this.setEdgesVisible, this);
        this.model.on('change:title', this.refresh, this);
        this.model.on('change:vector_scaling', this.setFieldScaling, this);
        if (! this.isLoaded) {
            $(this.el).append($(template));
            this.setTitle();
            this.isLoaded = true;
            this.listenTo(this.model, 'msg:custom', this.handleCustomMessages);
        }
    },

    resetView: function() {
        this.setCam([1, -0.4, 0], [0, 0, 1]);
    },

    setAlpha: function() {

    },

    // may have to get axis orientation from data?
    setAxis: function(axis, dir) {
        let camPos = axis === 'X' ? [dir, 0, 0] : (axis === 'Y' ? [0, dir, 0] : [0, 0, dir] );
        let camViewUp = axis === 'Y' ? [0, 0, 1] : [0, 1, 0];
        this.setCam(camPos, camViewUp);
    },

    setBgColor: function() {
        this.fsRenderer.setBackground(vtk.Common.Core.vtkMath.hex2float(this.model.get('bg_color')));
        this.fsRenderer.getRenderWindow().render();
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

    // need to allow setting color for entire actor, single poly, or 3d cell
    setSelectedObjColor: function() {
        if (! this.selectedObject) {
            return;
        }
        let info = this.getInfoForActor(this.selectedObject);
        let s = info.scalars;
        let newColor = vtk.Common.Core.vtkMath.hex2float(this.model.get('selected_obj_color'));
        if (! s) {
            this.selectedObject.getProperty().setColor(newColor[0], newColor[1], newColor[2]);
            return;
        }
        let colors = s.getData();
        let nc = s.getNumberOfComponents();
        let i = 0;
        for (let j = 0; j < info.polyIndices.length && i < s.getNumberOfValues(); ++j) {
            for (let k = 0; k < 3; ++k) {
                colors[info.polyIndices[j] + k] = Math.floor(255 * newColor[k]);
            }
            i += nc;
        }
        info.pData.modified();
        this.fsRenderer.getRenderWindow().render();
    },

    setEdgeColor: function(actor, color) {
        if (! actor ) {
            return;
        }
        let info = this.getInfoForActor(actor);
        actor.getProperty().setEdgeColor(color[0], color[1], color[2]);
        let s = info.scalars;
        if (! s) {
            return;
        }
        let colors = s.getData();
        let i = 0;
        for (let j = 0; j < info.lineIndices.length && i < s.getNumberOfValues(); ++j) {
            for (let k = 0; k < 3; ++k) {
                colors[info.lineIndices[j] + k] = color[k];
            }
            i += 4;
        }
        info.pData.modified();

        this.fsRenderer.getRenderWindow().render();
    },

    setEdgesVisible: function() {
        let doShow = this.model.get('show_edges');
        for (let name in this.actorInfo) {
            let info = this.getActorInfo(name);
            // arrows just turn black when edges are on
            if (info.type === VECTOR_ACTOR) {
                continue;
            }
            this.getActor(name).getProperty().setEdgeVisibility(doShow);
            let s = info.scalars;
            if (! s) {
                continue;
            }
            let colors = s.getData();
            let i = 0;
            for (let j = 0; j < info.lineIndices.length && i < s.getNumberOfValues(); ++j) {
                colors[info.lineIndices[j] + 3] = 255 * doShow;
                i += 4;
            }
            info.pData.modified();
        }
        this.fsRenderer.getRenderWindow().render();
    },

    setFieldColorMap: function() {
        let actor = this.getActorsOfType(VECTOR_ACTOR)[0];
        if (! actor) {
            return;
        }
        let mapName = this.model.get('field_color_map_name');
        if (! mapName) {
            rsUtils.rslog('setFieldColorMap: No color map');
            return;
        }
        actor.getMapper().getInputConnection(0).filter
            .setFormula(getVectFormula(this.model.get('model_data').data[0].vectors, mapName));
        this.setFieldColorMapScale();
        this.fsRenderer.getRenderWindow().render();
    },

    setFieldColorMapScale: function() {
        let actor = this.getActorsOfType(VECTOR_ACTOR)[0];
        if (! actor) {
            return;
        }
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
        let actor = this.getActorsOfType(VECTOR_ACTOR)[0];
        if (! actor) {
            return;
        }
        let vs = this.model.get('vector_scaling');
        let mapper = actor.getMapper();
        //rsUtils.rsdbg('bounds', mapper.getBounds());
        // use bounds
        mapper.setScaleFactor(8.0);
        if (vs === 'Uniform') {
            mapper.setScaleModeToScaleByConstant();
        }
        if (vs === 'Linear') {
            mapper.setScaleArray(LINEAR_SCALE_ARRAY);
            mapper.setScaleModeToScaleByComponents();
        }
        if (vs === 'Log') {
            mapper.setScaleArray(LOG_SCALE_ARRAY);
            mapper.setScaleModeToScaleByComponents();
        }
        this.fsRenderer.getRenderWindow().render();
    },


    setFieldIndicator: function(val, min, max) {
        let actor = this.getActorsOfType(VECTOR_ACTOR)[0];
        if (! actor) {
            return;
        }
        let w = $(this.el).find('.vector-field-color-map').width();
        let f = Math.abs(val / (max - min));
        let l = w * f;
        rsUtils.rsdbg('val', val, 'min/max', min, max, 'frac', f, 'el width', w, 'left', l);
        $(this.el).find('.vector-field-indicator').css('left', '25px');
        $(this.el).find('.vector-field-indicator-value').text(val);
    },

    setMarkerVisible: function() {
        this.orientationMarker.setEnabled(this.model.get('show_marker'));
        this.fsRenderer.getRenderWindow().render();
    },

    setPolyAlpha: function() {
        let alpha = this.model.get('poly_alpha');
        for (let name in this.actorInfo) {
            let info = this.getActorInfo(name);
            let s = info.scalars;
            if (! s) {
                info.actor.getProperty().setOpacity(alpha);
                continue;
            }
            let colors = s.getData();
            let nc = s.getNumberOfComponents();
            let i = 0;
            for (let j = 0; j < info.polyIndices.length && i < s.getNumberOfValues(); ++j) {
                colors[info.polyIndices[j] + 3] = Math.floor(255 * alpha);
                i += nc;
            }
            // required to get render() to show changes
            info.pData.modified();
        }
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

    handleMessage: function(msg, d) {
        rsUtils.rsdbg('msg', msg, 'data', d);
    },

    render: function() {
        // this is effectively "super.render()" - must invoke to get all children rendered properly
        controls.VBoxView.prototype.render.apply((this));
        this.listenTo(this.model, 'msg:custom', this.handleCustomMessages);
        //this.listenTo(this.model, 'all', this.handleMessage);

        // set dropdown contents and initial values
        //this.model.set('external_props', {
        //    field_color_maps: guiUtils.getColorMaps(),
        //    field_color_map_name: 'viridis',
        //    vector_scaling_types: ['Uniform', 'Linear', 'Log'],
        //    vector_scaling: 'Uniform',
        //});

        // required to get the python model in sync right away
        ///this.touch();

    }
});

module.exports = {
    ViewerModel: ViewerModel,
    ViewerView: ViewerView,
    VTKModel: VTKModel,
    VTKView: VTKView
};
