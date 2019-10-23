from __future__ import absolute_import, division, print_function

import ipywidgets as widgets
import math
import numpy as np
import radia as rad
import re
import sys

from jupyter_rs_vtk_widget import gui_utils
from jupyter_rs_vtk_widget import rs_utils
from jupyter_rs_vtk_widget import vtk_viewer
from numpy import linalg
from traitlets import Any, Dict, Instance, List, Unicode


@widgets.register
class RadiaViewer(widgets.VBox):
    """Radia interface"""
    _view_name = Unicode('RadiaViewerView').tag(sync=True)
    _model_name = Unicode('RadiaViewerModel').tag(sync=True)
    _view_module = Unicode('jupyter-rs-vtk-widget').tag(sync=True)
    _model_module = Unicode('jupyter-rs-vtk-widget').tag(sync=True)
    _view_module_version = Unicode('^0.0.1').tag(sync=True)
    _model_module_version = Unicode('^0.0.1').tag(sync=True)

    def _radia_displayed(self, o):
        pass

    def __init__(self, data=None, mgr=None):
        self.model_data = {} if data is None else data
        self.mgr = RadiaGeomMgr() if mgr is None else mgr
        self.on_displayed(self._radia_displayed)
        self.main_viewer = vtk_viewer.Viewer(data=self.model_data)
        self.field_color_map_select = widgets.Dropdown(options=gui_utils.color_maps())

        # may need to be viewport?
        self.component_viewer = vtk_viewer.VTK()
        comp_box = widgets.HBox([self.component_viewer], layout=widgets.Layout(
            height='10%',
            align_self = 'stretch'
        ))
        super(RadiaViewer, self).__init__(children=[
            self.main_viewer, comp_box
        ])

class RadiaGeomMgr():
    """Manager for multiple geometries (Radia objects)"""

    def add_geom(self, geom_name, geom):
        self._geoms[geom_name] = geom

    def vector_field_to_data(self, name, color_map=gui_utils.default_color_map(),
                             include_geom=True):
        # format is [[[px, py, pz], [vx, vy, vx]], ...]
        # convert to webGL object
        cm = gui_utils.get_color_map(color_map)
        num_colors = len(cm)
        g = self.get_geom(name)
        pv_arr = rad.ObjM(g)

        data = gui_utils.new_gl_object()
        v_max = 0.
        v_min = sys.float_info.max
        for i in range(len(pv_arr)):
            p = pv_arr[i][0]
            v = pv_arr[i][1]
            n = linalg.norm(v)
            v_max = max(v_max, n)
            v_min = min(v_min, n)
            #nv = (p + 10. * np.array(v) / (n if n > 0 else 1.)).tolist()
            #nv = (p + np.array(v) / (n if n > 0 else 1.)).tolist()
            nv = (np.array(v) / (n if n > 0 else 1.)).tolist()
            #data['lines']['vertices'].extend(p)
            #data['lines']['vertices'].extend(nv)
            #data['lines']['lengths'].append(2)
            data['vectors']['vertices'].extend(p)
            data['vectors']['directions'].extend(nv)

        v_range = v_max - v_min
        v_range = v_range if v_range > 0 else 1.
        for i in range(len(pv_arr)):
            v = pv_arr[i][1]
            v_normed = (linalg.norm(v) - v_min) / v_range
            c_index = math.floor(v_normed * (num_colors - 1))
            c = cm[c_index]
            r, g, b = gui_utils.rgb_from_color(c)
            #data['lines']['colors'].extend([r, g, b])
            data['vectors']['colors'].extend([r, g, b])

        if include_geom:
            g_d = self.geom_to_data(name)
            data['lines']['vertices'].extend(g_d['lines']['vertices'])
            data['lines']['lengths'].extend(g_d['lines']['lengths'])
            data['lines']['colors'].extend(g_d['lines']['colors'])

        return data


    def geom_to_data(self, name, axes=False):
        #TODO(mvk): if no color, get color from parent if any?
        return rad.ObjGeometry(self.get_geom(name), 'Axes->' + ('Yes' if axes else 'No'))


    def get_geom(self, name):
        return self._geoms[name]

    def get_geom_list(self):
        return [n for n in self._geoms]

    def get_geoms(self):
        return self._geoms

    # A container is also a geometry
    def make_container(self, *args):
        ctr = {
            'geoms': []
        }
        for g_name in args:
            # key error if does not exist
            g = self.get_geom(g_name)
            ctr['geoms'].append(g)

    def show_viewer(self, geom_name):
        # put geom in main viewer
        return

    def show_component_viewer(self, geom_name):
        # put geom in main viewer
        return

    def __init__(self):
        self._geoms = {}

