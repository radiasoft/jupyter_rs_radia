from __future__ import absolute_import, division, print_function

import ipywidgets as widgets
import numpy
import radia as rad
import sys

from jupyter_rs_radia_widget import radia_tk
from jupyter_rs_vtk_widget import gui_utils
from jupyter_rs_vtk_widget import vtk_viewer
from numpy import linalg
from rs_widget_utils import rs_utils
from traitlets import Any, Dict, Instance, List, Unicode

DISPLAY_TYPES = ['Geom', 'Field']

@widgets.register
class RadiaViewer(widgets.VBox, rs_utils.RSDebugger):
    """Radia interface"""
    _view_name = Unicode('RadiaViewerView').tag(sync=True)
    _model_name = Unicode('RadiaViewerModel').tag(sync=True)
    _view_module = Unicode('jupyter-rs-radia-widget').tag(sync=True)
    _model_module = Unicode('jupyter-rs-radia-widget').tag(sync=True)
    _view_module_version = Unicode('^0.0.1').tag(sync=True)
    _model_module_version = Unicode('^0.0.1').tag(sync=True)

    current_geom = Unicode('POOP').tag(sync=True)

    field_color_map_name = Unicode('').tag(sync=True)

    external_props = Dict(default_value={}).tag(sync=True)
    external_prop_map = {
        'field_color_maps': {
            'obj': 'field_color_map_list',
            'attr': 'options'
        },
        'field_color_map_name': {
            'obj': 'field_color_map_list',
            'attr': 'value'
        },
        'vector_scaling_types': {
            'obj': 'vector_scaling_list',
            'attr': 'options'
        },
        'vector_scaling': {
            'obj': 'vector_scaling_list',
            'attr': 'value'
        },
    }


    field_color_maps = List(default_value=list()).tag(sync=True)
    vector_scaling_types = List(default_value=list()).tag(sync=True)
    vtk_viewer = None

    # may be useful to talk to the vtk viewer
    def _handle_msg(self, msg):
        #self.rsdebug('GOT FRONT END MSG {}'.format(msg))
        pass

    def _has_data_type(self, d_type):
        if self.model_data is None or 'data' not in self.model_data:
            return False
        return gui_utils.any_obj_has_data_type(
                self.model_data['data'], d_type
            )

    def _radia_displayed(self, o):
        #self.rsdebug('RADIA ready')
        #self.vtk_viewer.set_data(self.model_data)
        self.geom_list.value = self.current_geom
        pass

    def _set_current_geom(self, d):
        g_name = d['new']
        self.current_geom = g_name  #self.mgr.get_geom(g_name)
        self.display(g_name)
        self._update_layout()

    def _set_external_props(self, d):
        self.external_props = d['new']
        for pn in self.external_prop_map:
            p = self.external_prop_map[pn]
            setattr(getattr(self, p['obj']), p['attr'], self.external_props[pn])

    def _set_field_color_map(self, d):
        self.field_color_map_name = d['new']

    def _set_vector_scaling(self, d):
        self.content.vector_scaling = d['new']

    def _solve(self, b):
        self.rsdebug('solve prec {} iter {} meth {}'.format(self.solve_prec.value, self.solve_max_iter.value, self.solve_method.value))
        #res = rad.Solve(
        #    self.current_geom,
        #    self.solve_prec.value,
        #    self.solve_max_iter.value,
        #    int(self.solve_method.value)
        #)

    # show/hide/enable/disable controls based on current state
    def _update_layout(self):
        self.vector_grp.layout.display =\
            None if self._has_data_type(gui_utils.GL_TYPE_VECTS) else 'none'
        self.field_type_list.layout.display =\
            None if self.data_type_list.value == 'Field' else 'none'

    def _update_viewer(self, d):
        self._update_layout()


    # needs to handle vector fields in addition to geometries
    def display(self, g_name, d_type='Geom'):
        if d_type not in DISPLAY_TYPES:
            raise ValueError('Invalid display type {}'.format(d_type))
        self.current_geom = g_name
        self.model_data = self.mgr.geom_to_data(g_name)
        # one or the other of these?
        self.vtk_viewer.set_data(self.model_data)
        #self.vtk_viewer.add_obj(self.model_data)
        return self

    def __init__(self, mgr=None):
        self.model_data = {}
        self.mgr = radia_tk.RadiaGeomMgr() if mgr is None else mgr
        self.on_displayed(self._radia_displayed)
        self.on_msg(self._handle_msg)
        self.vtk_viewer = vtk_viewer.Viewer()

        self.data_type_list = widgets.Dropdown(
            layout={'width': 'max-content'},
            options=['Object', 'Field'],
            description='View',
        )
        self.data_type_list.observe(self._update_viewer, names='value')

        self.field_type_list = widgets.Dropdown(
            layout={'width': 'max-content'},
            options=['M', 'B'],
            description='Field',
        )

        self.geom_list = widgets.Dropdown(
            layout={'width': 'max-content'},
            options=[n for n in self.mgr.get_geoms()]
        )
        self.geom_list.observe(self._set_current_geom, names='value')
        geom_list_grp = widgets.HBox(
            [widgets.Label('Geometry'), self.geom_list],
        )

        self.geom_grp = widgets.HBox([
            geom_list_grp,
            self.data_type_list,
            self.field_type_list
        ])

        # to be populated by the client
        self.field_color_map_list = widgets.Dropdown(
            layout={'width': 'max-content'},
        )

        # the options/value of a dropdown are not syncable!  We'll work around it
        self.field_color_map_list.observe(self._set_field_color_map, names='value')
        field_map_grp = widgets.HBox(
            [widgets.Label('Field Color Map'), self.field_color_map_list],
        )

        self.vector_scaling_list = widgets.Dropdown(
            layout={'width': 'max-content'},
        )

        self.vector_scaling_list.observe(self._set_vector_scaling, names='value')
        vector_scaling_grp = widgets.HBox(
            [widgets.Label('Field Scaling'), self.vector_scaling_list]
        )

        self.vector_grp = widgets.HBox([field_map_grp, vector_scaling_grp])

        self.solve_prec = widgets.BoundedFloatText(value=0.0001, min=1e-06, max=10.0,
                                                  description='Precision (T)')
        self.solve_max_iter = widgets.BoundedIntText(value=1500, min=1, max=1e6,
                                                  description='Max Iterations')
        self.solve_method = widgets.Dropdown(
            layout={'width': 'max-content'},
            description='Method',
            value='0',
            options=['0', '3', '4', '5']
        )
        self.solve_btn = widgets.Button(description='Solve',
                                        layout={'width': 'fit-content'})
        self.solve_btn.on_click(self._solve)

        self.solve_grp = widgets.HBox([
            #geom_list_grp,
            self.solve_prec,
            self.solve_max_iter,
            self.solve_method,
            self.solve_btn
        ])

        self.observe(self._set_external_props, names='external_props')
        super(RadiaViewer, self).__init__(children=[
            self.vtk_viewer,
            self.vector_grp,
            self.geom_grp,
            self.solve_grp,
            #self.solve_btn
        ])
