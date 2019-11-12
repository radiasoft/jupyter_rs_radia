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

    def _add_normals(self, geom):
        norms = []
        p_idx = 0
        verts = numpy.array(geom['polygons']['vertices'])
        #print('calc norms from {} pts'.format(len(verts)))
        # normal for each vertex in each polygon - vertices can be in more than one
        # note normals for a given poly are all the same

        # normal for each polygon -
        for l in geom['polygons']['lengths']:
            v = numpy.reshape(verts[p_idx : p_idx + 3 * l], (l, 3))
            vx = numpy.cross(v[2] - v[1], v[1] - v[0])
            nv = linalg.norm(vx)
            vx = vx / (nv if nv > 0 else 1)
            norms.extend(vx)

            #for i in range(l):
                #i1 = i % l
                #i2 = (i + 1) % l
                #i3 = (i + 2) % l
                #v1 = v[i2] - v[i1]
                #v2 = v[i3] - v[i2]
                #vx = numpy.cross(v2, v1)
                #nv = linalg.norm(vx)
                #vx = vx / (nv if nv > 0 else 1)
                #norms.extend(vx)
        #        #p_norms.append(vx / (nv if nv > 0 else 1))
            p_idx += 3 * l

        geom['polygons']['normals'] = norms
        return geom

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

    def vector_field_to_data(self, name):
        # format is [[[px, py, pz], [vx, vy, vx]], ...]
        # convert to webGL object
        g = self.get_geom(name)
        pv_arr = rad.ObjM(g)

        data = gui_utils.new_gl_object()
        data['vectors']['lengths'] = []
        data['vectors']['colors'] = []
        v_max = 0.
        v_min = sys.float_info.max
        for i in range(len(pv_arr)):
            p = pv_arr[i][0]
            v = pv_arr[i][1]
            n = linalg.norm(v)
            v_max = max(v_max, n)
            v_min = min(v_min, n)
            nv = (numpy.array(v) / (n if n > 0 else 1.)).tolist()
            data['vectors']['vertices'].extend(p)
            data['vectors']['directions'].extend(nv)
            data['vectors']['magnitudes'].append(n)

        g_d = self.geom_to_data(name, divide=False)
        # temp color set - will move to client
        for c_idx, c in enumerate(g_d['lines']['colors']):
            g_d['lines']['colors'][c_idx] = 0.85
        data['lines']['vertices'].extend(g_d['lines']['vertices'])
        data['lines']['lengths'].extend(g_d['lines']['lengths'])
        data['lines']['colors'].extend(g_d['lines']['colors'])

        return data

    def geom_to_data(self, name, axes=False, divide=True):
        #TODO(mvk): if no color, get color from parent if any?
        #TODO(mvk): if container, loop through children (non?)recursively -- we need
        # separate actors for each object (we don't need to preserve parent-child
        # relationships though (yet?))
        geom = self.get_geom(name)
        #print(rad.ObjDrwVTK(geom, 'Axes->No'))
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

