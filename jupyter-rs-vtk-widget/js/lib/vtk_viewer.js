var _ = require('lodash');
var $ = require('jquery');
require('vtk.js');
var widgets = require('@jupyter-widgets/base');


var fsRenderer;

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

function removeActors() {
    var renderer = fsRenderer.getRenderer();
    renderer.getActors().forEach(function(actor) {
      renderer.removeActor(actor);
    });
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
        model_data: {}
    })
});


// Custom View. Renders the widget model.
var VTKView = widgets.DOMWidgetView.extend({

    load: function(url) {
        var widget = this;
        $.ajax({
            url: url,
            context: widget.el,
            success: function (res, status, xhr) {
                console.log('LOADED VIEWER HTML FROM', url, 'STATUS', status, 'DATA', res, 'INTO', widget.el);
                widget.addNode($(res));
            },
            error: function (xhr, status, err) {
                console.error('FAILED TO LOAD', url, err, status);
            },
            method: 'GET'
        });
    },

    refresh: function(o) {

        if (! fsRenderer) {
            fsRenderer = vtk.Rendering.Misc.vtkFullScreenRenderWindow.newInstance({
                background: [1, 0.97647, 0.929412],
                container: $('.vtk-content')[0],
            });
        }

        removeActors();
        let sceneData = this.model.get('model_data');
        //console.log('CALLING REFRESH', sceneData);
        if ($.isEmptyObject(sceneData)) {
            console.warn('NO DATA');
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

        //if (wantEdges) {
          actor.getProperty().setEdgeVisibility(true);
        //}
        fsRenderer.getRenderer().addActor(actor);
        var renderer = fsRenderer.getRenderer();
        var cam = renderer.get().activeCamera;
        cam.setPosition(1, -0.4, 0);
        cam.setFocalPoint(0, 0, 0);
        cam.setViewUp(0, 0, 1);
        renderer.resetCamera();
        cam.zoom(1.3);
        fsRenderer.getRenderWindow().render();

        console.log('sze', $(this.el).width(), $(this.el).height(), 'layout', this.layout);
    },

    render: function() {
        console.log('CALLING RENDER');
        this.model.on('change:model_data', this.data_changed, this);
        $(this.el).append($(template));
        console.log('DONE RENDER');
    },

    data_changed: function(o) {
        //console.log('data_changed');
        this.refresh(o);
    }

});


module.exports = {
    VTKModel : VTKModel,
    VTKView : VTKView
};
