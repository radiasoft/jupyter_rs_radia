let _ = require('lodash');
let $ = require('jquery');
require('vtk.js');
let widgets = require('@jupyter-widgets/base');

let srdbg = console.log.bind(console);
let srlog = console.log.bind(console);

var template = [
    '<div style="border-style: solid; border-color: blue;">',
        '<div style="font-weight: bold; text-align: center">VIEW VTK</div>',
        '<div style="margin: 1em;">',
            '<div class="vtk-content"></div>',
        '</div>',
    '</div>'
].join('');


function indexArray(size) {
    var res = [];
    for (var i = 0; i < size; i++) {
      res.push(i);
    }
    return res;
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
        //_model_name : 'VTKContentModel',
        //_view_name : 'VTKContentView',
        _model_module : 'jupyter-rs-vtk-widget',
        _view_module : 'jupyter-rs-vtk-widget',
        _model_module_version : '0.0.1',
        _view_module_version : '0.0.1',
        model_data: {},
    })
});



// Custom View. Renders the widget model.
var VTKView = widgets.DOMWidgetView.extend({

    fsRenderer: null,
    isLoaded: false,

    refresh: function(o) {

        srdbg('REFRESH');
        if (! this.fsRenderer) {
            this.fsRenderer = vtk.Rendering.Misc.vtkFullScreenRenderWindow.newInstance({
                background: [1, 0.97647, 0.929412],
                container: $('.vtk-content')[0],
            });
        }

        this.removeActors();
        let sceneData = this.model.get('model_data');
        if ($.isEmptyObject(sceneData)) {
            srlog('No data');
            return;
        }

        let colors = [];
        for (var i = 0; i < sceneData.lines.colors.length; i++) {
          colors.push(Math.floor(255 * sceneData.lines.colors[i]));
        }
        for (var i = 0; i < sceneData.polygons.colors.length; i++) {
          colors.push(Math.floor(255 * sceneData.polygons.colors[i]));
        }

        var polys = [];
        var polyIdx = 0;
        var polyInds = indexArray(sceneData.polygons.vertices.length / 3);
        for (var i = 0; i < sceneData.polygons.lengths.length; i++) {
            var len = sceneData.polygons.lengths[i];
            polys.push(len);
            for (var j = 0; j < len; j++) {
                polys.push(polyInds[polyIdx]);
                polyIdx++;
            }
        }
        polys = new window.Uint32Array(polys);

        let points = sceneData.polygons.vertices;
        var lineVertOffset = points.length / 3;
        for (var i = 0; i < sceneData.lines.vertices.length; i++) {
            points.push(sceneData.lines.vertices[i]);
        }
        var lines = [];
        var lineIdx = 0;
        var lineInds = indexArray(sceneData.lines.vertices.length / 3);
        for (var i = 0; i < sceneData.lines.lengths.length; i++) {
            var len = sceneData.lines.lengths[i];
            lines.push(len);
            for (var j = 0; j < len; j++) {
                lines.push(lineInds[lineIdx] + lineVertOffset);
                lineIdx++;
            }
        }
        lines = new window.Uint32Array(lines);
        points = new window.Float32Array(points);

        var pd = vtk.Common.DataModel.vtkPolyData.newInstance();
        pd.getPoints().setData(points, 3);
        pd.getLines().setData(lines);
        pd.getPolys().setData(polys);

        pd.getCellData().setScalars(vtk.Common.Core.vtkDataArray.newInstance({
          numberOfComponents: 3,
          values: colors,
          dataType: vtk.Common.Core.vtkDataArray.VtkDataTypes.UNSIGNED_CHAR
        }));

        var mapper = vtk.Rendering.Core.vtkMapper.newInstance();
        var actor = vtk.Rendering.Core.vtkActor.newInstance();
        mapper.setInputData(pd);
        actor.setMapper(mapper);

        actor.getProperty().setEdgeVisibility(true);
        this.fsRenderer.getRenderer().addActor(actor);
        this.resetView();
        /*
        var renderer = this.fsRenderer.getRenderer();
        var cam = renderer.get().activeCamera;
        cam.setPosition(1, -0.4, 0);
        cam.setFocalPoint(0, 0, 0);
        cam.setViewUp(0, 0, 1);
        renderer.resetCamera();
        cam.zoom(1.3);
         */
        this.fsRenderer.getRenderWindow().render();
    },

    removeActors: function() {
        let r = this.fsRenderer.getRenderer();
        r.getActors().forEach(function(actor) {
            r.removeActor(actor);
        });
    },

    render: function() {
        srdbg('RENDER');
        this.model.on('change:model_data', this.refresh, this);
        if (! this.isLoaded) {
            $(this.el).append($(template));
            this.isLoaded = true;
        }
    },

    resetView: function() {
        let r = this.fsRenderer.getRenderer();
        let cam = r.get().activeCamera;
        cam.setPosition(1, -0.4, 0);
        cam.setFocalPoint(0, 0, 0);
        cam.setViewUp(0, 0, 1);
        r.resetCamera();
        cam.zoom(1.3);
    }

});

var ViewerModel = widgets.DOMWidgetModel.extend({
    //defaults: _.extend(widgets.DOMWidgetModel.prototype.defaults(), {
    //    model_data: {}
    //})
    defaults: _.extend(widgets.DOMWidgetModel.prototype.defaults(), {
        _model_name: 'ViewerModel',
        _view_name: 'ViewerView',
        _model_module: 'jupyter-rs-vtk-widget',
        _view_module: 'jupyter-rs-vtk-widget',
        _model_module_version: '0.0.1',
        _view_module_version: '0.0.1',
        //content: {},
        model_data: {},
    }),
}, {});

var ViewerView = widgets.DOMWidgetView.extend({
    render: function() {
        var c = this.model.get('content');
        var rb = this.model.get('reset_button');
        srdbg('Viewer render content', c, 'eb', rb);
        //this.model.get('content').render();
        //this.model.on('change:model_data', this.update, this);
    },

    update: function () {
        this.model.get('content').model_data = this.model.get('model_data');
    }
});

module.exports = {
    ViewerModel: ViewerModel,
    ViewerView: ViewerView,
    VTKModel: VTKModel,
    VTKView: VTKView
};
