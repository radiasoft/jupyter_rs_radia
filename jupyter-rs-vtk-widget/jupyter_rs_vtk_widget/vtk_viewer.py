from __future__ import absolute_import, division, print_function

import ipywidgets as widgets
import traitlets

from jupyter_rs_vtk_widget import gui_utils
from jupyter_rs_vtk_widget import rs_utils
from jupyter_rs_vtk_widget import vtk_utils
from traitlets import Any, Bool, Dict, Float, Instance, Integer, List, Unicode


@widgets.register
class VTK(widgets.DOMWidget, rs_utils.RSDebugger):
    """VTK content"""
    _view_name = Unicode('VTKView').tag(sync=True)
    _model_name = Unicode('VTKModel').tag(sync=True)
    _view_module = Unicode('jupyter-rs-vtk-widget').tag(sync=True)
    _model_module = Unicode('jupyter-rs-vtk-widget').tag(sync=True)
    _view_module_version = Unicode('^0.0.1').tag(sync=True)
    _model_module_version = Unicode('^0.0.1').tag(sync=True)

    # marking fields that should move to radia
    bg_color = widgets.Color('#ffffff').tag(sync=True)
    selected_obj_color = widgets.Color('#ffffff').tag(sync=True)
    model_data = Dict(default_value={}).tag(sync=True)
    poly_alpha = Float(1.0).tag(sync=True)
    show_edges = Bool(True).tag(sync=True)
    show_marker = Bool(True).tag(sync=True)
    title = Unicode('').tag(sync=True)

    def refresh(self):
        self.send({'type': 'refresh'})

    def set_data(self, d):
        self.model_data = d
        self.refresh()

    def set_title(self, t):
        self.title = t
        self.comm

    @traitlets.default('layout')
    def _default_layout(self):
        return widgets.Layout(
            width='50%',
            min_width='25%',
            margin='auto'
        )

    def _vtk_displayed(self, o):
        self.refresh()

    def __init__(self, title='', bg_color='#ffffff', data=None):
        self.model_data = {} if data is None else data
        self.title = title
        self.bg_color = bg_color
        self.on_displayed(self._vtk_displayed)
        super(VTK, self).__init__()


# Note we need to subclass VBox in the javascript as well
@widgets.register
class Viewer(widgets.VBox, rs_utils.RSDebugger):
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

    external_props = Dict(default_value={}).tag(sync=True)
    external_prop_map = {}

    # add data param
    def display(self):
        return self

    def refresh(self):
        self.content.send({'type': 'refresh'})

    def set_data(self, data):
        # keep a local reference to the data for handlers
        #self.rsdbg('vtk setting data {}'.format(data))
        self.model_data = data
        #self.content.model_data = data
        self.content.set_data(self.model_data)
        self._update_layout()

    # several test modes?  polyData, built-in vtk sources, etc.
    def test(self):
        self.set_data(gui_utils.get_test_obj())

    @traitlets.default('layout')
    def _default_layout(self):
        return widgets.Layout(align_self='stretch')

    def _handle_change(self, change):
        self.rsdbg('{}'.format(change))

    def _has_data_type(self, d_type):
        if self.model_data is None or 'data' not in self.model_data:
            return False
        return gui_utils.any_obj_has_data_type(
                self.model_data['data'], d_type
            )

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
        # maps (0, 1) to (-1, 1)
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
        # maps (-1, 1) to (0, 1)
        self.axis_btns[axis]['button'].description = axis + Viewer._dirs[int((1 - d) / 2)]

    def _set_external_props(self, d):
        self.external_props = d['new']
        for pn in self.external_prop_map:
            p = self.external_prop_map[pn]
            setattr(getattr(self, p['obj']), p['attr'], self.external_props[pn])

    def _update_layout(self):
        self.poly_alpha_grp.layout.display = \
            None if self._has_data_type(gui_utils.GL_TYPE_POLYS) else 'none'

    def _viewer_displayed(self, o):
        # if we have data, this will trigger the refresh on the front end
        # but we need the widget to be ready first
        #self.rsdbg('VIEWER ready data {}'.format(self.model_data))
        self.set_data(self.model_data)

    def __init__(self, data=None):
        if data is None:
            data = {}
        self.model_data = data

        # don't initialize VTK with data - save until the view is ready
        self.content = VTK()

        self.reset_btn = widgets.Button(description='Reset Camera',
                                        layout={'width': 'fit-content'})
        self.reset_btn.on_click(self._reset_view)

        self.axis_btns = {}
        for axis in Viewer._axes:
            self.axis_btns[axis] = {
                'button': widgets.Button(
                    layout={'width': 'fit-content'}
                ),
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

        # default layout has fixed width which takes up too much space
        self.bg_color_pick = widgets.ColorPicker(
            concise=True,
            layout={'width': 'max-content'},
            value=self.content.bg_color
        )
        # separate label to avoid text truncation
        bg_color_pick_grp = widgets.HBox(
            [widgets.Label('Background color'), self.bg_color_pick]
        )

        self.obj_color_pick = widgets.ColorPicker(
            concise=True,
            layout={'width': 'max-content'},
            value=self.content.selected_obj_color
        )
        obj_color_pick_grp = widgets.HBox(
            [widgets.Label('Object color'), self.obj_color_pick]
        )

        self.poly_alpha_slider = widgets.FloatSlider(
            min=0.0, max=1.0, step=0.05, value=self.content.poly_alpha
        )
        self.poly_alpha_grp = widgets.HBox(
            [widgets.Label('Surface Alpha'), self.poly_alpha_slider]
        )

        view_props_grp = widgets.HBox(
            [bg_color_pick_grp,
             obj_color_pick_grp,
             self.poly_alpha_grp,
             self.edge_toggle]
        )

        # links the values of two widgets
        widgets.jslink(
            (self.bg_color_pick, 'value'),
            (self.content, 'bg_color')
        )

        widgets.jslink(
            (self.obj_color_pick, 'value'),
            (self.content, 'selected_obj_color')
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

        # observe lists to be set as dropdown items
        self.observe(self._set_external_props, names='external_props')
        super(Viewer, self).__init__(children=[
            self.content, view_cam_grp, view_props_grp,
        ])

