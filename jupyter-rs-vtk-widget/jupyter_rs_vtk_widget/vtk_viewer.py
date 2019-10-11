import ipywidgets as widgets
import traitlets

from traitlets import Any, Dict, Instance, List, Unicode


# helper functions
def rsdebug(widget, msg):
    widget.send({
        'type': 'debug',
        'msg': 'KERNEL: ' + msg
    })


@widgets.register
class VTK(widgets.DOMWidget):
    """VTK content"""
    _view_name = Unicode('VTKView').tag(sync=True)
    _model_name = Unicode('VTKModel').tag(sync=True)
    _view_module = Unicode('jupyter-rs-vtk-widget').tag(sync=True)
    _model_module = Unicode('jupyter-rs-vtk-widget').tag(sync=True)
    _view_module_version = Unicode('^0.0.1').tag(sync=True)
    _model_module_version = Unicode('^0.0.1').tag(sync=True)
    model_data = Dict({}).tag(sync=True)

    # might want traitlets for bare vtk views
    #@traitlets.default('layout')
    #def _default_layout(self):
    #    return widgets.Layout(align_self='stretch')

    def _vtk_displayed(self, o):
        #rsdebug(self, 'VTK ready')
        pass

    def __init__(self, data={}):
        self.model_data = data
        self.on_displayed(self._vtk_displayed)
        super(VTK, self).__init__()


# Note we need to subclass VBox in the javascript as well
@widgets.register
class Viewer(widgets.VBox):
    """VTK viewer - includes controls to manipulate the objects"""
    _model_name = Unicode('ViewerModel').tag(sync=True)
    _view_name = Unicode('ViewerView').tag(sync=True)
    _model_module = Unicode('jupyter-rs-vtk-widget').tag(sync=True)
    _view_module = Unicode('jupyter-rs-vtk-widget').tag(sync=True)
    _model_module_version = Unicode('^0.0.1').tag(sync=True)
    _view_module_version = Unicode('^0.0.1').tag(sync=True)

    _axes = ['X', 'Y', 'Z']
    _dirs = [u'\u2299', u'\u29bb']

    @traitlets.default('layout')
    def _default_layout(self):
        return widgets.Layout(align_self='stretch')

    # send message to content to reset camera to default position
    def _reset_view(self, b):
        # this turns into an event of type "msg:custom" with the dict attached
        # in the view add this.listenTo(this.model, "msg:custom", <handler>)
        for axis in Viewer._axes:
            self.axis_btns[axis]['dir'] = 1
            self._set_axis_btn_desc(axis)

        self.content.send({'type': 'reset'})

    # send a message to the front end to print to js console
    def _rsdebug(self, msg):
        self.send({
            'type': 'debug',
            'msg': 'KERNEL: ' + msg
        })

    # send message to vtk widget to rotate scene with the given axis pointing in or out
    # of the screen
    def _set_axis(self, b):
        # rsdebug(self, 'b {}'.format(b))

        a = b.description[0]
        d = 1 - 2 * Viewer._dirs.index(b.description[1])
        self.content.send({
            'type': 'axis',
            'axis': a,
            'dir': d
        })
        self.axis_btns[a]['dir'] = -1 * d
        self._set_axis_btn_desc(a)

    def _set_axis_btn_desc(self, axis):
        d = self.axis_btns[axis]['dir']
        self.axis_btns[axis]['button'].description = axis + Viewer._dirs[int((1 - d) / 2)]

    def set_data(self, data):
        # keep a local reference to the data for handlers
        self.model_data = data
        self.content.model_data = data

    def _viewer_displayed(self, o):
        # if we have data, this will trigger the refresh on the front end
        # but we need the widget to be ready first
        self.content.model_data = self.model_data

    def __init__(self, data={}):
        self.model_data = data

        # don't initialize VTK with data - save until the view is ready
        self.content = VTK()

        self.reset_btn = widgets.Button(description='Reset Position')
        self.reset_btn.on_click(self._reset_view)

        self.axis_btns = {}
        for axis in Viewer._axes:
            self.axis_btns[axis] = {
                'button': widgets.Button(),
                'dir': 1
            }
            self._set_axis_btn_desc(axis)
            self.axis_btns[axis]['button'].on_click(self._set_axis)

        axis_btn_grp = widgets.HBox(
            [self.axis_btns[a]['button'] for a in self.axis_btns],
            layout={'justify-content': 'flex-end'}
        )
        btn_grp = widgets.HBox([self.reset_btn, axis_btn_grp])

        self.on_displayed(self._viewer_displayed)
        super(Viewer, self).__init__(children=[self.content, btn_grp])

