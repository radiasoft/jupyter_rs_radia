let _ = require('lodash');
let $ = require('jquery');
require('vtk.js');
let widgets = require('@jupyter-widgets/base');
let controls = require('@jupyter-widgets/controls');

let rsdbg = console.log.bind(console);
let rslog = console.log.bind(console);

var template = [
    '<div style="border-style: solid; border-color: blue; border-width: 1px;">',
        '<div style="font-weight: normal; text-align: center">Radia viewer</div>',
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
        _model_module : 'jupyter-rs-vtk-widget',
        _view_module : 'jupyter-rs-vtk-widget',
        _model_module_version : '0.0.1',
        _view_module_version : '0.0.1',
    })
});


// Custom View. Renders the widget model.
var VTKView = widgets.DOMWidgetView.extend({

    fsRenderer: null,
    isLoaded: false,

    handleCustomMessages: function(msg) {
        if (msg.type === 'debug') {
            rsdbg(msg.msg);
        }

        if (msg.type === 'reset') {
            this.resetView();
        }

        if (msg.type == 'axis') {
            this.setAxis(msg.axis, msg.dir);
        }
    },

    refresh: function(o) {

        if (! this.fsRenderer) {
            this.fsRenderer = vtk.Rendering.Misc.vtkFullScreenRenderWindow.newInstance({
                background: [1, 0.97647, 0.929412],
                container: $('.vtk-content')[0],
            });
        }

        this.removeActors();
        let sceneData = this.model.get('model_data');
        if ($.isEmptyObject(sceneData)) {
            rslog('No data');
            this.fsRenderer.getRenderWindow().render();
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
    },

    removeActors: function() {
        let r = this.fsRenderer.getRenderer();
        r.getActors().forEach(function(actor) {
            r.removeActor(actor);
        });
    },

    render: function() {
        this.model.on('change:model_data', this.refresh, this);
        if (! this.isLoaded) {
            $(this.el).append($(template));
            this.isLoaded = true;
            this.listenTo(this.model, "msg:custom", this.handleCustomMessages);
        }
    },

    resetView: function() {
        this.setCam([1, -0.4, 0], [0, 0, 1]);
    },

    // may have to get axis orientation from data?
    setAxis: function (axis, dir) {
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
        this.fsRenderer.getRenderWindow().render();
    }

});

var ViewerModel = controls.VBoxModel.extend({

    defaults: _.extend(controls.VBoxModel.prototype.defaults(), {
        _model_name: 'ViewerModel',
        _view_name: 'ViewerView',
        _model_module: 'jupyter-rs-vtk-widget',
        _view_module: 'jupyter-rs-vtk-widget',
        _model_module_version: '0.0.1',
        _view_module_version: '0.0.1',
        content: {},
        model_data: {},
        reset_button: controls.ButtonModel
    }),
}, {});

var ViewerView = controls.VBoxView.extend({

    handleCustomMessages: function(msg) {
        if (msg.type === 'debug') {
            rsdbg(msg.msg);
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
