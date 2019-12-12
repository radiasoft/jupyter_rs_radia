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

const LINEAR_SCALE_ARRAY = 'linScale';
const LOG_SCALE_ARRAY = 'logScale';
const ORIENTATION_ARRAY = 'orientation';
const SCALAR_ARRAY = 'scalars';

const PICKABLE_TYPES = [vtkUtils.GEOM_TYPE_POLYS, vtkUtils.GEOM_TYPE_VECTS];

let template = [
    '<div class="vtk-widget" style="border-style: solid; border-color: #d9edf7; border-width: 1px;">',
        '<div class="viewer-title" style="font-weight: normal; text-align: center"></div>',
        '<div style="margin: 1em;">',
            '<div class="vtk-content"></div>',
        '</div>',
    '</div>',
].join('');

// these objects are used to set various vector properties
let vectInArrays = [{
    location: vtk.Common.DataModel.vtkDataSet.FieldDataTypes.COORDINATE,
}];

// to be set by parent widget
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
// to be set by parent widget
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

function typeForName(name) {
    for (let i = 0; i < vtkUtils.GEOM_TYPES.length; ++i) {
        if (name.startsWith(vtkUtils.GEOM_TYPES[i])) {
            return vtkUtils.GEOM_TYPES[i];
        }
    }
    return null;
}

function numColors(polyData, type) {
    if (vtkUtils.GEOM_OBJ_TYPES.indexOf(type) < 0) {
        return 0;
    }
    if (type === vtkUtils.GEOM_TYPE_LINES) {
        return numLineColors(polyData);
    }
    if (type === vtkUtils.GEOM_TYPE_POLYS) {
        return numPolyColors(polyData);
    }
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
    orientationMarker: null,
    ptPicker: null,
    selectedCell: -1,
    selectedColor: [],
    selectedObject: null,
    selectedPoint: -1,

    // stash the actor and associated info to avoid recalculation
    addActor: function(name, group, actor, type, pickable) {
        if (! this.fsRenderer) {
            // exception or message?
            //rsUtils.rslog('No renderer');
            //return;
            throw new Error('No renderer');
        }
        if (! actor.getMapper() || ! actor.getMapper().getInputData()) {
            throw new Error('Actor ' + name + ' has no mapper or data');
        }

        const pData = actor.getMapper().getInputData();

        const info = {
            actor: actor,
            colorIndices: [],
            group: group || 0,
            name: name,
            pData: pData,
            scalars: pData.getCellData().getScalars(),
            type: type,
        };

        if (info.scalars) {
            info.colorIndices = rsUtils.indexArray(numColors(pData, type))
                .map(function (i) {
                    return 4 * i;
                });
        }
        this.actorInfo[name] = info;

        //let s = this.model.get('actor_state');
        //s[name] = {
        //    color: info.scalars.getData().slice(0, 3),
        //};
        //this.model.set('actor_state', s);

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

    handleCustomMessages: function(msg) {
        //rsUtils.rsdbg('VTKView custom', msg);
        if (msg.type === 'axis') {
            this.setAxis(msg.axis, msg.dir);
        }

        if (msg.type === 'debug') {
            rsUtils.rsdbg(msg.msg);
        }

        if (msg.type === 'refresh') {
            rsUtils.rsdbg('got refresh message');
            this.refresh();
        }

        if (msg.type === 'reset') {
            this.resetView();
        }

    },

    loadActorState: function(name) {
        const s = this.model.get('actor_state')[name];
        if (! s) {
            return;
        }
        const info = this.getInfoForActor(this.getActor(name));
    },

    loadCam: function() {
        const cs = this.model.get('cam_state');
        rsUtils.rsdbg('loaded cam state', cs);
        if (! cs || $.isEmptyObject(cs)) {
            this.resetView();
            return;
        }
        this.setCam(cs.pos, cs.vu);
    },

    // override
    processPickedColor: function(c) {},

    // override
    processPickedVector: function(c, v) {},

    refresh: function(o) {

        rsUtils.rsdbg('vtk refresh');
        const view = this;

        this.selectedObject = null;
        if (! this.fsRenderer) {
            this.fsRenderer = vtk.Rendering.Misc.vtkFullScreenRenderWindow.newInstance({
                container: $(this.el).find('.vtk-content')[0],
            });
            // parent to supply?
            this.fsRenderer.getRenderWindow().getInteractor().onLeftButtonPress(function (callData) {
                let r = view.fsRenderer.getRenderer();
                if (r !== callData.pokedRenderer) {
                    return;
                }

                // ??
                if (! callData.controlKey) {
                    return;
                }

                const pos = callData.position;
                const point = [pos.x, pos.y, 0.0];
                view.ptPicker.pick(point, r);
                view.cPicker.pick(point, r);
                const pid = view.ptPicker.getPointId();

                // cell id is "closest cell within tolerance", meaning a single value, though
                // we may get multiple actors
                let cid = view.cPicker.getCellId();
                //rsUtils.rsdbg('Picked pt', point);
                rsUtils.rsdbg('Picked pt at', 'pid', pid);
                rsUtils.rsdbg('Picked cell at', 'cid', cid);

                // treat pickers separately rather than select one?
                let picker = cid >= 0 ? view.cPicker : (pid >= 0 ? view.ptPicker : null);
                if (cid < 0 && pid < 0) {
                    rsUtils.rsdbg('Pick failed');
                    return;
                }

                let pas = picker.getActors();
                //let posArr = view.cPicker.getPickedPositions();
                //rsUtils.rsdbg('pas', pas, 'positions', posArr);
                //TODO(mvk): need to get actor closest to the "screen" based on the selected points

                let selectedColor = [];
                let selectedValue = Number.NaN;
                let eligibleActors = [];
                for (let aIdx in pas) {
                    let actor = pas[aIdx];
                    //let pos = posArr[aIdx];
                    let info = view.getInfoForActor(actor);
                    //rsUtils.rsdbg('actor', actor, 'info', info);
                    if (! info || ! info.pData) {
                        continue;
                    }

                    let pts = info.pData.getPoints();

                    // TODO(mvk): attach pick functions to actor info?
                    if (info.type === vtkUtils.GEOM_TYPE_VECTS) {
                        let n = pts.getNumberOfComponents();
                        let coords = pts.getData().slice(n * pid, n * (pid + 1));
                        let f = actor.getMapper().getInputConnection(0).filter;
                        let linArr = f.getOutputData().getPointData().getArrayByName(LINEAR_SCALE_ARRAY);
                        if (! linArr) {
                            continue;
                        }
                        selectedValue = linArr.getData()[pid * linArr.getNumberOfComponents()];

                        let oArr = f.getOutputData().getPointData().getArrayByName(ORIENTATION_ARRAY);
                        const oid = pid * oArr.getNumberOfComponents();
                        const o = oArr.getData().slice(oid, oid + oArr.getNumberOfComponents());
                        let v = o.map(function (dir) {
                            return selectedValue * dir;
                        });

                        const sArr = f.getOutputData().getPointData().getArrayByName(SCALAR_ARRAY);
                        const ns = sArr.getNumberOfComponents();
                        const sid = pid * ns;
                        const sc = sArr.getData().slice(sid, sid + ns);

                        // toggle color?
                        if (view.selectedColor.length) {
                            const ssid = view.selectedPoint * ns;
                            sArr.getData()[ssid] = view.selectedColor[0];
                            sArr.getData()[ssid + 1] = view.selectedColor[1];
                            sArr.getData()[ssid + 2] = view.selectedColor[2];
                        }
                        if (pid === view.selectedPoint) {
                            view.selectedPoint = -1;
                            view.selectedColor = [];
                            selectedValue = Math.min.apply(null, linArr.getData());
                            v = [];
                        }
                        else {
                            sArr.getData()[sid] = 255;
                            sArr.getData()[sid + 1] = 0;
                            sArr.getData()[sid + 2] = 0;
                            view.selectedPoint = pid;
                            view.selectedColor = sc;
                        }
                        info.pData.modified();

                        rsUtils.rsdbg(info.name, 'coords', coords, 'mag', selectedValue, 'orientation', o, 'color', sc);
                        view.processPickedVector(coords, v);
                        continue;
                    }

                    let colors = info.scalars.getData();
                    //let j = info.polyIndices[cid];
                    let j = info.colorIndices[cid];
                    selectedColor = colors.slice(j, j + 3);  // 4 to get alpha
                    //rsUtils.rsdbg(info.name, 'poly tup', cid, selectedColor);

                    if (selectedColor.length > 0) {
                        if (actor === view.selectedObject) {
                            view.selectedObject = null;
                        }
                        else {
                            eligibleActors.push(actor);
                            view.selectedObject = actor;
                        }
                        break;
                    }
                }

                if (selectedColor.length === 0) {
                    view.selectedObject = null;
                    return;
                }

                // can't map, because we will still have a UINT8 array
                let sc = [];
                for (let cIdx = 0; cIdx < selectedColor.length; ++cIdx) {
                    sc.push(selectedColor[cIdx] / 255.0);
                }

                const highlight = selectedColor.map(function (c) {
                    return 255 - c;
                });

                let sch = vtk.Common.Core.vtkMath.floatRGB2HexCode(sc);
                view.model.set('selected_obj_color', view.selectedObject ? sch : '#ffffff');
                for (let name in view.actorInfo) {
                    let a = view.getActor(name);
                    view.setEdgeColor(a, view.sharesGroup(a, view.selectedObject) ? highlight : [0, 0, 0]);
                }
                view.processPickedColor(selectedColor);

            });

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

        // need point picker for vectors and cell picker for polys
        if (! this.ptPicker) {
            this.ptPicker = vtk.Rendering.Core.vtkPointPicker.newInstance();
            this.ptPicker.setPickFromList(true);
            this.ptPicker.initializePickList();
        }

        if (! this.cPicker) {
            this.cPicker = vtk.Rendering.Core.vtkCellPicker.newInstance();
            //this.cPicker.setTolerance(0);
            //this.cPicker.setTolerance(10.0);
            this.cPicker.setPickFromList(false);
            //this.cPicker.initializePickList();
        }

        let sceneData = this.model.get('model_data');
        if ($.isEmptyObject(sceneData)) {
            rsUtils.rslog('No data');
            this.fsRenderer.getRenderWindow().render();
            return;
        }

        let totalBounds = [
            Number.MAX_VALUE, -Number.MAX_VALUE,
            Number.MAX_VALUE, -Number.MAX_VALUE,
            Number.MAX_VALUE, -Number.MAX_VALUE
        ];

        // move to test method for the user to invoke
        const useTestObjects = false;
        if (useTestObjects) {
            this.addActor('CUBE', 'TEST', vtkUtils.getTestBox(), null, false);
            this.addActor('CYL', 'TEST', vtkUtils.getTestCylinder(), null, false);
            this.resetView();
            return;
        }

        const name = sceneData.name;
        let data = sceneData.data;
        rsUtils.rsdbg('got data', data, 'for', name);
        for (let i = 0; i < data.length; ++i) {

            const sceneDatum = data[i];
            const bounds = vtkUtils.objBounds(sceneDatum);

            // trying a separation into an actor for each data type, to better facilitate selection
            vtkUtils.GEOM_TYPES.forEach(function (t) {
                const d = sceneDatum[t];
                if (! d || ! d.vertices || ! d.vertices.length) {
                    return;
                }
                const isPoly = t === vtkUtils.GEOM_TYPE_POLYS;
                const pdti = vtkUtils.objToPolyData(sceneDatum, [t]);
                const pData = pdti.data;
                let mapper = null;
                const actor = vtk.Rendering.Core.vtkActor.newInstance();
                if (vtkUtils.GEOM_OBJ_TYPES.indexOf(t) >= 0) {
                    mapper = vtk.Rendering.Core.vtkMapper.newInstance({
                        static: true
                    });
                    mapper.setInputData(pData);
                }
                else {
                    let vectorCalc = vtk.Filters.General.vtkCalculator.newInstance();
                    vectorCalc.setFormula(getVectFormula(d, view.model.get('vector_color_map_name')));
                    vectorCalc.setInputData(pData);

                    mapper = vtk.Rendering.Core.vtkGlyph3DMapper.newInstance();
                    mapper.setInputConnection(vectorCalc.getOutputPort(), 0);

                    let s = vtk.Filters.Sources.vtkArrowSource.newInstance();
                    mapper.setInputConnection(s.getOutputPort(), 1);
                    mapper.setOrientationArray(ORIENTATION_ARRAY);

                    // this scales by a constant - the default is to use scalar data
                    //TODO(mvk): set based on bounds size
                    mapper.setScaleFactor(8.0);
                    mapper.setScaleModeToScaleByConstant();
                    mapper.setColorModeToDefault();
                }
                actor.setMapper(mapper);
                actor.getProperty().setEdgeVisibility(isPoly);
                actor.getProperty().setLighting(isPoly);
                const gname = name + '.' + i;
                const aname = gname + '.' + t;
                view.addActor(aname, gname, actor, t, PICKABLE_TYPES.indexOf(t) >= 0);
            });

            for(let j = 0; j < 3; ++j) {
                let k = 2 * j;
                totalBounds[k] = Math.min(totalBounds[k], bounds[k]);
                totalBounds[k + 1] = Math.max(totalBounds[k + 1], bounds[k + 1]);
            }
        }
        //this.resetView();
        this.setBgColor();
        this.setEdgesVisible();
        this.setPolyAlpha();
        this.loadCam();
        //rsUtils.rsdbg('vtk serialize?', this.model.serialize(this.model));
    },

    removeActors: function() {
        const view = this;
        let r = this.fsRenderer.getRenderer();
        r.getActors().forEach(function(a) {
            r.removeActor(a);
            view.ptPicker.deletePickList(a);
            view.cPicker.deletePickList(a);
        });
        this.actorInfo = {};
    },

    render: function() {
        rsUtils.rsdbg('vtk render');
        this.model.on('change:bg_color', this.setBgColor, this);
        this.model.on('change:selected_obj_color', this.setSelectedObjColor, this);
        this.model.on('change:poly_alpha', this.setPolyAlpha, this);
        this.model.on('change:show_marker', this.setMarkerVisible, this);
        this.model.on('change:show_edges', this.setEdgesVisible, this);
        this.model.on('change:title', this.refresh, this);
        this.model.on('change:vector_color_map_name', this.setVectorColorMap, this);
        $(this.el).append($(template));
        this.setTitle();
        this.listenTo(this.model, 'msg:custom', this.handleCustomMessages);
    },

    resetView: function() {
        this.setCam([1, -0.4, 0], [0, 0, 1]);
    },

    // may have to get axis orientation from data?
    setAxis: function(axis, dir) {
        let camPos = axis === 'X' ? [dir, 0, 0] : (axis === 'Y' ? [0, dir, 0] : [0, 0, dir] );
        let camViewUp = axis === 'Z' ? [0, 1, 0] : [0, 0, 1];
        this.setCam(camPos, camViewUp);
    },

    setBgColor: function() {
        if (! this.fsRenderer) {
            return;
        }
        this.fsRenderer.setBackground(vtk.Common.Core.vtkMath.hex2float(this.model.get('bg_color')));
        this.fsRenderer.getRenderWindow().render();
    },

    setCam: function(pos, vu) {
        if (! this.fsRenderer) {
            return;
        }
        let r = this.fsRenderer.getRenderer();
        let cam = r.get().activeCamera;
        cam.setPosition(pos[0], pos[1], pos[2]);
        cam.setFocalPoint(0, 0, 0);
        cam.setViewUp(vu[0], vu[1], vu[2]);
        this.model.set('cam_state', {
            pos: cam.getPosition(),
            vu: cam.getViewUp()
        });
        r.resetCamera();
        this.orientationMarker.updateMarkerOrientation();
        this.fsRenderer.getRenderWindow().render();
    },

    setColor: function(info, type, color, alpha=255) {
        const s = info.scalars;
        if (! s) {
            return;
        }
        const colors = s.getData();
        const nc = s.getNumberOfComponents();
        if (type !== info.type) {
            return;
        }
        let i = 0;
        const inds = info.colorIndices || [];
        for (let j = 0; j < inds.length && i < s.getNumberOfValues(); ++j) {
            if (color) {
                for (let k = 0; k < nc - 1; ++k) {
                    colors[inds[j] + k] = color[k];
                }
            }
            colors[inds[j] + nc - 1] = alpha;
            i += nc;
        }
        info.pData.modified();
    },

    setData: function(d) {
        rsUtils.rsdbg('vtk setting data');
        this.model.set('model_data', d);
        this.refresh();
    },

    setEdgeColor: function(actor, color) {
        if (! actor ) {
            return;
        }
        if (! this.fsRenderer) {
            return;
        }
        let info = this.getInfoForActor(actor);
        rsUtils.rsdbg('setEdgeColor', info.name);
        actor.getProperty().setEdgeColor(color[0], color[1], color[2]);
        this.setColor(info, vtkUtils.GEOM_TYPE_LINES, color);
        //this.fsRenderer.getRenderWindow().render();
    },

    setEdgesVisible: function() {
        if (! this.fsRenderer) {
            return;
        }
        let doShow = this.model.get('show_edges');
        for (let name in this.actorInfo) {
            let info = this.getActorInfo(name);
            // small arrows just turn black when edges are on
            if (info.type === vtkUtils.GEOM_TYPE_VECTS) {
                continue;
            }
            this.getActor(name).getProperty().setEdgeVisibility(doShow);
            this.setColor(info, vtkUtils.GEOM_TYPE_LINES, null, 255 * doShow);
        }
        this.fsRenderer.getRenderWindow().render();
    },

    setMarkerVisible: function() {
        if (! this.fsRenderer) {
            return;
        }
        this.orientationMarker.setEnabled(this.model.get('show_marker'));
        this.fsRenderer.getRenderWindow().render();
    },

    setPolyAlpha: function() {
        if (! this.fsRenderer) {
            return;
        }
        let alpha = this.model.get('poly_alpha');
        for (let name in this.actorInfo) {
            let info = this.getActorInfo(name);
            let s = info.scalars;
            if (! s) {
                info.actor.getProperty().setOpacity(alpha);
                continue;
            }
            this.setColor(info, vtkUtils.GEOM_TYPE_POLYS, null, Math.floor(255 * alpha));
        }
        this.fsRenderer.getRenderWindow().render();
    },

    // need to allow setting color for entire actor, single poly, or 3d cell
    setSelectedObjColor: function() {
        if (! this.fsRenderer) {
            return;
        }
        if (! this.selectedObject) {
            return;
        }
        let info = this.getInfoForActor(this.selectedObject);
        rsUtils.rsdbg('setSelectedObjColor', info.name);
        let newColor = vtk.Common.Core.vtkMath.hex2float(this.model.get('selected_obj_color'));
        if (! info.scalars) {
            this.selectedObject.getProperty().setColor(newColor[0], newColor[1], newColor[2]);
            return;
        }
        let nc = [];
        newColor.forEach(function (f) {
            nc.push(Math.floor(255 * f));
        });
        this.setColor(info, vtkUtils.GEOM_TYPE_POLYS, nc);
        this.fsRenderer.getRenderWindow().render();
    },

    setTitle: function() {
        $(this.el).find('.viewer-title').text(this.model.get('title'));
    },

    setVectorColorMap: function() {
        if (! this.fsRenderer) {
            return;
        }
        const actor = this.getActorsOfType(vtkUtils.GEOM_TYPE_VECTS)[0];
        if (! actor) {
            //rsUtils.rslog('vtk setVectorColorMap: No vector actor');
            return;
        }
        const mapName = this.model.get('vector_color_map_name');
        if (! mapName) {
            //rsUtils.rslog('vtk setVectorColorMap: No color map');
            return;
        }
        actor.getMapper().getInputConnection(0).filter
            .setFormula(getVectFormula(this.model.get('model_data').data[0].vectors, mapName));
        this.fsRenderer.getRenderWindow().render();
    },

    setVectorScaling: function(vs) {
        if (! this.fsRenderer) {
            return;
        }
        const actor = this.getActorsOfType(vtkUtils.GEOM_TYPE_VECTS)[0];
        if (! actor) {
            return;
        }
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

    select: function(selector) {
        return $(this.el).find(selector);
    },

    sharesGroup: function(actor1, actor2) {
        if (! actor1 || ! actor2) {
            return false;
        }
        return this.getInfoForActor(actor1).group === this.getInfoForActor(actor2).group;
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
        rsUtils.rsdbg('viewer render');
        // this is effectively "super.render()" - must invoke to get all children rendered properly
        controls.VBoxView.prototype.render.apply((this));
        this.listenTo(this.model, 'msg:custom', this.handleCustomMessages);
        //this.listenTo(this.model, 'all', this.handleMessage);
    }
});

module.exports = {
    ViewerModel: ViewerModel,
    ViewerView: ViewerView,
    VTKModel: VTKModel,
    VTKView: VTKView
};
