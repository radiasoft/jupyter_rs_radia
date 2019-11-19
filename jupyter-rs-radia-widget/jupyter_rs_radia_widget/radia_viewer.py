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


@widgets.register
class RadiaViewer(widgets.VBox, rs_utils.RSDebugger):
    """Radia interface"""
    _view_name = Unicode('RadiaViewerView').tag(sync=True)
    _model_name = Unicode('RadiaViewerModel').tag(sync=True)
    _view_module = Unicode('jupyter-rs-radia-widget').tag(sync=True)
    _model_module = Unicode('jupyter-rs-radia-widget').tag(sync=True)
    _view_module_version = Unicode('^0.0.1').tag(sync=True)
    _model_module_version = Unicode('^0.0.1').tag(sync=True)

    field_color_map_name = Unicode('').tag(sync=True)

    def _radia_displayed(self, o):
        pass

    def _set_field_color_map(self, d):
        self.field_color_map_name = d['new']

    def _set_vector_scaling(self, d):
        self.content.vector_scaling = d['new']

    # show/hide/enable/disable controls based on current state
    def _update_layout(self):
        pass

    def display(self):
        return self

    def __init__(self, mgr=None):
        self.model_data = {}
        self.mgr = radia_tk.RadiaGeomMgr() if mgr is None else mgr
        self.on_displayed(self._radia_displayed)
        self.vtk_viewer = vtk_viewer.Viewer(data=self.model_data)

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
        self.solve_method = widgets.Dropdown(value='0', options=['0', '3', '4', '5'])
        self.solve_btn = widgets.Button(description='Solve')

        self.solve_grp = widgets.HBox([
            self.solve_prec,
            self.solve_max_iter,
            self.solve_method,
            self.solve_btn
        ])

        super(RadiaViewer, self).__init__(children=[
            self.vtk_viewer, self.vector_grp, self.solve_grp
        ])
