import ipywidgets as widgets
import traitlets

from traitlets import Any, Bool, Float, Dict, Instance, List, Unicode

# helper functions
# send a message to the front end to print to js console
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

    bg_color = widgets.Color('#ffffff').tag(sync=True)
    model_data = Dict(default_value={}).tag(sync=True)
    poly_alpha = Float(1.0).tag(sync=True)
    show_edges = Bool(True).tag(sync=True)
    show_marker = Bool(True).tag(sync=True)
    title = Unicode('').tag(sync=True)

    def set_title(self, t):
        self.title = t

    @traitlets.default('layout')
    def _default_layout(self):
        return widgets.Layout(
            width='50%',
            min_width='25%',
            margin='auto'
        )

    def _vtk_displayed(self, o):
        #rsdebug(self, 'VTK ready')
        #self.send({'type': 'refresh'})
        pass

    def __init__(self, title='', bg_color='#ffffff', data=None, inset=False):
        self.model_data = {} if data is None else data
        self.title = title
        self.bg_color = bg_color
        self.on_displayed(self._vtk_displayed)
        super(VTK, self).__init__()
        if inset:
            self.layout = widgets.Layout(
                width='10%'
            )
            self.show_marker = False
            self.poly_alpha = 0.25
            self.show_edges = True


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
    # "into the screen", "out of the screen"
    _dirs = [u'\u2299', u'\u29bb']

    def set_data(self, data):
        # keep a local reference to the data for handlers
        self.model_data = data
        self.content.model_data = data

    @traitlets.default('layout')
    def _default_layout(self):
        return widgets.Layout(align_self='stretch')

    def _handle_change(self, change):
        rsdebug('{}'.format(change))

    # send message to content to reset camera to default position
    def _reset_view(self, b):
        # this turns into an event of type "msg:custom" with the dict attached
        # in the view add this.listenTo(this.model, "msg:custom", <handler>)
        for axis in Viewer._axes:
            self.axis_btns[axis]['dir'] = 1
            self._set_axis_btn_desc(axis)

        self.content.send({'type': 'reset'})

    # send message to vtk widget to rotate scene with the given axis pointing in or out
    # of the screen
    def _set_axis(self, b):
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

    def _viewer_displayed(self, o):
        # if we have data, this will trigger the refresh on the front end
        # but we need the widget to be ready first
        self.content.model_data = self.model_data
        pass

    def __init__(self, data=None):
        if data is None:
            data = {}
        self.model_data = data

        # don't initialize VTK with data - save until the view is ready
        self.content = VTK()

        self.reset_btn = widgets.Button(description='Reset Camera')
        self.reset_btn.on_click(self._reset_view)

        self.axis_btns = {}
        for axis in Viewer._axes:
            self.axis_btns[axis] = {
                'button': widgets.Button(),
                'dir': 1
            }
            self._set_axis_btn_desc(axis)
            self.axis_btns[axis]['button'].on_click(self._set_axis)

        self.orientation_toggle = widgets.Checkbox(value=True, description='Show marker')
        self.edge_toggle = widgets.Checkbox(value=True, description='Show edges')

        axis_btn_grp = widgets.HBox(
            [self.axis_btns[a]['button'] for a in self.axis_btns],
            layout={
                'justify-content': 'flex-end'
            }
        )

        self.bg_color_pick = widgets.ColorPicker(
            concise=True,
            value=self.content.bg_color
        )
        # separate label to avoid text truncation
        color_pick_grp = widgets.HBox(
            [widgets.Label('Background color'), self.bg_color_pick]
        )

        self.poly_alpha_slider = widgets.FloatSlider(
            description='Alpha', min=0.0, max=1.0, step=0.05,
            value=self.content.poly_alpha
        )

        view_props_grp = widgets.HBox(
            [color_pick_grp, self.poly_alpha_slider, self.edge_toggle]
        )

        # links the values of two widgets
        widgets.jslink(
            (self.bg_color_pick, 'value'),
            (self.content, 'bg_color')
        )
        widgets.jslink(
            (self.edge_toggle, 'value'),
            (self.content, 'show_edges')
        )
        widgets.jslink(
            (self.orientation_toggle, 'value'),
            (self.content, 'show_marker')
        )
        widgets.jslink(
            (self.poly_alpha_slider, 'value'),
            (self.content, 'poly_alpha')
        )

        view_cam_grp = widgets.HBox(
            [self.reset_btn, axis_btn_grp, self.orientation_toggle],
            layout=widgets.Layout(
                padding='6px'
            ))

        self.on_displayed(self._viewer_displayed)
        super(Viewer, self).__init__(children=[
            self.content, view_cam_grp, view_props_grp
        ])

