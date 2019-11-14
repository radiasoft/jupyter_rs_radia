from __future__ import absolute_import, division, print_function

import ipywidgets as widgets
import numpy
import radia as rad
import sys

from jupyter_rs_vtk_widget import gui_utils
from jupyter_rs_vtk_widget import rs_utils
from jupyter_rs_vtk_widget import vtk_viewer
from numpy import linalg
from traitlets import Any, Dict, Instance, List, Unicode


@widgets.register
class RadiaViewer(widgets.VBox, rs_utils.RSDebugger):
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
        #self.component_viewer = vtk_viewer.VTK()
        #comp_box = widgets.HBox([self.component_viewer], layout=widgets.Layout(
        #    height='10%',
        #    align_self = 'stretch'
        #))
        super(RadiaViewer, self).__init__(children=[
            self.main_viewer,
            #comp_box
        ])

class RadiaGeomMgr():
    """Manager for multiple geometries (Radia objects)"""

    def _get_all_geom(self, geom):
        g_arr = []
        for g in rad.ObjCntStuf(geom):
            if len(rad.ObjCntStuf(g)) > 0:
                g_arr.extend(self._get_all_geom(g))
            else:
                g_arr.append(g)
        return g_arr

    def add_geom(self, geom_name, geom):
        self._geoms[geom_name] = geom

    def magnetization_to_data(self, name):
        return self.vector_field_to_data(name, rad.ObjM(self.get_geom(name)))

    def vector_field_to_data(self, name, pv_arr):
        # format is [[[px, py, pz], [vx, vy, vx]], ...]
        # convert to webGL object

        v_data = gui_utils.new_gl_object()
        v_data.vectors.lengths = []
        v_data.vectors.colors = []
        v_max = 0.
        v_min = sys.float_info.max
        for i in range(len(pv_arr)):
            p = pv_arr[i][0]
            v = pv_arr[i][1]
            n = linalg.norm(v)
            v_max = max(v_max, n)
            v_min = min(v_min, n)
            nv = (numpy.array(v) / (n if n > 0 else 1.)).tolist()
            v_data.vectors.vertices.extend(p)
            v_data.vectors.directions.extend(nv)
            v_data.vectors.magnitudes.append(n)

        l_data = self.geom_to_data(name, divide=False)
        # temp color set - will move to client
        for c_idx, c in enumerate(l_data.lines.colors):
            l_data.lines.colors[c_idx] = 0.85
        v_data.lines.vertices.extend(l_data.lines.vertices)
        v_data.lines.lengths.extend(l_data.lines.lengths)
        v_data.lines.colors.extend(l_data.lines.colors)

        return v_data

    def geom_to_data(self, name, axes=False, divide=True):
        #TODO(mvk): if no color, get color from parent if any?
        #TODO(mvk): if container, loop through children (non?)recursively -- we need
        # separate actors for each object (we don't need to preserve parent-child
        # relationships though (yet?))
        geom = self.get_geom(name)
        if not divide:
            return gui_utils.add_normals(rad.ObjDrwVTK(geom, 'Axes->No'))
        d_arr = []
        # g_d = rad.ObjDrwVTK(self.get_geom(name), 'Axes->' + ('Yes' if axes else 'No'))
        for g in rad.ObjCntStuf(geom):
        #for g in self._get_all_geom(geom):
            d_arr.append(gui_utils.add_normals(rad.ObjDrwVTK(g, 'Axes->No')))
            #d_arr.append(rad.ObjDrwVTK(g, 'Axes->No'))

        return {name: d_arr}

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

