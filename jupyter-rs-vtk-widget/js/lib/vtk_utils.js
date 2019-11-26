let _ = require('lodash');
let $ = require('jquery');
require('vtk.js');

let rsUtils = require('./rs_utils');

const GL_TYPES = ['lines', 'polygons', 'vectors'];
const TYPE_LINE =  Math.pow(2, GL_TYPES.indexOf('lines'));  // 2;
const TYPE_POLY = Math.pow(2, GL_TYPES.indexOf('polygons'));  //1;
const TYPE_VECT = Math.pow(2, GL_TYPES.indexOf('vectors'));  //4;

function pickPoint(customFn) {


    customFn();
}

function getTestBox() {
    let s = vtk.Filters.Sources.vtkCubeSource.newInstance({
        xLength: 20, yLength: 20, zLength: 20,
        center: [0, 0, 0],
    });
    let m = vtk.Rendering.Core.vtkMapper.newInstance({
        static: true,
    });
    m.setInputConnection(s.getOutputPort());
    let a = vtk.Rendering.Core.vtkActor.newInstance({
        mapper: m,
    });
    a.getProperty().setColor(0, 1, 0);
    a.getProperty().setEdgeVisibility(true);
    return a;
}

function getTestCylinder() {
    let s = vtk.Filters.Sources.vtkCylinderSource.newInstance({
        radius: 5, height: 30, center: [20, 0, 0]
    });
    let m = vtk.Rendering.Core.vtkMapper.newInstance({
        static: true,
    });
    m.setInputConnection(s.getOutputPort());
    let a = vtk.Rendering.Core.vtkActor.newInstance({
        mapper: m
    });
    a.getProperty().setColor(1, 0, 0);
    a.getProperty().setEdgeVisibility(true);
    return a;
}

function objBounds(json) {

    let mins = [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE];
    let maxs = [-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE];

    GL_TYPES.forEach(function (type) {
        if (! json[type]) {
            return;
        }
        let pts = json[type].vertices;
        for (let j = 0; j < 3; ++j) {
            let c = pts.filter(function (p, i) {
                return i % 3 === j;
            });
            mins[j] =  Math.min(mins[j], Math.min.apply(null, c));
            maxs[j] =  Math.max(maxs[j], Math.max.apply(null, c));
        }
    });

    return [mins[0], maxs[0], mins[1], maxs[1], mins[2], maxs[2]];
}

function objToPolyData(json, typeMask, addNormals) {
    let colors = [];
    let points = [];
    let tData = {};

    if (! typeMask) {
        typeMask = TYPE_LINE + TYPE_POLY + TYPE_VECT;
    }

    GL_TYPES.forEach(function (type, tIdx) {
        if (!(Math.pow(2, tIdx) & typeMask)) {
            rsUtils.rsdbg('ignoring data for type', type);
            return;
        }

        let t = json[type];
        if (! t || json[type].vertices.length === 0) {
            rsUtils.rsdbg('No data for requested type', type);
            return;
        }

        // may not always be colors in the data
        let c = t.colors || [];
        for (let i = 0; i < c.length; i++) {
            colors.push(Math.floor(255 * c[i]));
            if (i % 3 === 2) {
                colors.push(255);
            }
        }

        let tArr = [];
        let tOffset = points.length / 3;
        for (let i = 0; i < t.vertices.length; i++) {
            points.push(t.vertices[i]);
        }
        let tInd = 0;
        let tInds = rsUtils.indexArray(t.vertices.length / 3);
        for (let i = 0; i < t.lengths.length; i++) {
            let len = t.lengths[i];
            tArr.push(len);
            for (let j = 0; j < len; j++) {
                tArr.push(tInds[tInd++] + tOffset);
            }
        }
        if (tArr.length) {
            tData[type] = new window.Uint32Array(tArr);
        }

    });

    points = new window.Float32Array(points);

    let pd = vtk.Common.DataModel.vtkPolyData.newInstance();
    pd.getPoints().setData(points, 3);

    //rsUtils.rsdbg('setting polydata from', tData);
    if (tData.lines) {
        pd.getLines().setData(tData.lines);
    }
    if (tData.polygons) {
        pd.getPolys().setData(tData.polygons, 1);
    }

    pd.getCellData().setScalars(vtk.Common.Core.vtkDataArray.newInstance({
        numberOfComponents: 4,
        values: colors,
        dataType: vtk.Common.Core.vtkDataArray.VtkDataTypes.UNSIGNED_CHAR
    }));

    pd.buildCells();

    return pd;
}

function vectorsToPolyData(json) {
    let points = new window.Float32Array(json.vectors.vertices);
    let pd = vtk.Common.DataModel.vtkPolyData.newInstance();
    pd.getPoints().setData(points, 3);
    return pd;
}

module.exports = {
    getTestBox: getTestBox,
    getTestCylinder: getTestCylinder,
    objBounds: objBounds,
    objToPolyData: objToPolyData,
    TYPE_LINE: TYPE_LINE,
    TYPE_POLY: TYPE_POLY,
    TYPE_VECT: TYPE_VECT,
};
