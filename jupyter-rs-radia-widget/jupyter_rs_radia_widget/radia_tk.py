import numpy
import radia
import rs_widget_utils
import sys

from numpy import linalg
from pykern.pkdebug import pkdp
from rs_widget_utils import gui_utils
from rs_widget_utils import rs_utils

class RadiaGeomMgr():
    """Manager for multiple geometries (Radia objects)"""

    def _get_all_geom(self, geom):
        g_arr = []
        for g in radia.ObjCntStuf(geom):
            if len(radia.ObjCntStuf(g)) > 0:
                g_arr.extend(self._get_all_geom(g))
            else:
                g_arr.append(g)
        return g_arr

    def add_geom(self, geom_name, geom):
        self._geoms[geom_name] = geom

    def magnetization_to_data(self, name):
        return self.vector_field_to_data(name, radia.ObjM(self.get_geom(name)))

    # define send to satisfy RSDebugger - get web socket somehow?
    def send(self, msg):
        pkdp(msg)

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
        v_data.vectors.range = [v_min, v_max]

        l_data = self.geom_to_data(name, divide=False)['data'][0]
        # temp color set - will move to client
        for c_idx, c in enumerate(l_data.lines.colors):
            l_data.lines.colors[c_idx] = 0.85
        v_data.lines.vertices.extend(l_data.lines.vertices)
        v_data.lines.lengths.extend(l_data.lines.lengths)
        v_data.lines.colors.extend(l_data.lines.colors)

        return {
            'name': name,
            'data': [v_data]
        }

    def geom_to_data(self, name, axes=False, divide=True):
        #TODO(mvk): if no color, get color from parent if any?
        geom = self.get_geom(name)
        d_arr = []
        if not divide:
            d_arr.append(rs_utils.to_pkdict(radia.ObjDrwVTK(geom, 'Axes->No')))
        else:
            for g in radia.ObjCntStuf(geom):
            #for g in self._get_all_geom(geom):
                d_arr.append(rs_utils.to_pkdict(radia.ObjDrwVTK(g, 'Axes->No')))
                #d_arr.append(rad.ObjDrwVTK(g, 'Axes->No'))

        return {
            'name': name,
            'data': d_arr,
        }

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

